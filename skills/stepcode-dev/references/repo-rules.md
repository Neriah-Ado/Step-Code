# Repo Rules: Commits, PRs, Issues, Boundary

## Commit attribution (from AGENTS.md — hard rule)

- Keep the Git author and committer as the human contributor's verified GitHub identity.
- AI tools may assist with implementation, but must not be recorded as commit co-authors.
- Do not add `Co-authored-by` / `Co-Authored-By` trailers for Claude, Claude Code, Codex, ChatGPT, OpenAI, Anthropic, or any other AI client.
- Do not mention the client used to create a change in the commit message solely for attribution.
- Before creating or amending a commit, inspect its metadata and remove any AI-client attribution trailer.
- This policy applies to commit metadata only; documentation may mention AI products when relevant.

CI runs a `commit-attribution` check that rejects these trailers and identities on pull requests. The repo also has a husky `pre-commit` hook.

## Philosophy (from CONTRIBUTING.md)

- **StepCode's core is minimal.** If a feature does not belong in the core, make it an extension. PRs that bloat the core will likely be rejected. Even hook points for extensions should be considered and discussed first to avoid unmaintainable bloat.
- **The One Rule: you must understand your code.** If you cannot explain what your changes do and how they interact with the rest of the system, the PR will be closed. Using AI to write code is fine; submitting AI-generated slop without understanding it is not.
- Run agents from the repository root so they pick up `AGENTS.md` automatically.

## Pre-PR gate

Both must pass before submitting a PR:

```bash
npm run check
./test.sh
```

`npm run check` is pnpm-driven and chains: `biome check --write --error-on-warnings`, then architecture/boundary scripts — `check:pinned-deps`, `check:ts-imports`, `check:layer-direction`, `check:ui-layer`, `check:workspace-registry`, `check:tui-no-ai`, `check:coding-agent-entry-freeze`, `check:contracts-deps-empty`, `check:derived-compat-only`, `check:no-provider-dispatch`, `check:metadata-not-in-dispatch`, `check:no-secret-leak`, `check:legacy-scope-prefix`, `check:no-observability`, `check:public-boundary` — then `tsgo --noEmit` and `check:browser-smoke`.

`./test.sh` runs non-LLM tests (no API keys needed). `npm test` runs everything. Single file: `npm test -- test/specific.test.ts`.

## Issues (agents: read before touching the tracker)

- Use one of the two GitHub issue templates; keep issues short, concrete, worth reading (one screen max).
- State the bug/request and why it matters; write in your own voice; LLM-generated text must be clearly AI-labeled.
- Issues filed Friday–Sunday are not guaranteed to be reviewed.
- **Blocking policy**: ignoring this document twice, spamming the tracker, or sending a large volume of automated issues leads to permanent account blocking. Agents must never bulk-open issues.

## Public boundary (from docs/open-source-status.md)

This repository is the public source view of StepCode. It intentionally excludes: protected release tag creation, binary/manifest uploads to object storage, release announcements through private services, private observability, and private endpoints.

Rules for agents:

- Never reintroduce private CI/release paths, private hostnames, object-store SDKs, or private CI variables to make a check pass.
- `scripts/check-public-boundary.mjs` runs as part of `pnpm run check` (self-test included in `test:scripts`).
- When adding release/CI integration: keep the public/local part in this tree; credentials, protected tag operations, and publication steps belong to the separate release environment.
- `infra/release/release-bundle.mjs` only builds local archives/checksums/manifests — it does not upload or publish.

## Build & development workflow (from packages/coding-agent/docs/development.md)

- Node >= 22.19.0 (root `package.json` `engines`); pnpm 9.15.9 workspaces.
- `npm install` → `npm run build`; offline variant `npm run build:offline`.
- Run from source: `NODE_OPTIONS=--no-node-snapshot /path/to/step-test.sh` (tsx + repo tsconfig; keeps caller's cwd; works without building workspace packages).
- Path resolution: always use `src/config.ts` helpers (`getPackageDir`, `getThemeDir`) for package assets — never `__dirname` directly (three execution modes: npm install, standalone binary, tsx from source).
- Workflow sandbox (editing `src/features/workflow/vm.ts`): keep the `singlefile` QuickJS variant; release every handle before disposing, dispose the context before the runtime (else the cached WASM instance is poisoned process-wide). Guest scripts have no `process`/`require`/`fetch`/wall clock/randomness and run under memory cap + timeout.
- Forking/rebranding: configure `piConfig` (`name`, `configDir`, `bin`) in `package.json`; in code use `CONFIG_DIR_NAME` instead of hardcoding `.stepcode`.
- Debug: hidden `/debug` writes rendered TUI lines and last LLM messages to `~/.stepcode/agent/step-debug.log`.
- Adding a provider to `packages/providers`: prefer `createProvider()` or a `models.json` declaration (the public build ships no built-in catalog). Full 8-step checklist (types → API impl → model generation → factory → tests → coding-agent integration → docs → CHANGELOG) in `packages/providers/README.md`.
