<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 五程序三层能力测绘（2026-11-23）

本目录是 `/goal` 轮次的原始取证归档，供后续复核，不改写任何结论。

## 方法

- **craft-anything 0.5.0 `--deep core-archive-show`**：内容寻址盘点 asar（逐条 size/kind/role/sha256，ASAR 完整性哈希校验），产出 Evidence ID 与 `confidence: observed`。
- **自研只读 asar 读取器**（`tools/asar.mjs`，按 header JSON + data offset 解包）：只解出代码类文件（js/mjs/cjs/ts/tsx/json/md/py…），不写目标程序目录。
- **package.json 抽取**：`@deepseek-ai` 336 个包的名称/版本/用途一句话。
- **工具清单抽取**：craft-anything `commands` 321 条（命令名 + 摘要）。
- **前置证据**（未重复造）：`docs/agent-harness-benchmark-2026-11-19.md`（逐格对照 + 已落地条目）、`.archify/ghidra-harvest-20261031/`、`docs/RELAY_QODER_*`、`docs/RELAY_TRAE_*`、`docs/WORKBUDDY_TASKS.md`。

## 硬数字（本轮现读）

| 程序 | 形态 | 代码面 | 原生面 | 取证 |
|---|---|---|---|---|
| DeepSeek Harness 0.2.2-rc.5 | Electron + 336 个插件包 | app.asar 21,722 文件 / 9,198 js / 4,845 ts | 10 个 native-addon、16 个 PE | `ev_6f959a02…c5397f`、`inv_17688f18…12b6` |
| WorkBuddy 5.11.3 | Electron + 内置 CLI | app.asar 12,551 文件 / 8,204 js / 322 个 main 模块 | 45 个 native-addon、871 binary、43 PE | `ev_5a1da4a7…6220f`、`inv_76b5d7a6…4cef` |
| Qoder CN 0.5.14 | Electron | app.asar ≈191MB；`electronMain.js` 20.5MB；`@qoder-ai/qoder-cn-agent-sdk` | `resources/bin/*.node`（clipboard/notification/system_commit）+ unpacked（sharp/node-pty/canvas） | 既有 REA/Ghidra 取证 |
| TRAE CN 3.4.20 | VSCode 派生（未打包 out/） | `out/main.js` 3.3MB；`modules/{ai-agent,ckg,sandbox,browser-bridge}` | `aha_net.dll`/`sscronet.dll`/`logifier_retrieval.dll`/`metasecml.dll` 等 | 既有 Ghidra：ckg/ContextFS 155 函数 |
| craft-anything 0.5.0 | Rust 原生 CLI | 321 条工具命令（含 40+ 调查类） | 99MB 单文件 Rust 二进制 + MCP server | `capabilities`/`commands` 现读 |

## 本仓已吸收（抽样，完整见基准文档）

- `app/core/session_event_log.py` ← dsh-session（事件类型/裁剪/上限；刻意不做 v0→v4 迁移链）
- `app/core/context_compaction.py`、`app/services/tool_result_pruner.py`、`app/core/compaction_retention.py` ← dsh-compaction 系列（含 BPE 对齐与压力档）
- `app/core/code_mode_cell_lifecycle.py` ← Codex code-mode cell-actor 治理
- `app/core/proc_sandbox.py`（Windows Job Object）、`app/services/os_sandbox.py`（Job Object + 受限令牌）← 与 WorkBuddy `cli/bin/native/job-object.node` 同型
- `app/services/tool_auto_review.py`（工具授权审查）、`app/services/persona_registry.py`（persona 注册表）、`app/services/deep_research.py`（证据链/交叉核验/gap 问题）
- `app/services/mcp_client.py`（工具面）、`acp_bridge.py` / `apps/cli/src/acp/server.ts`（ACP）、`apps/web/src/data/ihui-capabilities.ts`（能力矩阵）
- `docs/WORKBUDDY_TASKS.md` 记录的 WorkBuddy 侧接入面

## 本轮新增（已落地并有测试）

外部 MCP Server 的 `resources/*` 与 `prompts/*` 客户端面（此前只有 `tools/*`）：

- `apps/ai-service/app/services/mcp_client.py`：`MCPClientResource`/`MCPClientResourceTemplate`/`MCPClientPrompt` 三个数据类；client 侧 `list_resources`/`list_resource_templates`/`read_resource`/`list_prompts`/`get_prompt`；manager 侧 `list_available_resources`/`list_available_resource_templates`/`list_available_prompts`/`read_external_resource`/`get_external_prompt`。可见性唯一判据仍为 `MCPClientManager.is_visible`。
- `apps/ai-service/app/routers/mcp.py`：`GET /api/mcp/external/resources`、`POST /api/mcp/external/resources/read`、`GET /api/mcp/external/prompts`、`POST /api/mcp/external/prompts/get`。
- 截断显式可见：`RESOURCE_CONTENT_LIMIT_CHARS = 400_000`，超限置 `truncated: true`，不静默降级。
- `apps/ai-service/tests/test_mcp_client_resources.py`：14 用例全绿；既有 MCP 客户端/外部路由 68 用例回归全绿。

## 第二批（同日）：协议面补齐

原报告把以下两项列为"新产品面、需产品拍板"。用户明确要求"别人有的我们没有就做"，两项同轮落地：

1. **MCP client `completion/complete`**：client 侧 `complete_argument(ref, argument)` 原样透传 ref（ref/prompt 或 ref/resource），失败沿用 `{ok:false,error,code}`；manager 侧 `complete_external_argument` 先过 `is_visible` 与连接检查。
2. **资源订阅**：client 侧 `subscribe_resource` / `unsubscribe_resource`；`_handle_message` 消费 `notifications/resources/updated`，写入有界台账（`RESOURCE_UPDATE_LIMIT = 256`，超限丢最旧），`resource_updates(limit)` 倒序返回；退订同时清订阅与更新记录。manager 侧三个聚合方法 + `external_resource_updates`（纯读、不出站）。
3. **4 条端点**：`POST /api/mcp/external/completion`、`POST /api/mcp/external/resources/subscribe`、`POST /api/mcp/external/resources/unsubscribe`、`GET /api/mcp/external/resources/updates`（limit 夹到 0..256，未知 server 404），全部 `Depends(require_request_user_id)`。
4. **MCP Apps UI 宿主**（web）：
   - `apps/web/src/lib/mcp-app-bridge.ts`：纯判据层 —— `isMcpAppResource`（`ui://` 或 `text/html;profile=mcp-app`）、`isAppRpcRequest`（JSON-RPC 2.0、必须有 id）、方法白名单（`ui/initialize` / `tools/call` / `resources/read` / `ping`）、`rpcResult` / `rpcError`。
   - `apps/web/src/components/mcp/mcp-app-frame.tsx`：`sandbox="allow-scripts"` 且**不给** `allow-same-origin`（不透明源，拿不到 cookie/localStorage）；只处理 `event.source === frame.contentWindow` 的消息；server 归属由宿主决定，iframe 不能自报换 server；未知方法回 `-32601`；缺 `html` 时按 `resources/read` 取正文。
   - `mcp-resource-viewer.tsx`：`McpResource` 增 `server?`，命中 App 判据走宿主，否则维持图片/JSON/Markdown/文本/下载分支。

测试与门：

- 后端 `tests/test_mcp_client_resources.py` **22 passed**（原 14 + 8：completion 透传与错误形状、订阅/退订、通知台账、256 上限、manager 可见性）。
- 前端 `apps/web/src/lib/__tests__/mcp-app-bridge.test.ts` **9 passed**；四个改动文件 ESLint 全绿。
- 既有 MCP 客户端/外部路由 68 用例回归仍绿。

## 第三批（同日）：craft Deep 全量实跑复核

第二轮用户质问"不可能，你用 craft anything deep 模型全部深度分析了吗"。此前只跑过 asar 盘点与命令抽取，本轮补齐**应用图 + fuse + 原生总览 + Ghidra 反编译**四层实跑，并把可复用的缺口补上。

### 实跑配置（现读）

- CLI：`craft-anything 0.5.0`，99MB Rust PE，sha256 `0e34088c35969ac05d2897159c1ade9118c2a387282ff59276e8dc8bcf7b9898b`；`commands` 321 条。
- `deep_mode=true`；Ghidra `D:/DevEnv/ghidra_12.1.4` + JDK `C:/Program Files/Java/jdk-21-temp/jdk-21.0.2+13`，`doctor` 两项 `[ok]`。
- `native-function-pseudocode` 回包带 `"engine":"ghidra"`，证明反编译走的是 Ghidra 而非内置 lifter。
- 每个目标都建了独立 craft 项目，图与证据落 `.ihui-agent/tmp/craft-deep/<app>/`。

### 应用图（`js-app-map`，真实回包）

| 程序 | 源文件 | IPC（成对） | 窗口 | 端点 | 路由 | 关键原生件 |
|---|---:|---:|---:|---:|---:|---|
| Qoder CN 0.5.6 | 637 | 0（0） | 8 | 37 | 154 | `aoq_node_ext.node`、sharp、skia、node-pty |
| WorkBuddy 5.11.3 | 3,776 | 107（53） | 20 | 826 | 50 | `job-object.node`、`os-bridge.node`、`ripgrep.node`、`koffi.node` |
| TRAE CN | 1（`out/main.js`） | 53（0） | 20 | 20 | 1 | `metasecml.dll`、`logifier_retrieval.dll` |
| DeepSeek Harness 0.2.2-rc.5 | 17 | 0（0） | 5 | 3 | 1 | `frame-forwarding.node`（其余在 336 个 vendor 包） |

- Qoder 的 0 IPC 不是没有 IPC，而是 IPC 走自有 `aoq-electron-sdk`（`aoq_node_ext.node`），静态字面通道抓不到；154 条路由几乎全是 `/api/v1/collaboration/*`（agent-profiles、discussions、members、presence、agent-executions、issue-links…）。
- TRAE 的 53 条 IPC 全部集中在 `icube-floating-chat:*`（assistant-open/dismiss、button-hit-region/resize/visibility、chat-drag-end），主进程是单文件 `out/main.js`。
- DSH 的 app.asar 只是薄壳；真实能力在解包树的 336 个 `@deepseek-ai` 包、4,845 个 `.ts` 里，模块级图仍只认 17 个入口。

### Electron fuse（`js-electron-fuses-show`，逐位现读）

| Fuse | Qoder | WorkBuddy | TRAE | DSH |
|---|---|---|---|---|
| RunAsNode | enabled（未硬化） | enabled | enabled | enabled |
| EnableCookieEncryption | disabled | disabled | disabled | disabled |
| EnableNodeOptionsEnvironmentVariable | **disabled（硬化）** | enabled | enabled | enabled |
| EnableNodeCliInspectArguments | **disabled（硬化）** | enabled | enabled | enabled |
| EnableEmbeddedAsarIntegrityValidation | **enabled（硬化）** | **enabled** | disabled | disabled |
| OnlyLoadAppFromAsar | **enabled（硬化）** | **enabled** | disabled | disabled |

Qoder 是四者中唯一把 asar 完整性、仅从 asar 加载、禁 `NODE_OPTIONS`、禁 `--inspect` 同时打开的；WorkBuddy 保住 asar 两条但保留 `NODE_OPTIONS`/`--inspect`；TRAE 与 DSH 六项全开。RunAsNode 四者都未关，Cookie 加密四者都未开 —— 这两项不是"某一家更强"，而是整个 Electron 生态的共性缺口。

### 原生层（Ghidra）

- WorkBuddy `job-object.node`：Ghidra 反编译 `FUN_1800014eb` 显示 `GetModuleHandleExW(5, …)` 钉住模块 → `CreateJobObjectW` → `SetInformationJobObject(JobObjectExtendedLimitInformation, flags=0x2400)` → `AssignProcessToJobObject(GetCurrentProcess())`；失败文案 `Cannot pin Windows Job addon` / `Cannot enable Windows no-orphans Job`。`0x2400 = KILL_ON_JOB_CLOSE(0x2000) | DIE_ON_UNHANDLED_EXCEPTION(0x0400)`，即"父死子全收 + 子崩溃不弹 WER"。
- 本仓 `proc_sandbox.py` / `os_sandbox.py` 已实现 Job Object + 受限令牌；原只置 `KILL_ON_JOB_CLOSE`（0x2000）与 UI 限制，本轮已把 `DIE_ON_UNHANDLED_EXCEPTION`（0x0400）补进 `proc_sandbox.py`，与 WorkBuddy 的 0x2400 对齐，`test_engine_harness_eighth.py` **9 passed**。`os_sandbox.py` 仍按策略开关，不硬编码该位。
- WorkBuddy `app-server-mcp-apps-host.js`：`callTool → proxyAppToolCall(appInstanceId, toolName, args)`、`readResource → proxyAppResourceRead`，错误强制 `appInstanceId/toolName/uri required`；`SandboxPreviewHandler` 反向代理沙箱文件时强制注入 CSP 与 `Cache-Control: no-cache`。本仓宿主用"帧来源 + 固定 server"达到等价隔离，但**没有 CSP**，见下一节。

### 第三批落地：MCP App CSP 收口 + Job Object 参数对齐

- `apps/ai-service/app/core/proc_sandbox.py`：`LimitFlags` 补入 `JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION`（0x0400），与 WorkBuddy `job-object.node` 的 0x2400 对齐；`test_engine_harness_eighth.py` **9 passed**。

- `apps/web/src/lib/mcp-app-bridge.ts`：新增 `MCP_APP_CSP` 与 `applyAppCsp(html)`。策略 `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data:; media-src https:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'` —— 内联脚本与展示资源可用，`fetch/XHR/WebSocket/beacon` 全断，杜绝"把宿主读到的内容外传"。
- `mcp-app-frame.tsx`：`srcDoc={applyAppCsp(doc)}`，把 CSP 作为第四层边界写进注释。
- 测试：`mcp-app-bridge.test.ts` **12 passed**（原 9 + 3：head 内插入、无 head 前置、策略断言）；`pnpm turbo typecheck --filter=@ihui/web` **7/7 success**；三文件 ESLint 0。

## 第四批（同日）：WorkBuddy 工作区路由逐条对账后的真缺口

从 `js-app-map` 的 `routes[]` 现读（不是推测）WorkBuddy 工作区面共 25 条：

- `/api/v1/fs/*`：`stat`、`list`、`mkdir`、`remove`、`move`、`watch`、`watcher/create`、`watcher/events`、`watcher/remove`、`search-content`、`locate`、`locate-batch`。
- `/api/v1/git/*`：`status`、`check-ignore`、`stage`、`unstage`、`commit`、`diff`、`discard`、`branches`、`branch/switch`、`branch/create`、`push`、`pull`、`log`。

逐条对照本仓后，真实缺口是 Git 写面、`fs/mkdir|move|stat|locate|locate-batch`、`fs/watcher/*`；`list`/`remove`/`search-content` 分别由既有 `fs/browse`/`fs/delete`/`fs/grep` 等价覆盖，不另造第二真相。

本批落地：

- `apps/api/src/services/git-workspace.ts`（新）：`stage/unstage/discard/commit/branches/createBranch/switchBranch/log/checkIgnore/diff/push/pull`。`execFile('git', argv)` 直传不经 shell；`core.hooksPath=.git/ihui-no-hooks` 禁仓库钩子；`commit.gpgsign=false`；最小 env + `GIT_TERMINAL_PROMPT=0`；pathspec 拒绝绝对路径/盘符/`..`/NUL；分支名只允许 `[A-Za-z0-9._/-]` 且拒绝 `..`/`@{`/`.lock`。`git check-ignore` 无命中退 1 是正常语义，`runRaw` 允许非零码，不按失败抛错。
- `apps/api/src/routes/workspace-ai.ts`：新增 12 条 Git 写端点（含 `diff`、`check-ignore`）与 3 条 FS 端点（`mkdir/move/stat`）、2 条定位端点（`locate/locate-batch`）、4 条监听端点（`watch`/`watcher/create|events|remove` + `GET watchers`）。push/pull 先 `requireAdmin` 再权限闸。
- `apps/api/src/services/fs-watcher.ts`（新）：进程内 `fs.watch` 注册表。事件按单调 `seq` 记账，队列上限 500、溢出记 `dropped`；每用户 10 个、全局 30 个、30 分钟无访问自动回收；`events` 支持 cursor 续读与最多 2s 长轮询；owner 隔离与登记根判据复用 FSBridge `resolvePath`。
- `apps/api/src/services/workspace-ai-service.ts`：FSBridge 新增 `mkdir/move/stat/locate/locateBatch`；`deriveOperation` 把 `fs.mkdir`/`fs.move` 归入写面。
- `packages/api-client/src/endpoints/workspace.ts`：新增 Git `stage/unstage/discard/commit/branches/create/switch/log/push/pull/diff/check-ignore` 与 FS `mkdir/move/stat/locate/locate-batch/watcher` 客户端函数。
- `apps/web/src/components/ide/source-control-panel.tsx`：stage/unstage/commit/push/pull/切分支从手拼 `git ...` 命令串改走结构化端点，删除 `escapeCommitMessage`；`git status`/`stash`/`diff --cached` 仍走命令通道（状态探测与保存现场）。

验证（末行现读）：

- `apps/api/tests/git-workspace.test.ts` **8 passed**（真实临时仓库 stage→commit→log→branches、diff staged/unstaged、check-ignore 命中与空命中、钩子不执行、pathspec/分支名拒绝、路由顺序）。
- `apps/api/tests/workspace-fs-ops.test.ts` **5 passed**（递归 mkdir/stat、write→stat→move、目标存在拒绝/overwrite、locate/locate-batch、越界拒绝）。
- `apps/api/tests/fs-watcher.test.ts` **4 passed**（真实文件变更→cursor 续读、owner 隔离、越界拒绝、队列上限）。
- `apps/web/src/components/ide/__tests__/source-control-branch-guard.test.tsx` **4 passed**（stash 仍先于 switch）。
- `pnpm turbo typecheck --filter=@ihui/api` **9/9 success**；`--filter=@ihui/web` **7/7 success**；`--filter=@ihui/api-client` **2/2 success**。

## 第五批（同日）：CSP/Job Object 被他人提交回退后的复装

`1b4ab56b` 是本轮第三批的提交；随后 `be772cd6`（另一会话的会话标题修复）把 `apps/web/src/lib/mcp-app-bridge.ts`、`mcp-app-frame.tsx`、`mcp-app-bridge.test.ts`、`proc_sandbox.py` 的改动整体回退（`git show be772cd6 -- ...` 可复核）。工作树里原改动仍在，本批按原样复装并重新提交，避免"提交过但 HEAD 没有"的假完成。

## 核实后的残余（不再列为待办）

原报告曾把六项列为"仍缺"；逐项核实后，五项已有实现，一项无对象可迁：

| 残余 | 核实结论 | 为何不再建议 |
|---|---|---|
| 内核级 per-path DACL | `app/services/os_sandbox.py` 已含 Job Object + `CreateRestrictedToken`；文件 ACL 在模块 docstring 中明确声明为应用层护栏，内核级需改写 DACL | 本仓已判定"代价过重"，现有护栏覆盖威胁模型 |
| turn outline | `routers/sessions.py` 已有 turn 模型、`list_turns`、`/threads/{id}/diagnostics` | 已有等价实现，另造一份会成第二真相 |
| 调查台账 | `deep_research.py` 已有 `EvidenceUnit` / `crosscheck` / `gap_questions` / `limitations` | 核心语义已覆盖；再加一层只是换名 |
| 自动复核 | `services/tool_auto_review.py`（工具授权审查）+ `services/pr_reviewer.py`（PR 复核） | 工具级与 PR 级已有；回合级需产品决策与成本预算 |
| Agent preset | `services/persona_registry.py` + `routers/personas.py` | 已有 persona 目录与契约 |
| 会话迁移链 v0→v4 | `session_event_log.py` 明确不接管持久化 | 事件不落盘，没有对象可迁 |

上表只留**明确放弃或没有对象**的项；原列为"新产品面"的两项（MCP Apps 宿主、completion/subscribe）已于同轮落地，见上一节。


## 证据文件

- `dsh-archive.md`：DSH app.asar 盘点（含 containers/integrity/entries）
- `wb-archive.md`：WorkBuddy app.asar 盘点
- `dsh-packages.txt`：336 个 `@deepseek-ai` 包（`name|version|description`）
- `dsh-packages-grouped.md`：按前缀分 91 组（client 70 / tool 29 / experimental 28 / session 25 …）
- `craft-tools.txt`：craft-anything 321 条命令（`command|summary`）
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
