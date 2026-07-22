# CLI 工具指南

> `apps/cli/`(`@ihui/cli`)是 IHUI-AI 平台的命令行 AI 编码代理,对标 Claude Code / Codex,提供交互式 REPL、自主多步 Agent、24 源配置导入、subagent 并行协作、skills/plugins 扩展、MCP 工具集成、ACP 协议嵌入等能力,跨平台运行(Windows / macOS / Linux)。

---

## 总览

`ihui` CLI 是一个 TS 编写的 AI 编码代理,定位为"开发者工位上的智能搭档",核心能力:

- **交互式 REPL**:多轮对话 + 工具调用循环,支持 `--json` Headless 模式(CI/CD 友好)
- **自主 Agent**:单条命令驱动多步任务,带权限守卫、检查点、撤销重做
- **24 源配置导入**:从 Claude Code / Codex / Cursor / Windsurf 等 24 个 AI 工具的本地配置一键导入供应商
- **subagent 并行**:fork 子进程真并行,4 种协作拓扑(star / mesh / chain / hierarchical)
- **skills / plugins**:四级目录平面加载 skills + 插件市场 + 工具 / 钩子 / 命令扩展
- **多端嵌入**:ACP 协议嵌入 Zed / VSCode / Cursor;server 模式供手机 / 网页远程驱动

完整源码位于 `apps/cli/src/`(50+ 子目录),测试位于 `apps/cli/tests/`。

- 包结构总览见 [PACKAGES.md](./PACKAGES.md)。
- 多端协同与 8 端定位见 [MULTI_END.md](./MULTI_END.md)。
- 发布流程见 [RELEASE.md](./RELEASE.md)。

### 关键依赖

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| `commander` | ^12.1.0 | 命令行参数解析 + 子命令 |
| `chalk` | ^5.3.0 | 终端着色 |
| `inquirer` | ^12.3.0 | 交互式提示 |
| `ora` | ^8.1.0 | 加载动画 |
| `ws` | ^8.18.0 | WebSocket(server / remote 模式) |
| `vscode-jsonrpc` / `vscode-languageclient` | ^8.2.1 / ^9.0.1 | ACP / LSP 协议 |
| `@agentclientprotocol/sdk` | ^1.2.1 | Agent Client Protocol |
| `gpt-tokenizer` | ^3.4.0 | token 计数(上下文压缩) |
| `dotenv` | ^16.4.7 | `.env` 加载 |

要求 Node ≥ 20.10.0。

---

## 安装与启动

### 方式一:开发模式(源码运行)

```bash
# 克隆仓库后
pnpm install
pnpm --filter @ihui/cli dev          # tsx 直跑源码,无需构建

# 或构建后运行
pnpm --filter @ihui/cli build
node apps/cli/dist/index.js
```

### 方式二:npm 全局安装

```bash
npm install -g @ihui/cli
ihui --version
```

### 方式三:4 包管理器分发(跨平台)

`deploy/` 下提供 4 套包管理器清单,发布流程见 [RELEASE.md](./RELEASE.md):

| 平台 | 工具 | 清单文件 | 安装命令 |
| --- | --- | --- | --- |
| Windows | winget | `deploy/winget/IHUI.IHUI.yaml` | `winget install IHUI.IHUI` |
| Windows | scoop | `deploy/scoop/ihui.json` | `scoop install ihui` |
| macOS / Linux | Homebrew | `deploy/homebrew/ihui.rb` | `brew tap ihui/ihui && brew install ihui` |
| Linux | Snap | `deploy/snap/snapcraft.yaml` | `sudo snap install ihui --classic` |

> winget 与 scoop 提供 x64 + arm64 双架构;Homebrew 依赖 `node@22`;Snap 基于 `core22` + `node/22/stable`,`confinement: classic`。

### 方式四:预编译二进制(GitHub Release)

`release-cli.yml` workflow 在 `cli-v*` tag 推送时构建 6 个二进制包(linux/macos/windows × x64/arm64),从 [GitHub Releases](https://github.com/IHUI-INF-AI/IHUI-AI/releases) 下载解压即可。

---

## 命令体系

`ihui` 基于 commander 构建,主命令带全局选项,子命令按功能分组。

### 全局选项

| 选项 | 说明 | 默认值 |
| --- | --- | --- |
| `-m, --model <id>` | 模型 ID | `default` |
| `-w, --workspace <path>` | 工作区路径 | `process.cwd()` |
| `--max-iterations <n>` | 最大工具循环次数 | `25` |
| `--max-turns <n>` | `--max-iterations` 别名(对齐 OpenAI o1/o3 术语) | — |
| `--api-url <url>` | 后端 API 地址 | `http://localhost:8803` 或 `IHUI_API_URL` |
| `--api-key <key>` | API 密钥(建议用 `IHUI_API_KEY` 环境变量) | — |
| `--resume <session-id>` | 恢复指定会话 | — |
| `--continue` | 继续最近会话 | — |
| `--json` | Headless 模式:输出 NDJSON 事件流(非 TTY 自动启用) | — |
| `--output-format <fmt>` | 输出格式:`text\|json\|markdown\|yaml` | `text` |
| `--mcp` | 启用 MCP 工具(从 `~/.ihui/mcp.json` 加载) | — |
| `--allow-dangerous` | 允许危险工具自动执行(默认拒绝) | — |
| `--plan` | 强制 Agent 先输出任务规划再执行 | — |
| `--temperature <n>` | LLM 温度(0-2) | — |
| `--max-tokens <n>` | 最大生成 token 数 | — |
| `--locale <l>` | 界面语言:`zh-CN\|en\|ja\|ko\|zh-TW` | `IHUI_LOCALE` 或 settings |
| `-f, --prompt-file <path>` | 从文件读取 prompt(支持超长 PRD) | — |
| `--tools <list>` | 工具白名单(逗号分隔) | — |
| `--disallowed-tools <list>` | 工具黑名单(逗号分隔) | — |
| `--permission-mode <m>` | 权限模式:`default\|acceptEdits\|bypassPermissions\|plan\|manual` | `default` |
| `--no-update-check` | 禁用启动时版本检查(默认每 24h 检查 npm) | — |

### 主命令与子命令

| 命令 | 说明 | 实现文件 |
| --- | --- | --- |
| `ihui [prompt]` | 省略 prompt → 进入交互式 REPL;有 prompt → 直接执行任务并退出 | `commands/repl.ts` + `commands/agent.ts` |
| `ihui chat` | 进入多轮对话模式(REPL 别名) | `commands/repl.ts` |
| `ihui agent [task]` | Agent 模式:自主多步执行(支持 `--json` + `--prompt-file`) | `commands/agent.ts` |
| `ihui init` | 在当前目录创建 `AGENTS.md` 模板 | `commands/template.ts` |
| `ihui sessions` | 列出历史会话 | `commands/session.ts` |
| `ihui mcp list/add/remove` | MCP 服务器管理(stdio / http / sse) | `commands/mcp-config.ts` |
| `ihui capabilities` | 列出工具 / 钩子 / slash 命令能力 | `commands/capabilities.ts` |
| `ihui checkpoint` | 检查点管理(快照 / 回滚) | `commands/checkpoint.ts` |
| `ihui hooks` / `ihui hooks-auto` | 钩子管理 + 自动发现 5 目录 hooks | `commands/hooks.ts` + `hooks-auto.ts` |
| `ihui import sources/parse/commit/history` | 24 源配置导入 | `commands/import.ts` |
| `ihui subagent-parallel` | 并行 fork N 个子 agent | `commands/subagent-parallel.ts` |
| `ihui skills list/show` | 查看 / 列出已加载 skills | `skills/index.ts` |
| `ihui settings init/path` | 管理 `~/.ihui/settings.json` | `commands/settings.ts` |
| `ihui acp` | 启动 ACP server,供编辑器嵌入 | `acp/server.ts` |
| `ihui server` | 启动 Agent 内核 HTTP/WS server | `server/index.ts` |
| `ihui remote <url>` | 作为 TUI client 连接远程 Agent server | `client/index.ts` |
| `ihui undo [steps]` / `ihui redo [steps]` | 多步回滚 / 重做文件改动 | `commands/undo-redo.ts` |

---

## 24 源配置导入

`ihui import` 子命令从本地其他 AI 工具的配置文件导入供应商到 IHUI 账号,避免重复填写 baseUrl / apiKey。配置定义在 `apps/cli/src/commands/import.ts`,24 个合法 `source` 值:

| Source | 对应工具 | 解析的本地配置 | providerCode 示例 |
| --- | --- | --- | --- |
| `cc-switch` | cc-switch | `~/.cc-switch/config.json` | claude / openai |
| `codex++` | codex++ | `~/.codex-plus/config.toml` | openai |
| `claude-cli` | Claude CLI | `~/.claude/settings.json` | anthropic |
| `codex-cli` | OpenAI Codex CLI | `~/.codex/auth.json` + `~/.codex/config.toml` | openai |
| `gemini-cli` | Gemini CLI | `~/.gemini/settings.json` | google |
| `hermes` | Hermes | `~/.hermes/config.json` | custom |
| `env-file` | 通用 `.env` | `.env` / `.env.local` | (从 ENV 推断) |
| `cursor` | Cursor | `~/.cursor/config.json` | openai / anthropic |
| `windsurf` | Windsurf | `~/.windsurf/config.json` | openai |
| `cline` | Cline | `~/.cline/config.json` | openai |
| `aider` | Aider | `~/.aider.conf.yml` | openai |
| `trae` / `trae-work` | Trae(个人 / 工作区) | `~/.trae/config.json` | anthropic |
| `qoder` / `qoder-work` | Qoder(个人 / 工作区) | `~/.qoder/config.json` | openai |
| `codex-desktop` | Codex Desktop | `%APPDATA%/Codex/config.json` | openai |
| `claude-code-desktop` | Claude Code Desktop | `%APPDATA%/Claude/config.json` | anthropic |
| `github-copilot` | GitHub Copilot | `~/.config/gh-copilot/config.json` | github |
| `amazon-q` | Amazon Q | `~/.amazonq/config.json` | amazon |
| `continue` | Continue | `~/.continue/config.json` | openai |
| `tabnine` | Tabnine | `~/.tabnine/config.json` | tabnine |
| `cody` | Sourcegraph Cody | `~/.cody/config.json` | sourcegraph |
| `zed` | Zed | `~/.zed/settings.json` | openai / anthropic |
| `antigravity` | Antigravity | `~/.antigravity/config.json` | google |

> 设计要点:解析在**服务端**完成(`/api/user/cli-import/parse-file`),CLI 端不引入 `sql.js` / `smol-toml` 等重依赖;apiKey 等敏感字段仅在服务端处理,CLI 端只显示脱敏后的 preview。

### 导入策略

| 策略 | 说明 |
| --- | --- |
| `skip`(默认) | 同名供应商已存在则跳过 |
| `overwrite` | 同名供应商覆盖更新 |
| `clone` | 克隆为新供应商(追加后缀) |

### 调用示例

```bash
# 列出支持的导入来源
ihui import sources

# 解析本地文件并预览(不落库)
ihui import parse cursor ~/.cursor/config.json

# 解析 + 落库(默认 skip 策略)
ihui import commit cursor ~/.cursor/config.json

# 覆盖策略
ihui import commit cursor ~/.cursor/config.json --strategy overwrite

# 查询导入历史(最近 50 条)
ihui import history
```

---

## subagent 并行协作

`ihui subagent-parallel` 通过 `child_process.fork` 真并行 spawn N 个子 agent,核心实现在 `apps/cli/src/commands/subagent-collab.ts`。

### 4 种协作拓扑

| 拓扑 | 路由模式 | 适用场景 |
| --- | --- | --- |
| `star`(默认) | 主 agent 中转,所有消息经主 agent 分发 | 集中调度、强一致性 |
| `mesh` | 对等全连接,subagent 之间直接通信 | 高并发去中心化协作 |
| `chain` | 链式 handoff,A 输出传给 B,B 传给 C | 流水线式任务(调研→编码→审查) |
| `hierarchical` | 树状,按角色组长分发 | 大型任务分层委派 |

### 核心机制

| 机制 | 说明 |
| --- | --- |
| 共享黑板(blackboard) | 所有 peer 读写同一份 `Map` 状态,支持 `watch(key, handler)` 订阅变更 |
| 消息总线 | 内存 `EventTarget`(Node.js 内置),不走网络 |
| 冲突仲裁 | 多 peer 改同一文件时按策略仲裁:`last-write-wins` / `merge` / `voting` / `escalate` |
| 隔离模式 | `none`(共享工作区)/ `worktree`(git worktree 隔离,避免冲突) |
| 执行器 | `SubagentPeer.executeTask` 接受外部注入的 executor(默认 stub,主 agent 注入真实 LLM executor) |

### 5 种 persona

| Persona | 职责 |
| --- | --- |
| `researcher` | 调研、信息收集 |
| `coder` | 编码实现 |
| `reviewer` | 代码审查 |
| `planner` | 任务分解、规划 |
| `general` | 通用助手 |

### 调用示例

```bash
# star 拓扑:1 个 coder + 1 个 reviewer 并行
ihui subagent-parallel \
  --persona coder --task "重构 auth 模块" \
  --persona reviewer --task "审查 auth 改动"

# chain 拓扑:调研 → 编码 → 审查 流水线
ihui subagent-parallel \
  --persona researcher --task "调研 LangGraph API" \
  --persona coder --task "实现工作流" \
  --persona reviewer --task "审查实现" \
  --topology chain

# worktree 隔离 + 8 并发
ihui subagent-parallel \
  --persona coder --task "修 bug #1" \
  --persona coder --task "修 bug #2" \
  --persona coder --task "修 bug #3" \
  --isolation worktree --max-workers 8 \
  --json
```

> `--persona` 与 `--task` 必须成对出现(数量匹配);`--max-workers` 控制并发上限(默认 4);`--timeout` 单任务超时秒数(默认 300)。

---

## skills 系统

`apps/cli/src/skills/index.ts` + `sync.ts` 实现 skills 平面加载机制,灵感来自 Claude Code / Cursor 的 skills。

### 四级目录扫描(优先级从高到低)

| 优先级 | 目录 | 说明 |
| --- | --- | --- |
| 1(最高) | `<cwd>/.ihui/skills/*.md` | 项目本地 |
| 2 | `<cwd>/.agents/skills/*.md` | 通用 agent 社区 |
| 3 | `<cwd>/.claude/skills/*.md` | Claude Code 兼容 |
| 4 | `<cwd>/.cursor/skills/*.md` | Cursor 兼容 |
| 5 | `<repo-root>/.ihui/skills/*.md` | 仓库根(从 cwd 向上找到 `.git` 止) |
| 6(最低) | `~/.ihui/skills/*.md` | 用户全局 |

同名 skill 高优先级覆盖低优先级。只扫描 flat `*.md` 文件(不递归子目录),文件名 stem → slash 命令名。

### Skill 文件 frontmatter

```markdown
---
name: refactor-helper          # 可选,覆盖文件名 stem
description: 一句话描述          # 可选
allowed-tools: [read_file, grep]  # 可选,工具白名单
tools: [write_file]            # 等价于 allowed-tools(行业兼容字段)
model: gpt-4o                  # 可选,模型覆盖
tags: [coding, review]         # 可选,分类标签
---
<skill 正文,注入 system prompt>
```

### 加载后行为

- skill 名注册为 slash 命令(`/skill <name>` 展示内容)
- 所有 skill 内容合并注入 system prompt 的"项目上下文"段(按优先级去重)

### 调用示例

```bash
# 列出已加载 skills
ihui skills list

# 查看指定 skill
ihui skills show refactor-helper
```

---

## plugins 系统

`apps/cli/src/plugins/` 提供插件加载、注册、市场安装能力:

| 文件 | 职责 |
| --- | --- |
| `loader.ts` | 加载插件目录,校验 manifest |
| `registry.ts` | `PluginRegistry` 注册 / 注销插件,管理 setup / teardown 生命周期 |
| `paths.ts` | 插件搜索路径解析 |
| `cache.ts` | 插件缓存(避免重复加载) |
| `marketplace.ts` | 插件市场元数据查询 |
| `installer.ts` | 从市场安装插件 |
| `types.ts` | `PluginManifest` / `PluginDefinition` / `PluginContext` 类型契约 |

### 插件扩展点

| 扩展类型 | 注入位置 |
| --- | --- |
| `toolExtensions` | 合并到 Agent 主循环的工具列表 |
| `hookExtensions` | 合并到 hooks 系统 |
| `commandExtensions` | 合并到 slash-registry |
| `TurnContributor` | 每轮对话前贡献上下文 |

### 加载流程

```typescript
import { loadPlugins, PluginRegistry } from './plugins/index.js'

const defs = loadPlugins({ pluginsDir: './plugins' })
const registry = new PluginRegistry()
registry.registerAll(defs)
await registry.runSetups()
const tools = registry.getToolExtensions()
// 退出时
await registry.runTeardowns()
```

---

## 其他核心子系统

### plan 系统(`src/plan/`)

| 文件 | 职责 |
| --- | --- |
| `machine.ts` | 任务规划状态机(待规划 → 规划中 → 待确认 → 执行中 → 完成 / 失败) |
| `types.ts` | PlanStep / PlanState 类型契约 |
| `index.ts` | 入口 re-export |

`--plan` flag 强制 Agent 先输出任务规划(plan 块)再执行工具,适合长任务。

### memory 系统(`src/memory/`)

| 文件 | 职责 |
| --- | --- |
| `chunker.ts` | 长文本分块(适配 embedding 窗口) |
| `embedding.ts` | 向量化调用 |
| `hybrid-search.ts` | 混合检索(向量相似度 + 关键词 BM25) |
| `query-expansion.ts` | 查询扩展(同义词 / 子查询) |
| `index.ts` | 入口 |

为 Agent 提供跨会话记忆能力,对标 OpenClaw Mem。

### voice 语音(`src/voice/`)

| 文件 | 职责 |
| --- | --- |
| `language.ts` | 多语言识别(zh / en / ja / ko 等) |
| `index.ts` | 语音输入 / 输出集成 |

### mermaid 图表(`src/mermaid/`)

`index.ts` 提供流程图 / 时序图 / 架构图生成能力,Agent 可调用生成可视化图表描述。

### sandbox 沙箱(`src/sandbox/`)

`index.ts` 提供代码执行隔离环境,运行不可信代码片段时限制文件系统 / 网络访问。

### sessions 会话(`src/sessions/`)

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 会话创建 / 列表 / 加载 / 持久化 |
| `state-store.ts` | 会话状态存储(JSON 文件) |
| `types.ts` | ChatMessage / Session 类型 |

会话持久化到 `~/.ihui/sessions/`,支持 `--resume` / `--continue` 恢复。

### tui 终端 UI(`src/tui/`)

| 文件 | 职责 |
| --- | --- |
| `fuzzy-file.ts` | 模糊文件查找(fzf 风格) |
| `image-input.ts` | 图片输入(粘贴 / 拖拽) |
| `mode-manager.ts` | 模式切换(plan / manual / auto) |
| `prompt-builder.ts` | prompt 构建 |
| `prompt-enhancer.ts` | prompt 增强 |

### ACP 协议(`src/acp/server.ts`)

启动 Agent Client Protocol server,供 Zed / VSCode / Cursor 等编辑器通过 JSON-RPC 嵌入 IHUI Agent。

### server 模式(`src/server/`)

| 文件 | 职责 |
| --- | --- |
| `agent-core.ts` | Agent 内核(本机跑内核,手机 / 网页 / 其他端连接控制) |
| `http-server.ts` | HTTP server(`POST /message` SSE / `GET /sessions` / `GET /health`) |
| `ws-bridge.ts` | WebSocket 桥(`/ws` 实时双向) |
| `index.ts` | 入口 |

```bash
ihui server --port 7788 --host 127.0.0.1
# 鉴权:IHUI_AGENT_TOKEN 环境变量(未设则无鉴权,仅本地开发)
```

### 配置文件(`src/config/`)

| 文件 | 职责 |
| --- | --- |
| `cli.ts` | CLI flag 解析 |
| `defaults.ts` | 默认值 |
| `env.ts` | 环境变量加载(`IHUI_*`) |
| `merge.ts` | 合并优先级:CLI flag > 环境变量 > `~/.ihui/settings.json` > defaults |
| `index.ts` | 入口 `resolveEffectiveConfig` |

### 其他辅助模块

| 模块 | 文件 | 职责 |
| --- | --- | --- |
| 主题 / 高亮 | `highlight.ts` | 代码高亮 |
| 提示队列 | `prompt-queue.ts` | 多 prompt 排队 |
| 提醒 | `reminders.ts` | 定时提醒 |
| redact 脱敏 | `redact.ts` | 日志 / 输出敏感字段脱敏 |
| 紧凑压缩 v2 | `compaction-v2.ts` | 上下文压缩(超长对话) |
| 崩溃处理 | `crash-handler.ts` | 全局未捕获异常兜底 |
| 升级器 | `updater.ts` | 启动时检查 npm 新版本(每 24h) |
| doom-loop 检测 | `doom-loop-detector.ts` | 检测 Agent 死循环 |
| interjection | `interjection.ts` | 用户中途打断注入 |
| 审计 | `audit.ts` | 操作审计日志查询 |
| 取消注册 | `cancel-registry.ts` | AbortController 管理 |
| 流式 chunk | `stream-chunk.ts` | 流式响应 chunk 解析 |

---

## 测试

`apps/cli/tests/` 覆盖核心子系统的单元 + 集成测试,按 13 个主要类别组织(vitest):

| 类别 | 代表测试文件 | 覆盖点 |
| --- | --- | --- |
| context | `context.test.ts` / `context-command.test.ts` | 上下文构建 / 命令注入 |
| git | `git.test.ts` | git 工具封装 |
| hunks | `hunks.test.ts` / `hunk-tracker.test.ts` / `hunk-tracker-integration.test.ts` | diff hunk 跟踪 |
| mcp-sse | `mcp-sse.test.ts` / `mcp-managed-client.test.ts` / `mcp-acp-transport.test.ts` | MCP SSE 传输 / 托管客户端 / ACP 传输 |
| memory | `memory.test.ts` / `memory-hybrid-search.test.ts` / `memory-search-integration.test.ts` | 记忆 / 混合检索 / 集成 |
| mermaid | `mermaid.test.ts` | 流程图生成 |
| plugins | `plugins.test.ts` / `plugins-integration.test.ts` / `plugin-marketplace.test.ts` | 插件加载 / 集成 / 市场 |
| redact | `redact.test.ts` | 脱敏 |
| repair | `repair.test.ts` | 自动修复 |
| skills | `skills.test.ts` | skills 加载 |
| tools | `tools.test.ts` / `builtins.test.ts` / `permissions.test.ts` | 工具 / 内置工具 / 权限 |
| updater | `updater.test.ts` | 升级检查 |
| voice | `voice.test.ts` | 语音 |

> 此外还有 `subagent-*.test.ts`(并行协作)、`plan-machine*.test.ts`(规划状态机)、`sessions.test.ts`(会话)、`sandbox-profile.test.ts`(沙箱)等细分测试。运行:`pnpm --filter @ihui/cli test`。

---

## 调用示例

### 启动 CLI(交互式 REPL)

```bash
ihui
# 或指定模型 + 工作区
ihui --model gpt-4o --workspace /path/to/project
```

### 直接执行任务(Headless)

```bash
ihui "修复 src/auth/login.ts 中的 token 刷新 bug"
# JSON 输出(管道处理)
ihui agent "重构数据库层" --json --output-format markdown
# 从文件读取超长 prompt
ihui agent --prompt-file ./prd.md --plan
```

### 导入配置

```bash
ihui import commit cursor ~/.cursor/config.json --strategy overwrite
```

### 跑 subagent 并行

```bash
ihui subagent-parallel \
  --persona researcher --task "调研竞品" \
  --persona coder --task "实现 MVP" \
  --persona reviewer --task "审查代码" \
  --topology chain --isolation worktree --json
```

### 用 skill

```bash
# 先在某目录创建 skill 文件
mkdir -p .ihui/skills
cat > .ihui/skills/refactor-helper.md << 'EOF'
---
description: 重构助手,优先保持向后兼容
---
重构时遵循:1) 不改公共 API 签名 2) 补充测试 3) 更新文档
EOF

# 列出已加载
ihui skills list
# 在 REPL 中用 /skill refactor-helper 调用
```

### 生成 mermaid 图表

```bash
ihui agent "用 mermaid 画出用户登录流程的时序图" --model gpt-4o
```

---

## 最优下一步建议

- 首次使用先跑 `ihui settings init` 生成 `~/.ihui/settings.json` 模板,配置默认 `apiKey` / `apiUrl` / `model`,避免每次传 flag。
- CI/CD 场景用 `--json` + `--output-format` 拿结构化输出,便于解析。
- 多 agent 协作任务用 `--isolation worktree` 避免文件冲突,见 [DEVELOPMENT.md](./DEVELOPMENT.md) 的 git worktree 工作流。
- MCP 工具集成见 [API_REFERENCE.md](./API_REFERENCE.md) 的 `/v1/tools` 段落与 `~/.ihui/mcp.json` 配置。
