# StepCode Config, MCP & Command Permissions

Authoritative docs: `docs/step-configuration.md`, `docs/step-unified-config-and-mcp.md`, `docs/command-permissions.md`.

## Unified config: config.toml

- Global: `~/.stepcode/config.toml` (auto-created on first run).
- Project: `<cwd>/.stepcode/config.toml` — **optional**, missing file contributes nothing and warns not; gated behind **project trust**.
- Legacy `settings.json` / `step-settings.json` are **retired** (no longer read/written/信任提示; migrate manually). No automatic import from pre-pi `config.json`.
- TOML has no null (values stripped before write); leading comments are preserved on rewrite; writes are atomic (tmp + rename) under a settings lock.

```toml
# ~/.stepcode/config.toml
theme = "step-dark"
defaultProvider = "step"
defaultModel = "step-2"
permissionPreset = "standard"
autoResume = true

[telemetry]
enabled = true

[mcp_servers.local-tools]
command = "node"
args = ["./mcp-server.js"]
env = { LOG_LEVEL = "info" }
startup_timeout_sec = 30
disabled_tools = ["dangerous_tool"]

[mcp_servers.remote]
url = "https://mcp.example.com/mcp"
bearer_token_env_var = "EXAMPLE_TOKEN"
tool_timeout_sec = 300

[mcp_servers.remote.oauth]
callback_port = 8976
```

## `~/.stepcode/` layout

| Path | Purpose |
| --- | --- |
| `config.toml` | unified settings + `[mcp_servers]` |
| `auth.json` | Step provider credentials (0600) via `step login` |
| `models.json` | model catalog overrides |
| `.credentials.json` | MCP OAuth tokens (0600), key = `<name>\|<url>` |
| `workspace-trust.json`, `agent/trust.json` | project trust decisions |
| `plugins/`, `marketplaces/` | installed plugins; marketplace checkouts |
| `skills/`, `agent/skills/` | user skills |
| `agent/extensions/`, `agent/prompts/` | global extensions, custom prompts |
| `agent/sessions/`, `sessions/` | session records |
| `logs/`, `telemetry/`, `bin/`, `device-id` | logs, telemetry spool, binaries, device id |
| `agent/settings.json`, `agent/step-settings.json` | retired — ignore/residue in old installs |

## Environment variables

- `STEP_CODING_AGENT_DIR` — select the agent directory (CLI/SDK); `STEP_CODING_AGENT_SESSION_DIR` — session storage (unless `--session-dir`). Names are fixed.
- `STEPCODE_APP_NAME` — display-name override only; does NOT switch commands/providers/storage paths (Step always uses `.stepcode`).
- CLI sets `AI_AGENT=step`.

## MCP servers

- Discovery: global `[mcp_servers]` from config.toml, then plugin-declared servers. `enabled = false` → skipped at discovery (absent from `/mcp`).
- Transports: `command` → stdio; `url` → HTTP (StreamableHTTP).
- Tool-level safety: `enabled_tools` / `disabled_tools` filter **before** the tool registry — a security control, not a prompt suggestion.
- Auth: `bearer_token_env_var` → `Authorization: Bearer $VAR`; `http_headers` literal; `env_http_headers` values are env-var NAMES — missing value is a hard error (never an unauthenticated request).
- Timeouts: startup 30 s (`startup_timeout_sec`), tool call 300 s (`tool_timeout_sec`).
- CLI (`step mcp ...`): `list [--json]`, `get <name> [--json]`, `add <name> --url <url> [--bearer-token-env-var VAR]`, `add <name> [--env K=V]... -- <command> [args...]`, `remove <name>`, `login <name>` (OAuth), `logout <name>`.
  - Validation failures exit 1: missing/duplicate name; neither `--url` nor `--`; both `--url` and command; bearer token on non-HTTP; `--env` on HTTP servers (`--env` sets process env, not HTTP headers).
  - Everything after `--` is the server's argv; the parser never crosses `--`.
- OAuth: dynamic client registration + PKCE + local `127.0.0.1` callback; tokens in `~/.stepcode/.credentials.json`; a declared `oauth.callback_port` is mandatory (no fallback port).
- Runtime: interactive sessions connect in the background (`/mcp` shows `connecting|connected|failed|disabled` + tool counts); print/RPC sessions wait for the full initial catalog. On HTTP 401 / SDK auth errors, run `step mcp login <name>` then **restart** Step.

## Command permission model

Shared shell analysis (pinned `unbash` parser + `command-policy.ts`) yields one of three outcomes per bash tool call:

| Analysis | Ask / Bypass / Autopilot | Read-only | Without approval channel |
| --- | --- | --- | --- |
| Built-in dangerous rule matched | confirm **every** call | deny | deny |
| Could not be fully analyzed | confirm every call (with explanation) | deny | deny |
| Analyzed, no rule match | ordinary preset/tool policy | ordinary read-only policy | ordinary unattended policy |

- `recursive-force-remove` (rm with both recursive `-r/-R/--recursive` and force `-f/--force` flags): **cannot** be auto-approved by presets, tool overrides, bypass, or autopilot; `nonInteractiveApproval = "allow"` cannot execute it without an approval channel; read-only denies. Targets are irrelevant (even `./build`, `/tmp/cache`).
- **Unresolved ≠ allowed**: no parse-error-to-allow path exists. `isDangerousCommand()` is a detection query, not an authorization API — incomplete syntax can make it `false` while the call still requires approval or denial (`StepToolDecision.analysisIncomplete` distinguishes unresolved from hazardous).
- Bash is the only grammar that can earn a definite safe verdict; PowerShell/fish/zsh/ksh/sh/dash strings require review (conservative). Unsupported/ambiguous constructs (esc as ANSI-C heredoc delimiters, quoted FDs with lost provenance, array-typed unknown assignments, `mapfile` callbacks, etc.) are unresolved.
- Extension point: `COMMAND_APPROVAL_RULES` — typed named rules; `shell` predicates consume analyzed names/args; `pattern` rules keep conservative raw-text matching (filesystem/device, Git, SQL hazards).
- Changing rules requires tests covering: executable forms, data-only controls, and incomplete analysis. Never equate unexecuted branches with inert data or treat unresolved as success.
- The policy runs through the `tool_call` hook (`packages/coding-agent/src/step/permissions.ts`) before execution; clients render the confirmation, they don't reimplement policy. Manual `!` input and RPC `bash` use the `user_bash` event, outside this policy.
- Static inspection only — not a sandbox; aliases, runtime values, script file contents, and invoked programs are not resolved.
