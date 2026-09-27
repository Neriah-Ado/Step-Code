---
name: stepcode-dev
description: StepCode (Step-Code) repository rules and extension development spec. Covers the four iron rules (no AI commit attribution, minimal core, understand your code, public boundary), pre-PR checks (npm run check + test.sh), config.toml/MCP/command-permission model, and how to author plugins (step.plugin.json), skills (SKILL.md / Agent Skills standard), and TypeScript extensions (ExtensionAPI). Use when working in the Step-Code repository, or building/installing StepCode plugins, skills, extensions, or step packages.
license: MIT
compatibility: Works with StepCode, ZCode, Claude Code, and any Agent Skills compatible harness.
metadata:
  source: https://github.com/Neriah-Ado/Step-Code
  guide: docs/agents-universal-guide.md in the Step-Code fork
---

# StepCode Development Spec

Consolidated, self-contained rules for any agent working **in the Step-Code repository** or **on StepCode plugins / skills / extensions**. Distilled from the repo's `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/*`, and `packages/coding-agent/docs/*` (authoritative file index at the bottom).

## The Four Iron Rules (always)

1. **Commit attribution**: author/committer stays the human contributor's verified GitHub identity. NEVER add `Co-authored-by` / `Co-Authored-By` trailers for Claude, Claude Code, Codex, ChatGPT, OpenAI, Anthropic, or any AI client; never mention the AI client in commit messages for attribution. Check and strip these trailers before committing/amending. (Mentioning AI products in product docs is fine.)
2. **Minimal core**: StepCode's core stays minimal. If a feature can be an extension/plugin/skill, do not put it in core; core-bloating PRs get rejected. Hook points for extensions need discussion first.
3. **Understand your code**: if you cannot explain what a change does and how it interacts with the system, the PR will be closed. AI-written code is fine; unreviewed AI slop is not.
4. **Public boundary**: this is the public source view. Never introduce private CI/release paths, private hostnames, object-store SDKs, private CI variables, or credentials. `check:public-boundary` scans for these.

## Pre-PR workflow

```bash
npm run check     # pnpm-driven: biome + 15 architecture/boundary checks + tsgo --noEmit + browser smoke
./test.sh         # non-LLM tests (no API keys needed)
```

Environment: Node >= 22.19.0, pnpm 9.x workspaces. Run from source: `NODE_OPTIONS=--no-node-snapshot <repo>/step-test.sh`. Never open issues in bulk/automated fashion (accounts get permanently blocked); issues must use the templates and stay short and concrete.

## Routing: what to read for which task

| Task | Read first |
| --- | --- |
| Committing, opening PRs/issues, touching CI or release | [references/repo-rules.md](references/repo-rules.md) |
| Building a plugin (`step.plugin.json`) or marketplace | [references/plugins.md](references/plugins.md) |
| Building a skill (`SKILL.md`) or choosing skill locations | [references/skills-format.md](references/skills-format.md) |
| Writing a TypeScript extension (events, tools, commands, UI) | [references/extensions.md](references/extensions.md) |
| Anything about config.toml, MCP servers, command permissions, ~/.stepcode layout | [references/config-and-mcp.md](references/config-and-mcp.md) |

## Quick checklists

**Before every commit** — changes understood; `npm run check` + `./test.sh` pass; no AI attribution in commit metadata; no private paths/credentials added.

**Before writing a plugin** — `id` is a safe name (`/^[a-z0-9][a-z0-9._-]*$/i`); `mcpServers` entries have a `command`; all declared paths are relative and inside the package; install into `plugins/`, **restart Step**, verify with `/plugin list`, clear every diagnostic warning.

**Before writing a skill** — valid frontmatter (`name`: 1-64 chars, lowercase/digits/hyphens, no lead/trail/consecutive hyphens; `description`: specific, <= 1024 chars); scripts/assets referenced by relative paths; placed in a skills location; verified via `/skill:name`.

**Before writing an extension** — default-export factory; no background resources (processes/sockets/timers) started in the factory; `session_shutdown` cleanup is idempotent; guard dialogs with `ctx.hasUI`; check `ctx.isProjectTrusted()` before reading project-local config; treat `/reload` as terminal for the handler; never reuse captured session objects after session replacement.

**Hard prohibitions** — auto-approve `rm` with recursive+force (built-in rule, every preset confirms each call); hardcode `.stepcode` (use `CONFIG_DIR_NAME`); use `__dirname` for package assets (use `src/config.ts` helpers); treat unresolved permission analysis as allow; bulk automated issues.

## Repo quick facts

- Terminal coding agent; pnpm monorepo: `apps/cli` (product), `packages/coding-agent` (core), `packages/agent-core`, `packages/providers`, `packages/tui`, `packages/telemetry`, `packages/config`.
- Unified config: `~/.stepcode/config.toml` (global) + `<cwd>/.stepcode/config.toml` (project, trust-gated, optional). Legacy `settings.json` / `step-settings.json` are retired.
- Extensions: TypeScript modules under `~/.stepcode/agent/extensions/` (global) or `.stepcode/extensions/` (project); load TS directly via jiti; hot-reload with `/reload`.
- Plugins: declarative manifests copied into `plugins/` dirs; MCP servers start after restart.
- Skills: Agent Skills standard; `~/.stepcode/agent/skills/`, `~/.agents/skills/`, `.stepcode/skills/`, `.agents/skills/` (project, trust-gated), package `skills/` dirs, settings `skills` array, `--skill`.
- Tests: `./test.sh` (non-LLM), `npm test` (all), `npm test -- test/x.test.ts` (single file).
- Debug: hidden `/debug` command writes `~/.stepcode/agent/step-debug.log`.

## Authoritative sources (in the Step-Code repo)

- `AGENTS.md` / `CLAUDE.md` — commit attribution policy
- `CONTRIBUTING.md` — philosophy, issue rules, PR gate
- `docs/open-source-status.md` — public boundary
- `docs/step-configuration.md` + `docs/step-unified-config-and-mcp.md` — config & MCP
- `docs/command-permissions.md` — permission model
- `packages/coding-agent/docs/skills.md` — skills spec (standard: agentskills.io)
- `packages/coding-agent/docs/extensions.md` — extension API (authoritative, 3000+ lines)
- `packages/coding-agent/docs/packages.md` — step package distribution
- `packages/coding-agent/src/step/plugins.ts` — plugin/marketplace facade (source of truth)
- `packages/providers/README.md` — provider checklist
