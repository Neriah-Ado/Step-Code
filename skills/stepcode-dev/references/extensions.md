# StepCode Extensions (TypeScript API digest)

Extensions are TypeScript modules that subscribe to lifecycle events, register custom tools/commands/shortcuts/flags, inject messages, and customize rendering/compaction. Loaded via jiti — no compilation needed. Authoritative doc: `packages/coding-agent/docs/extensions.md` (3000+ lines); working examples in `packages/coding-agent/examples/extensions/`.

Division of labor: **extensions = code logic**; **plugins = declarative distribution (MCP servers etc.)** — see plugins.md.

## Placement

| Location | Scope |
| --- | --- |
| `~/.stepcode/agent/extensions/*.ts` or `*/index.ts` | Global |
| `.stepcode/extensions/*.ts` or `*/index.ts` | Project (loaded only after trust) |
| `step -e ./path.ts` (or `--extension`) | Quick test / temporary package run |

Auto-discovered locations support `/reload` hot reload. More paths via settings `extensions` array; shareable via step packages (`packages.md`).

## Factory shape & imports

```typescript
import type { ExtensionAPI } from "@step-harness/coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) { /* ... */ }   // sync or async
```

- Async factories are awaited before startup continues (use for remote model discovery + `pi.registerProvider()`).
- **Do not start background resources (processes, sockets, watchers, timers) in the factory** — factories may run in invocations that never start a session. Defer to `session_start` or the command/tool that needs the resource, and register an idempotent `session_shutdown` cleanup.
- Available imports: `@step-harness/coding-agent` (types), `typebox` (schemas), `@step-harness/providers` (`StringEnum`), `@step-harness/pi-tui` (TUI), Node builtins, npm deps from a neighboring `package.json`.

## Event map (order)

```
project_trust (global/CLI extensions only; {trusted: "yes"|"no"|"undecided", remember?})
session_start {reason: startup|new|resume|fork|reload}  →  resources_discover (return skillPaths/promptPaths/themePaths)
per user prompt:
  extension commands → input (continue|transform|handled) → skill/template expansion
  before_agent_start (inject message; chain systemPrompt) → agent_start → turn loop:
    turn_start → context (modify messages non-destructively) → before_provider_headers (mutate in place)
    → before_provider_request / after_provider_response → tool loop (tool_execution_start → tool_call →
      tool_execution_update → tool_result → tool_execution_end) → turn_end
  agent_end → agent_settled (no more auto retry/compaction/continuation)
session replacement: session_before_switch|before_fork (cancelable) → session_shutdown → session_start
compaction: session_before_compact (cancel or custom summary) → session_compact(_failed)
model: model_select, thinking_level_select (notification only)
input helpers: user_bash (`!`/`!!`, can swap backend or replace), ui_prompt_start/end
exit: session_shutdown {reason: quit|reload|new|resume|fork}
```

Key semantics:

- `tool_call` **can block**: return `{ block: true, reason?, terminate? }`. `event.input` is mutable in place (patched args affect execution; no re-validation). Parallel mode: sibling results not guaranteed in `ctx.sessionManager`.
- `tool_result` **can modify**: handlers chain like middleware (each sees the previous result); return partial patches (`content`, `details`, `isError`, `usage`). Use `ctx.signal` for nested async.
- `input` results: `continue` (default) / `transform` ({action, text}) / `handled` (skip agent — first wins).
- `before_agent_start` can return `{ message?, systemPrompt? }`; `event.systemPromptOptions` exposes what Step loaded (context files, skills, tools).
- `message_end` can return `{ message }` (same role) to replace the finalized message.

## ExtensionContext essentials

- `ctx.hasUI` — false in print/JSON mode; guard all dialogs (`select/confirm/input/editor`) with it. `ctx.mode` is `"tui" | "rpc" | "json" | "print"` (guard TUI-only features by mode).
- `ctx.isProjectTrusted()` — check before reading project-local config.
- `ctx.sessionManager` — read-only session state (`getEntries`, `getBranch`, `buildContextEntries`, `getLeafId`).
- `ctx.signal` — current agent abort signal (defined during active turns; usually undefined in idle contexts); pass to fetch/abort-aware work.
- `ctx.isIdle()`, `ctx.hasPendingMessages()`, `ctx.abort()`, `ctx.shutdown()` (graceful; emits `session_shutdown`).
- `ctx.getContextUsage()`, `ctx.compact({customInstructions, onComplete, onError})`, `ctx.getSystemPrompt()`.
- Command context (`ExtensionCommandContext`) adds `waitForIdle`, `newSession`, `fork`, `navigateTree`, `switchSession`, `reload`, `getSystemPromptOptions`.

## Registration API

- `pi.registerTool({name, label, description, promptSnippet?, promptGuidelines?, parameters: Type.Object({...}), prepareArguments?, execute(toolCallId, params, signal, onUpdate, ctx), renderCall?, renderResult?})` — works during load AND after startup (immediately callable). **Every `promptGuidelines` bullet must name its tool** ("Use my_tool when…", never "this tool"). Use `StringEnum` for enums (Google compatibility).
- `pi.registerCommand(name, {description, handler, getArgumentCompletions?})` — duplicate names coexist with load-order suffixes (`/review:1`).
- `pi.registerShortcut(key, {handler})`, `pi.registerFlag(name, {type, default})` + `pi.getFlag(name)`.
- `pi.sendMessage({customType, content, display, details}, {deliverAs: "steer"|"followUp"|"nextTurn", triggerTurn?})` — enters LLM context; pair with `pi.registerMessageRenderer`.
- `pi.appendEntry(customType, data)` — persisted but NOT in LLM context; pair with `pi.registerEntryRenderer` for TUI display. Restore in `session_start` by scanning entries.
- `pi.sendUserMessage(content, {deliverAs?, expandPromptTemplates?})` — real user message, always triggers a turn; `deliverAs` required while streaming.
- `pi.exec(command, args, {signal, timeout})`; `pi.getActiveTools/getAllTools/setActiveTools`; `pi.setLabel`; `pi.setSessionName/getSessionName`; `pi.registerProvider`; `pi.registerMarkdownTransformer` (display-only, keep sync/cheap).

## Lifecycle footguns (memorize)

- **Reload**: `await ctx.reload()` tears down the current runtime and rebinds; code after it still runs in the old frame with invalid state. Treat reload as terminal: `await ctx.reload(); return;`. Tools cannot reload directly — queue a command via `pi.sendUserMessage("/reload-cmd", { deliverAs: "followUp" })`.
- **Session replacement** (`newSession/fork/switchSession` with `withSession`): the old session has already emitted `session_shutdown` when `withSession` runs. Use **only the ctx passed to `withSession`**; captured old `sessionManager`/`pi`/ctx objects are stale and throw. Capture only plain data (strings, ids, config).
- Cleanup belongs in `session_shutdown`; reestablish in-memory state in `session_start`.

## Distribution as a step package

`package.json` manifest (or convention dirs):

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

- Install: `step install npm:@foo/bar@1.2.3 | git:github.com/user/repo@v1 | /local/path` (user settings by default, `-l` for project; versioned/npm specs are pinned; git refs don't auto-drift, `step update --extensions` reconciles).
- Runtime deps → `dependencies` (installed with `npm install --omit=dev`); imports of core packages → `peerDependencies: "*"` and never bundled: `@step-harness/providers`, `@step-harness/agent-core`, `@step-harness/coding-agent`, `@step-harness/pi-tui`, `typebox`. Other step packages → `dependencies` + `bundledDependencies`, referenced via `node_modules/...` paths.
- Object form in settings filters what loads (`extensions/skills/prompts/themes` with globs, `!exclude`, `[]` = none, `+path`/`-path` force include/exclude).
- Same package in global + project settings: project wins unless project entry has `autoload: false` (then it's a delta over global).
- Manage: `step list`, `step remove`, `step update [--extensions|--models|--self]`; enable/disable per resource via `step config`.

## Security

Extensions run with full system permissions and can execute arbitrary code — only install from trusted sources; review third-party code.
