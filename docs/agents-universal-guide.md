# Step Code 通用 Agent 规范（All-Agents Guide）

> **适用对象**：任何在本仓库（或基于 StepCode 做插件 / Skill / 扩展开发）中工作的 AI Agent —— AGENTS.md、CLAUDE.md、ZCode、Codex、Cursor、Claude Code 等一律适用。
>
> **来源**：本仓库 `AGENTS.md`、`CLAUDE.md`、`CONTRIBUTING.md`、`docs/*`、`packages/coding-agent/docs/*` 与 `packages/coding-agent/src/step/plugins.ts` 的汇总整理。本文是 Fork 新增的导航文档；冲突时以各权威文件与源码为准（索引见文末附录）。
>
> **配套**：同内容的通用 skill 封装在 [`skills/stepcode-dev/`](../skills/stepcode-dev/)，可装入 StepCode / ZCode / Claude Code（安装方式见 §11）。

---

## 1. 四条铁律（先读这个）

1. **提交署名纪律（AGENTS.md）**：Git author/committer 必须是人类贡献者的已验证 GitHub 身份。**禁止**添加 `Co-authored-by` / `Co-Authored-By` trailer 指向 Claude、Claude Code、Codex、ChatGPT、OpenAI、Anthropic 或任何 AI 客户端；禁止在 commit message 里为署名目的提及所用客户端。提交/修正前要检查提交元数据并移除 AI 署名。产品文档里提及 AI 产品不受此限。
2. **最小内核（CONTRIBUTING）**：StepCode core 刻意保持最小。功能能做成扩展（extension）/ 插件（plugin）/ Skill 的，**不要**塞进 core；膨胀 core 的 PR 大概率被拒。为扩展加 hook 点也要克制、先讨论。
3. **你必须理解你的代码（CONTRIBUTING "The One Rule"）**：解释不清改动做什么、如何与系统交互的 PR 会被直接关闭。用 AI 写代码可以，提交不理解的 AI slop 不行。
4. **公共边界（docs/open-source-status.md）**：本仓库是 StepCode 的公开源码视图。**不得**引入私有 CI/发布路径、私有主机名、对象存储 SDK、私有 CI 变量或凭据；发布凭据与受保护 tag 操作属于独立发布环境。`pnpm run check` 里的 `check:public-boundary` 会扫描拦截。

## 2. 提交与 PR 规范

- **提交前必须通过**：
  ```bash
  npm run check     # 实际由 pnpm 驱动，见 package.json
  ./test.sh         # 非 LLM 测试（无需 API key）
  ```
  `npm run check` 串联：biome（`--error-on-warnings`）、pinned-deps、ts 相对导入检查、layer-direction、ui-layer、workspace-registry、tui-no-ai、coding-agent-entry-freeze、contracts-deps-empty、derived-compat-only、no-provider-dispatch、metadata-not-in-dispatch、no-secret-leak、legacy-scope-prefix、no-observability、**public-boundary**、`tsgo --noEmit`、browser-smoke。
- **Issue 规范**：必须用仓库的两个 issue 模板；简短、具体、一屏内；用自己的话（不要 LLM 代写；若必须用，需明确标注 AI）；说明 bug/需求与影响；周五至周日提交的 issue 不保证及时审阅。**Agent 注意：绝不批量自动化提交 issue** —— 大量自动化 issue 会被永久封号。
- 仓库有 husky pre-commit 与 CI（commit-attribution 检查会拒绝 AI 署名 trailer）。

## 3. 构建与开发工作流

- **环境**：Node ≥ 22.19.0（`engines`），包管理 pnpm@9.15.9（workspaces：`apps/*`、`packages/*` 等）。
- **安装/构建**：`npm install` → `npm run build`（离线环境用 `npm run build:offline`）。
- **从源码运行**：`NODE_OPTIONS=--no-node-snapshot /path/to/step-test.sh`（tsx 直跑源码，不依赖构建产物；保持调用方 cwd）。
- **测试**：
  ```bash
  ./test.sh                          # 非 LLM 测试
  npm test                           # 全量
  npm test -- test/specific.test.ts  # 指定文件
  ```
- **路径解析**：包内资产一律用 `src/config.ts` 的 `getPackageDir()` / `getThemeDir()`，**不要**直接用 `__dirname`（三种执行形态：npm 安装、独立二进制、tsx 源码）。
- **Workflow 沙箱约束**（改 `src/features/workflow/vm.ts` 时）：保持 QuickJS `singlefile` 变体（`wasmfile` 在编译产物里没有磁盘 .wasm 可载）；先释放全部 handle → dispose context → 再 dispose runtime，顺序错了会毒化全进程的缓存实例。Guest 脚本无 `process`/`require`/`fetch`/墙钟/随机数，受内存上限与超时约束。
- **Fork / 换牌**：改 `package.json` 的 `piConfig`（`name`/`configDir`/`bin`）；代码里用 `CONFIG_DIR_NAME` 构造项目级路径，**禁止硬编码 `.stepcode`**。
- **调试**：`/debug`（隐藏命令）写 `~/.stepcode/agent/step-debug.log`（TUI 渲染行 + 发给 LLM 的最后消息）。
- **新增 LLM provider**：公开版不内置 provider 目录，推荐路径是 `createProvider()` 或 `models.json` 声明，不改包；若必须改 `packages/providers`，按其 README 的 8 步清单走（types → api 实现 → 模型生成 → 工厂 → 测试 → coding-agent 集成 → 文档 → CHANGELOG）。

## 4. 统一配置 `config.toml`

- 全局 `~/.stepcode/config.toml`（首次运行自动创建）；项目级 `<cwd>/.stepcode/config.toml` **可选**，缺失不告警，受**项目信任门控**。旧的 `settings.json` / `step-settings.json` 已退役：不再读写、不再进信任提示；旧文件里的设置需手工迁移。
- TOML 不支持 null（写入前剥离）；重写时保留文件头部注释。
- `~/.stepcode/` 主要落点：

  | 文件/目录 | 用途 |
  | --- | --- |
  | `config.toml` | ★ 统一配置：Pi 原生设置 + Step 产品设置 + `[mcp_servers]` |
  | `auth.json` | ★ Step provider 凭据（0600），`step login` 写入 |
  | `models.json` | ★ 模型目录/覆盖 |
  | `.credentials.json` | ★ MCP OAuth 令牌（0600），key = `<name>\|<url>` |
  | `workspace-trust.json` / `agent/trust.json` | 项目信任决策 |
  | `plugins/`、`marketplaces/`、`skills/`、`sessions/`、`logs/`、`telemetry/`、`bin/` | 插件、市场、技能、会话、日志、遥测、可执行 |
  | `agent/extensions/`、`agent/prompts/` | 全局扩展、自定义 prompts |
- **环境变量**：`STEP_CODING_AGENT_DIR` 选 agent 目录、`STEP_CODING_AGENT_SESSION_DIR` 选会话存储（名字固定）；`STEPCODE_APP_NAME` 只改显示名，**不**切换存储路径/命令/provider；CLI 设置 `AI_AGENT=step`。
- 已知限制：`oauth.scopes` 尚未接入；`/mcp` 快照是进程级全局；`step mcp list|get --json` 不脱敏。

## 5. MCP 规范

- 声明位置：全局 `config.toml` 的 `[mcp_servers.<name>]`，再叠加插件目录里的声明。`enabled = false` 在发现阶段即跳过。传输：`command` → stdio，`url` → HTTP。
- 工具级过滤 `enabled_tools` / `disabled_tools` 在进入注册表**之前**生效——这是安全控制，不是提示词约束。
- 鉴权：`bearer_token_env_var`（→ `Authorization: Bearer $FOO`）、`http_headers`（字面量）、`env_http_headers`（值是**环境变量名**，取不到直接报错，绝不静默省略）。
- 超时：启动 30s / 工具调用 300s，可用 `startup_timeout_sec` / `tool_timeout_sec` 覆盖。
- CLI（参数校验失败一律 exit 1）：

  | 命令 | 说明 |
  | --- | --- |
  | `step mcp list [--json]` / `get <name>` / `remove <name>` | 查删 |
  | `step mcp add <name> --url <url> [--bearer-token-env-var VAR]` | HTTP 服务器 |
  | `step mcp add <name> [--env K=V]... -- <command> [args...]` | stdio 服务器；`--` 之后全部是服务器自身 argv，扫描不越过 `--` |
  | `step mcp login <name>` / `logout <name>` | OAuth 登录/清除凭据 |

  禁止：`--url` 与 command 同给；`--env` 用在 `--url` 服务器上（那是进程环境变量，不是 HTTP 头）。
- 交互：`/mcp` 显示 `connecting / connected / failed / disabled` 与工具数。TUI 后台并行连接不阻塞首帧；print/RPC 会话仍等完整初始目录。启动 401/SDK 鉴权错误 → 提示 `step mcp login <name>`，登录后**重启**才重连。
- OAuth：动态客户端注册 + PKCE + 本地回调；凭据落 `.credentials.json`；声明了 `oauth.callback_port` 就必须用该端口。

## 6. 命令权限模型

共享命令分析（unbash 解析器 + 命令策略）对每次 bash 工具调用给出三种结果，权限按此矩阵执行：

| 分析结果 | Ask / Bypass / Autopilot | Read-only | 无审批通道 |
| --- | --- | --- | --- |
| 内置危险规则命中 | 每次调用都确认 | 拒绝 | 拒绝 |
| 无法完全分析（语法/可执行输入不确定） | 每次确认并解释不确定性 | 拒绝 | 拒绝 |
| 完成分析且无规则命中 | 普通 preset/工具策略 | 普通只读策略 | 普通无人值守策略 |

- **`recursive-force-remove` 内置规则不可绕过**：`rm` 同时带递归（`-r/-R/--recursive`）与强制（`-f/--force`）时，任何 preset、工具覆盖、bypass/autopilot 都必须逐次确认；只读模式拒绝；无审批通道时即使 `nonInteractiveApproval = "allow"` 也不能执行。
- **未完成分析 ≠ 允许**：`isDangerousCommand()` 只是检测查询，不是授权 API；语法解析不完整时不得放行，也无 parse-error-to-allow 回退路径。Bash 是唯一获得"确定性安全"判定的语法；PowerShell/fish/zsh/ksh/sh/dash 一律保守处理。
- 扩展点：`COMMAND_APPROVAL_RULES` 含类型化命名规则——`shell` 谓词消费分析后的命令名与参数，`pattern` 规则保留保守的原文匹配（文件系统/设备、Git、SQL 危险）。
- 改权限规则必须同时测：可执行形态、纯数据对照、未完成分析三类；不得把未执行分支当惰性数据、不得把 unresolved 当解析成功。
- 该策略跑在 `tool_call` hook（`packages/coding-agent/src/step/permissions.ts`）；客户端只渲染确认请求，不另搞策略。用户 `!` 手输命令走 `user_bash` 事件，不在本策略内。

## 7. Skill 开发规范（Agent Skills 标准）

Skill 是按需加载的自包含能力包（指令 + 脚本 + 参考 docs），实现 [agentskills.io](https://agentskills.io/specification) 标准，渐进式披露：启动只把 name+description 放进系统提示词，任务匹配时 agent 用 `read` 读全文。Step 允许 name 与父目录名不同（比标准宽松）。

**结构**：

```
my-skill/
├── SKILL.md              # 必需：frontmatter + 指令
├── scripts/              # 辅助脚本（SKILL.md 内用相对路径引用）
├── references/           # 按需加载的详细文档
└── assets/
```

**Frontmatter**：

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `name` | 是 | ≤64 字符；小写字母/数字/连字符；不得以连字符开头结尾、不得连续连字符（如 `pdf-processing` ✔，`PDF-Processing`、`-pdf`、`pdf--processing` ✘）。Step 不要求与目录同名 |
| `description` | 是 | ≤1024 字符；**决定 agent 何时加载它**，要具体（"Extracts text and tables from PDF files… Use when working with PDF documents." ✔；"Helps with PDFs." ✘） |
| `license` / `compatibility`（≤500）/ `metadata` / `allowed-tools`（实验） / `disable-model-invocation` | 否 | `disable-model-invocation: true` = 对模型隐藏，只能 `/skill:name` 调 |

**加载位置**：

- 全局：`~/.stepcode/agent/skills/`、`~/.agents/skills/`
- 项目（信任后）：`.stepcode/skills/`、祖先目录的 `.agents/skills/`（至 git 根）
- 包：`skills/` 目录或 `package.json` 的 `pi.skills`
- 设置：`skills` 数组（文件或目录，可引其他 harness 的目录如 `~/.claude/skills`）
- CLI：`--skill <path>`（可重复；`--no-skills` 关闭发现但 `--skill` 仍加载）

**发现规则**：含 `SKILL.md` 的目录递归发现；`~/.stepcode/agent/skills/` 与 `.stepcode/skills/` 的根级 `.md`（有合法 frontmatter + 非空 description）按独立 skill 发现；`.agents/` 位置忽略根级 `.md` 但发现分组目录内的嵌套 `.md`；同名冲突警告并保留先发现的。

**校验**：命名/长度问题多数只警告仍加载；缺 description、frontmatter 损坏的 SKILL.md **不加载**；未知字段忽略。

**调用**：`/skill:name [args]`（args 以 `User: <args>` 追加到 skill 内容后）；`settings` 的 `enableSkillCommands: true` 开关；模型不一定主动读 SKILL.md，需要时用提示词或 `/skill:name` 强制。

## 8. 插件开发规范（`step.plugin.json`）

插件是**声明式清单**：装进插件目录后由 Step 运行时启动 MCP 进程；市场契约刻意比 Pi 的包管理器小（不执行安装期脚本）。

**Manifest**（`step.plugin.json`，≤512KB；兼容 Claude Code 的 `.claude-plugin/plugin.json`：`name`→`id` 归一，自动探测 `.mcp.json` 与 `skills/` `commands/` `agents/` 目录）：

| 字段 | 说明 |
| --- | --- |
| `id` | **必需**。safe name：`/^[a-z0-9][a-z0-9._-]*$/i` 且非 `.`/`..` |
| `name` / `description` / `version` | 展示信息（字符串） |
| `entry` | 可执行扩展入口——**仅记录，市场门面不加载执行** |
| `skills` / `agents` / `commands` | 包内相对路径数组（不得逃逸包目录、不得绝对路径） |
| `mcpServers` | 对象：`{ "<server>": { command, args?, env? } }`；或**包内声明文件的相对路径**（如 `.mcp.json`） |
| `provision` | `{ command, installer?, requiresEnv?: string[] }`；仅内置市场且 `installer: "steppageInstaller"` 会自动装可执行（**win32 跳过**）；`requiresEnv` 缺失会给出 `/login` 或 export 指引 |

**安装位置与优先级**：用户级 `<storage-root>/plugins/`、项目级 `.stepcode/plugins/`；同 id **项目优先**，被忽略方有警告。重名/不安全名拒绝安装。

**Marketplace**：清单在 `.step-plugin/marketplace.json`（兼容 `.claude-plugin/marketplace.json`），格式 `{ name, description, plugins: [{ name, description?, source: "./相对目录" }] }`。来源支持 git URL / `owner/repo` / 本地路径（克隆 `--depth 1`）；`source` 必须在 checkout 内；远程托管型 source 条目本运行时取不到、不列出；`lspServers` 声明不被托管（安装时警告跳过）。内置市场 `builtin`（playwright、steppage）随 CLI 分发，不可更新/删除；steppage 预装（一次性 marker，卸载后不复活）。

**命令面**：`/plugin [list|browse|install <name>|remove <name>]`、`/plugin marketplace [list|add <git-url|owner/repo|path>|update <name>|remove <name>]`。**MCP 服务器在 Step 重启后才启动**——装完必须重启。

## 9. 扩展（Extensions）开发规范

扩展是 TS 模块（jiti 直载，无需编译），可订阅生命周期事件、注册工具/命令/快捷键/CLI flag、注入消息、自定义渲染与压缩。与插件分工：**扩展写代码逻辑，插件做声明式分发（MCP 等）**。

**位置**：全局 `~/.stepcode/agent/extensions/*.ts`（或 `*/index.ts`）；项目 `.stepcode/extensions/`（信任后加载）；快速测试 `step -e ./x.ts`；分发用 step packages（见下）。自动发现位置的扩展支持 `/reload` 热重载。

**形态**：默认导出工厂 `(pi: ExtensionAPI) => void | Promise<void>`；异步工厂会 await 完再继续启动（适合拉远程模型目录 + `pi.registerProvider()`）。**不要在工厂里启动常驻资源**（进程/socket/定时器）——工厂可能在不开会话的调用里运行；资源启动推迟到 `session_start` 或用到它的命令/工具，并注册幂等的 `session_shutdown` 清理。

**可用导入**：`@step-harness/coding-agent`（类型）、`typebox`（参数 schema）、`@step-harness/providers`（`StringEnum` 等）、`@step-harness/pi-tui`（TUI 组件）、node 内建；npm 依赖放扩展旁 `package.json` 的 `dependencies`。

**关键事件**（完整图见 `packages/coding-agent/docs/extensions.md`）：

- 启动序：`project_trust`（仅全局/CLI 扩展参与，返回 `{trusted: "yes"|"no"|"undecided", remember?}`）→ `session_start` → `resources_discover`（可贡献 skillPaths/promptPaths/themePaths）。
- 每轮：`before_agent_start`（可注入 message、链式改 systemPrompt）→ `turn_start` → `context`（改消息非破坏性）→ provider 前后 hook（headers 可原地改）→ 工具循环 → `turn_end` → `agent_end` / `agent_settled`（需要"不再自动继续"语义的用 settled）。
- `tool_call`：**可拦截**。`event.input` 原地改即生效（不改验证）；返回 `{block: true, reason?, terminate?}` 阻断；并行模式下不保证看到同批兄弟调用的结果。
- `tool_result`：**可修改**，处理器链式中间件（看到上一个处理器的最新结果；返回局部补丁即可）；嵌套异步用 `ctx.signal`。
- `input`：返回 `continue` / `transform`（改 text 后继续）/ `handled`（跳过 agent，首个 wins）。顺序：扩展命令 → input → `/skill:` → `/template` → agent。
- `user_bash`：`!`/`!!` 命令可换后端/整体替换。

**ctx 要点**：`ctx.hasUI`（print/json 为 false，弹窗前必须判）与 `ctx.mode`（`tui/rpc/json/print`，TUI 专属能力用 mode 判）；`ctx.isProjectTrusted()` 读项目配置前先问；`ctx.sessionManager` 只读；`ctx.signal` 仅活跃 turn 期间有值；`ctx.shutdown()` 优雅退出；`ctx.getContextUsage()` / `ctx.compact()` / `ctx.getSystemPrompt()`。命令上下文额外有 `waitForIdle/newSession/fork/navigateTree/switchSession/reload/getSystemPromptOptions`。

**注册 API 要点**：

- `pi.registerTool()`：load 后也可调（即时生效）。`promptGuidelines` 的每条 bullet **必须点名工具**（"Use my_tool when…"，不能写 "this tool"）。`prepareArguments` 做兼容整形（schema 校验前）。`renderCall/renderResult` 自定义渲染。
- `pi.registerCommand()`：重名共存，按加载序加后缀 `/review:1`；可带 `getArgumentCompletions`。
- `pi.sendMessage()`（进 LLM 上下文，`deliverAs: steer|followUp|nextTurn`）vs `pi.appendEntry()`（仅持久化+TUI 渲染，不进上下文）——配对使用 `registerMessageRenderer` / `registerEntryRenderer`。
- `pi.sendUserMessage()`：等价用户输入，总是触发 turn；流式中必须给 `deliverAs`。
- `pi.exec()`、`pi.setActiveTools()`、`pi.setLabel()`、`pi.setSessionName()`。
- `/reload` 语义：`await ctx.reload()` 之后旧实例状态全部失效，**把 reload 当 handler 终点**（`await ctx.reload(); return;`）；工具不能直接 reload，要经命令 + `sendUserMessage("/cmd", {deliverAs:"followUp"})`。
- 会话替换 footgun：`withSession` 回调里**只用传入的新 ctx**；替换前捕获的 `sessionManager`/旧 ctx 已失效会抛错。

**分发（step packages）**：`step install npm:@foo/bar@1.2.3 | git:github.com/user/repo@v1 | /local/path`（写用户或 `-l` 项目设置；git ref 固定不自动漂移）。包在 `package.json` 用 `pi` 清单声明 `extensions/skills/prompts/themes`（支持 glob 与 `!` 排除；无清单时按约定目录自动发现）；发 npm 加 `pi-package` keyword。运行时依赖放 `dependencies`（安装时 `npm install --omit=dev`）；导入核心包则列 `peerDependencies: "*"` 且不打进包：`@step-harness/providers`、`@step-harness/agent-core`、`@step-harness/coding-agent`、`@step-harness/pi-tui`、`typebox`。设置里可用对象形式过滤加载；全局+项目同时声明时项目胜（除非项目条目 `autoload: false` 作增量）。

## 10. Agent 行为清单（速查）

**写代码/提交前**：理解改动 → `npm run check` + `./test.sh` → 提交元数据无 AI 署名 → 不碰公共边界（无私有 CI/凭据/主机名）→ 功能进 core 前先想扩展形态。
**写 Skill**：合法 frontmatter（name 规则 + 具体 description）→ 相对路径引用脚本 → 装到匹配的 skills 目录 → 用 `/skill:name` 验证。
**写插件**：`step.plugin.json`（id 是 safe name）→ mcpServers 声明合法（command 必填）→ 装入 `plugins/` → **重启** → `/plugin list` 核对 → 诊断警告逐条清零。
**写扩展**：默认导出工厂 → 工厂内不启常驻资源 → `session_shutdown` 清理 → `hasUI/mode` 守卫弹窗 → 项目配置先 `isProjectTrusted()` → `/reload` 后不留旧状态依赖。
**永远不要**：自动批量提 issue；把 `rm -rf` 类命令当可自动放行；硬编码 `.stepcode`；在工厂里 await 无界后台任务。

## 11. 跨 harness 安装（本指南与 skill 的通用性）

`skills/stepcode-dev/` 是标准 Agent Skills 格式，同一份包可装进：

| Harness | 全局 | 项目 |
| --- | --- | --- |
| StepCode | `~/.stepcode/agent/skills/` 或 `~/.agents/skills/` | `.stepcode/skills/` 或 `.agents/skills/`（信任后） |
| ZCode | `~/.zcode/skills/` 或 `~/.agents/skills/` | `<repo>/.zcode/skills/` 或 `.agents/skills/` |
| Claude Code | `~/.claude/skills/` | `.claude/skills/`；StepCode 侧可在 settings `skills` 数组引用该目录 |

`~/.agents/skills/` 是 StepCode 与 ZCode 共同读取的跨工具位置，推荐作为通用安装点。也可不改文件、直接在 StepCode 的 `config.toml`（settings `skills` 数组）里引用本仓库路径：`"skills": ["E:/Project/Step-Code/skills/stepcode-dev"]`。

## 附录：权威规范文件索引

| 主题 | 文件 |
| --- | --- |
| 提交署名 / Agent 指令 | `AGENTS.md`、`CLAUDE.md` |
| 贡献哲学 / Issue / PR 门槛 | `CONTRIBUTING.md` |
| 公共边界 | `docs/open-source-status.md`（`scripts/check-public-boundary.mjs`） |
| 统一配置 / 目录布局 / MCP 启动 | `docs/step-configuration.md`、`docs/step-unified-config-and-mcp.md` |
| 命令权限 | `docs/command-permissions.md` |
| Skill 格式 | `packages/coding-agent/docs/skills.md`（标准：agentskills.io） |
| 插件 / 市场 | `packages/coding-agent/src/step/plugins.ts`、`plugins/.step-plugin/marketplace.json`、`plugins/*/step.plugin.json` |
| 扩展 API | `packages/coding-agent/docs/extensions.md`（3018 行权威文档） |
| 包分发 | `packages/coding-agent/docs/packages.md` |
| 开发工作流 / 沙箱 / 换牌 | `packages/coding-agent/docs/development.md` |
| Provider 扩展清单 | `packages/providers/README.md` |
| 构建脚本 | `package.json`（check/test 全量清单） |
