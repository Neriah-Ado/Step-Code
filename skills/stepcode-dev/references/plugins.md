# StepCode Plugins: step.plugin.json & Marketplaces

Plugins are **declarative manifests** copied into a plugins directory; the Step runtime starts declared MCP processes after installation (and after a **restart**). The marketplace contract is deliberately smaller than Pi's package manager: no install-time scripts are executed; discovery and provisioning only.

Source of truth: `packages/coding-agent/src/step/plugins.ts` (`packages/coding-agent/test/step-plugins.test.ts`).

## Manifest file

`step.plugin.json` at the plugin root (max 512 KB). Claude Code's `.claude-plugin/plugin.json` is also accepted: its `name` is normalized to `id`, and a sibling `.mcp.json` plus `skills/`, `commands/`, `agents/` directories are auto-detected when not declared.

### Schema (StepPluginManifest)

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string, **required** | Safe name: matches `/^[a-z0-9][a-z0-9._-]*$/i` and is not `.` or `..` |
| `name`, `description`, `version` | string | Display metadata |
| `entry` | string | Relative path inside the package. **Recorded but NOT executed** — the Step marketplace facade does not load executable entries |
| `skills` / `agents` / `commands` | string[] | Relative paths inside the package (no absolute paths, no `..` escapes) |
| `mcpServers` | object or string | Object: `{ "<server-name>": { "command": "...", "args": [...], "env": {...} } }` — every entry needs a non-empty `command`. String: relative path to a declaration JSON file inside the package (e.g. `.mcp.json`); must not escape the package dir |
| `provision` | object | `{ "command": "...", "installer": "...", "requiresEnv": ["VAR", ...] }`. Only honored for the built-in marketplace, and only `installer: "steppageInstaller"` is implemented (skipped on win32). `requiresEnv` diagnostics tell the user to run `/login` (for login-supplied vars like `STEPFUN_API_KEY`) or export/declare the variable |

### Example (built-in playwright)

```json
{
  "id": "playwright",
  "name": "Playwright",
  "description": "Browser automation and end-to-end testing MCP server by Microsoft.",
  "version": "0.1.0",
  "mcpServers": {
    "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] }
  }
}
```

## Install locations & precedence

- User scope: `<storage-root>/plugins/` (typically `~/.stepcode/plugins/`)
- Project scope: `<cwd>/.stepcode/plugins/` (trust-gated)
- Same `id` in both: **project wins**; the ignored copy produces a warning.
- Install = recursive copy of the package directory; duplicate name at target or unsafe name → error.

## Marketplaces

Manifest candidates inside a checkout: `.step-plugin/marketplace.json` (canonical) or `.claude-plugin/marketplace.json` (compat).

```json
{
  "name": "builtin",
  "description": "Plugins that ship inside the StepCode binary.",
  "plugins": [
    { "name": "playwright", "description": "...", "source": "./playwright" }
  ]
}
```

- Entry `source` must be a relative path inside the checkout (or default `plugins/<name>`); entries pointing outside or at missing paths are skipped with warnings.
- Entries whose `source` is an object (hosted in another repository) cannot be fetched by this runtime and are not listed.
- `lspServers` declarations are recorded as "not hosted" and skipped at install.
- Adding a marketplace: git URL, `owner/repo` shorthand (→ `https://github.com/<owner>/<repo>.git`), or local path; git clones use `--depth 1`; the checkout is rejected if no marketplace manifest is found.
- Built-in marketplace `builtin` (playwright + steppage) is materialized from the binary via a fingerprint file; it cannot be updated or removed. `steppage` is pre-installed once (marker file `.stepcode-preinstalled` — uninstalled plugins are not silently resurrected).

## Command surface

```
/plugin                              # interactive menu
/plugin list | browse                # installed / available
/plugin install <name>               # copy from marketplace → plugins dir
/plugin remove|uninstall <name>      # remove (confirm in UI)
/plugin marketplace list | add <git-url|owner/repo|path> | update <name> | remove <name>
```

After install: **restart Step to start the plugin's MCP server** (a warning says so). After uninstall: restart to unload. Diagnostics after install list MCP server names, missing env vars, and invalid declarations — clear every warning before shipping.

## Development checklist

1. Create `<plugin>/step.plugin.json` with a safe `id` and valid `mcpServers` (each with `command`).
2. Any extra files (skills, commands, agents) declared as relative paths inside the package.
3. Install into `~/.stepcode/plugins/<id>/` (or project `.stepcode/plugins/`) — or serve it from a marketplace checkout.
4. Restart Step; run `/plugin list`; resolve all warnings (missing env, missing declaration files, unsafe paths).
5. Remember: `entry` is inert in the marketplace facade — executable logic belongs in a TypeScript extension (see extensions.md), not in a plugin manifest.
