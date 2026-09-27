# StepCode Skills Format (Agent Skills standard)

Skills are self-contained capability packages loaded on demand (progressive disclosure: only name + description live in the system prompt; the full SKILL.md is read when the task matches). StepCode implements the [Agent Skills standard](https://agentskills.io/specification) leniently — most violations warn but still load. Authoritative doc: `packages/coding-agent/docs/skills.md`.

## Structure

```
my-skill/
├── SKILL.md              # Required: frontmatter + instructions
├── scripts/              # Helper scripts
├── references/           # Detailed docs loaded on demand
└── assets/
```

Reference scripts and assets from SKILL.md with **relative paths** (e.g. `See [the guide](references/GUIDE.md)`).

## SKILL.md frontmatter

```markdown
---
name: my-skill
description: What this skill does and when to use it. Be specific.
---
```

| Field | Required | Limits / notes |
| --- | --- | --- |
| `name` | yes | 1–64 chars; lowercase a–z, 0–9, hyphens; no leading/trailing hyphen; no consecutive hyphens. Valid: `pdf-processing`, `data-analysis`. Invalid: `PDF-Processing`, `-pdf`, `pdf--processing`. Step does NOT require name == parent directory (deviates from the standard, on purpose, for shared skill dirs) |
| `description` | yes | ≤ 1024 chars. **This decides when the agent loads the skill.** Good: "Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents." Poor: "Helps with PDFs." |
| `license` | no | License name or reference to bundled file |
| `compatibility` | no | ≤ 500 chars, environment requirements |
| `metadata` | no | Arbitrary key-value mapping |
| `allowed-tools` | no | Space-delimited pre-approved tools (experimental) |
| `disable-model-invocation` | no | `true` hides the skill from the system prompt; only `/skill:name` invokes it |

Unknown fields are ignored.

## Validation behavior

- Warning + still loads: name too long / invalid chars / hyphen placement; description > 1024 chars.
- **Not loaded**: missing `description`, malformed YAML/frontmatter.
- Silently ignored: non-SKILL.md root Markdown files that don't look like skills.
- Name collisions: warning, first skill found wins.

## Locations

- Global: `~/.stepcode/agent/skills/`, `~/.agents/skills/`
- Project (only after trust): `.stepcode/skills/`, and `.agents/skills/` in cwd + ancestor dirs (up to git root)
- Packages: `skills/` directories or `pi.skills` entries in `package.json`
- Settings: `"skills": [...]` array of files/directories (use it to consume other harnesses' dirs, e.g. `"~/.claude/skills"`)
- CLI: `--skill <path>` (repeatable, still loads with `--no-skills`)

Discovery rules:
- Directories containing `SKILL.md` are discovered recursively in every location.
- In `~/.stepcode/agent/skills/` and `.stepcode/skills/`, root-level `.md` files with valid frontmatter + non-empty description are individual skills.
- In `~/.agents/skills/` and project `.agents/skills/`, root `.md` files are ignored, but nested `.md` files inside grouping folders with frontmatter are discovered.

## Invocation

- Auto: the agent reads SKILL.md when the task matches (not guaranteed — force with prompting or `/skill:name`).
- Manual: `/skill:name [args...]` — args are appended to the skill content as `User: <args>`.
- Toggle commands via settings `"enableSkillCommands": true` or `/settings`.
- Disable discovery: `--no-skills` (explicit `--skill` paths still load).

## How skills work at runtime

1. Startup: scan locations, extract names + descriptions.
2. System prompt lists skills in XML per the agentskills.io integration spec.
3. On match: agent reads the full SKILL.md via `read`.
4. Agent follows instructions, referencing scripts/assets by relative path.

## Distribution

- As a step package: put `SKILL.md` folders under `skills/` and declare `"pi": { "skills": ["./skills"] }` in `package.json` (or rely on convention dirs); see packages.md rules (`dependencies` for runtime deps, `peerDependencies: "*"` for the five core packages).
- Cross-harness: `~/.agents/skills/` is read by both StepCode and ZCode — the universal install point. Claude Code uses `~/.claude/skills/` (StepCode can consume it via the settings `skills` array).

## Security note

Skills can instruct the model to perform any action and may bundle executable code. Review skill content before installing third-party skills.
