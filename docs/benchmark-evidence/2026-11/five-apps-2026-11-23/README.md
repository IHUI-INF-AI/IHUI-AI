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
- `apps/api/src/services/workspace-ai-service.ts`：FSBridge 新增 `mkdir/move/stat/locate/locateBatch`；`deriveOperation` 把 `fs.mkdir`/`fs.move` 归入写面；`write`/`edit` 改走「同目录临时文件 + rename」原子替换（对齐 DSH `dsh-atomic-write`），磁盘满/EBUSY/进程被杀不会留下半截文件，成功后不留 `.tmp`。
- `packages/api-client/src/endpoints/workspace.ts`：新增 Git `stage/unstage/discard/commit/branches/create/switch/log/push/pull/diff/check-ignore` 与 FS `mkdir/move/stat/locate/locate-batch/watcher` 客户端函数。
- `apps/web/src/components/ide/source-control-panel.tsx`：stage/unstage/commit/push/pull/切分支从手拼 `git ...` 命令串改走结构化端点，删除 `escapeCommitMessage`；`git status`/`stash`/`diff --cached` 仍走命令通道（状态探测与保存现场）。

验证（末行现读）：

- `apps/api/tests/git-workspace.test.ts` **8 passed**（真实临时仓库 stage→commit→log→branches、diff staged/unstaged、check-ignore 命中与空命中、钩子不执行、pathspec/分支名拒绝、路由顺序）。
- `apps/api/tests/workspace-fs-ops.test.ts` **6 passed**（递归 mkdir/stat、write→stat→move、目标存在拒绝/overwrite、locate/locate-batch、原子写不留 tmp、越界拒绝）。
- `apps/api/tests/fs-watcher.test.ts` **4 passed**（真实文件变更→cursor 续读、owner 隔离、越界拒绝、队列上限）。
- `apps/web/src/components/ide/__tests__/source-control-branch-guard.test.tsx` **4 passed**（stash 仍先于 switch）。
- `pnpm turbo typecheck --filter=@ihui/api` **9/9 success**；`--filter=@ihui/web` **7/7 success**；`--filter=@ihui/api-client` **2/2 success**。

## 第五批（同日）：CSP/Job Object 被他人提交回退后的复装

`1b4ab56b` 是本轮第三批的提交；随后 `be772cd6`（另一会话的会话标题修复）把 `apps/web/src/lib/mcp-app-bridge.ts`、`mcp-app-frame.tsx`、`mcp-app-bridge.test.ts`、`proc_sandbox.py` 的改动整体回退（`git show be772cd6 -- ...` 可复核）。工作树里原改动仍在，本批按原样复装并重新提交，避免"提交过但 HEAD 没有"的假完成。

## 追加批（同日）：FS 原子写 + 工作区变更客户端面

- `55aae297`：`FSBridge.write`/`edit` 改为「同目录临时文件 + rename」原子替换（`atomicWriteText`），磁盘满/Windows EBUSY/进程被杀不再留下半截文件；`workspace-fs-ops.test.ts` 6 passed（含"成功后不留 .tmp"）。
- `cc216ee8`：新增 `apps/web/src/hooks/use-workspace-watcher.ts`，对齐 WorkBuddy `/api/v1/fs/watcher/*` 的客户端面：面板可见才创建、卸载即 `remove`、`cursor` 长轮询续读、过滤 `.git/` 与依赖目录避免「刷新→事件→刷新」自激；`source-control-panel.tsx` 可见时订阅，外部保存或 AI 改文件后自动刷新差异与暂存态。`use-workspace-watcher.test.tsx` 2 passed + 分支保护 4 passed，`@ihui/web` typecheck 7/7 success。
- 同批：源码管理面板的 git 子进程 N+1 收口。新增 `gitWorkspace.diffStat` + `POST /git/diff-stat` + `getWorkspaceGitDiffStat`，一次请求取回「状态 + 逐文件增删行数」；`ide-workspace` 的 `fetchDiffFiles`/`fetchGitLog`/`fetchGitBranches` 全部改走结构化端点，`runCommand` 从该 store 移除。`git-workspace.test.ts` 9 passed（含 diffStat），`ide-workspace-diff-stat.test.ts` 3 passed + 面板 4 passed，三包 typecheck 13/13。
- 同批：对齐 DSH `dsh-output-retention` 的代理对安全截断。`output-budget.ts` 新增 `truncateWithoutSplittingSurrogatePair`，头/尾/中段计数统一为 `headChars + tailChars + omittedChars = originalChars`；切口落在 emoji 代理对内部时丢弃半个码元，不再把截断渲染成 `�`。`output-budget.test.ts` 4 passed（含 emoji 边界）。
- 同批：对齐 DSH `dsh-spill` / `dsh-spill-local` / `dsh-spill-policy` 的工具大输出 spill。`apps/api/src/services/output-spill.ts` 把被头尾预算截掉的全文落到工作区 `.ihui-agent/tool-spill/<owner>/`，返回工作区相对 `locator`、精确 `bytes`、`retrievalHint`；`run_command` 工具与 `POST /fs/run` 共用 `TOOL_OUTPUT_MAX_CHARS=32000`，超限回 `truncated + spills`，保存失败只回 `spillError` 不让命令失败。7 天/500 文件清理，客户端文件名只当提示（清成单安全路径段）。`output-spill.test.ts` 6 passed；`@ihui/api` typecheck 9/9 success。

## 追加批（同日）：locate/glob 精确省略数

- 对齐 DSH `dsh-output-retention` 的 "exact omitted count"：达到 `maxFiles` 上限后不再立即停扫，而是把匹配但未返回的文件继续数出来，回 `omitted` / `totalMatches` / `exact`。`exact=false` 表示只扫到 `MAX_GLOB_SCAN_ENTRIES=50000` 的扫描上限，`omitted` 只是下界；不再把"至少漏了多少"伪装成精确总数。
- 落点：`FSBridge.glob`、`FSBridge.locate`、`FSBridge.locateBatch` 统一带四个字段；`packages/api-client` 的 `locateWorkspaceFiles` / `locateWorkspaceFilesBatch` 同步类型 `WorkspaceLocateResult`。
- 测试：`workspace-fs-ops.test.ts` 7 passed，新增"5 个命中只回 2 个 ⇒ omitted=3 / totalMatches=5 / exact=true"；`@ihui/api` + `@ihui/api-client` typecheck 10/10 success。

## 追加批（同日）：命令截止先到回结构化 TOOL_TIMEOUT

- 对齐 DSH `dsh-tool-call-timeout-policy`：截止先到不再只留 `exitCode=null` 让调用方猜。`sandboxTimeoutOutcome` 把 `deadline-exceeded` 映射成 `timedOut: true` + `timeoutMs` + `error{name:'ToolTimeoutError', code:'TOOL_TIMEOUT', message:'tool call timed out after <ms>ms'}`；按时完成与非零退出保持原样，未判定不伪装成失败退出码。
- 落点：`SandboxExecutor.execute` / `FSBridge.run` 返回结构化超时；`/fs/run` 与 `run_command` 自动带出；`packages/api-client` 新增 `WorkspaceCommandRunResult`（`exitCode` 诚实为 `number | null`）。
- 测试：`workspace-fs-ops.test.ts` 8 passed（含 deadline 映射与"正常完成不标超时"对照）；`@ihui/api` 9/9 + `@ihui/api-client` + `@ihui/web` 8/8 typecheck 全绿。

## 追加批（同日）：grep 精确省略数 + 上下文行，并修好源码搜索面板的空结果

- 从 DSH 精确省略数继续下推：`FSBridge.grep` 三种模式（content / files_with_matches / count）都带 `omitted` / `totalMatches` / `exact`；达到 `maxMatches` / `perFileMatches` / `maxFiles` 后不中断扫描，继续数出未返回的条数，扫描条目到 50000 时 `exact=false` 只报下界。
- 新增 `contextLines=0-5`：命中行回 `before` / `after` 行号与内容，单行仍受 10KB 上限；`/fs/grep` 补齐 `maxMatches/perFileMatches/maxFiles/caseSensitive/contextLines` 入参，`grep` 工具同步回新字段。
- 修真实前端 bug：`packages/api-client` 的 `grepFiles` 原先声明成 `{ results: unknown }`，而服务端返回的是直接结果 ⇒ 源码搜索面板读 `data.results` 恒 undefined，搜索结果永远空白。现改为 `WorkspaceGrepResult` 并让面板读 `data.matches`；测试 mock 也从错误的 `{results}` 改成服务端真实形状。
- 测试：`workspace-fs-ops.test.ts` 9 passed（新增"3 条命中只回 2 条 ⇒ omitted=1 / totalMatches=3 / exact=true"与上下文行断言）；`search-panel.test.tsx` 9 passed；三包 typecheck 13/13 success。

## 追加批（同日）：源码管理暂存态交回服务端双面判定，不再用 stash 保存现场

- `2a0b0070`。对齐 WorkBuddy / VS Code 资源组语义：暂存与否必须由服务端同轮给出，客户端不再跑 `git diff --cached` 猜集合。
- `apps/api/src/services/git-workspace.ts`：`GitDiffStatFile` 增加 `staged` 与 `unstaged`；`diffStat` 从两路并发扩为四路（`HEAD→工作区` 状态、`HEAD→工作区` 统计、`索引→HEAD` 状态、`工作区→索引` 状态）。同一文件「暂存后又改过」时两面都为真，前端同时进「已暂存」与「更改」两组；旧实现只跑 `--cached` 会把这半丢掉。
- `apps/web/src/components/ide/source-control-panel.tsx`：删除 `runCommand`、`stagedIds`、`syncStagedFiles`、`pendingCheckout`、`stashPending`、`confirmPreserveCheckout` 与 `ConfirmDialog` 整段；stage/unstage 动作按「所在分组」判定，不在「更改」组里误撤已暂存改动；刷新/提交/推送/拉取/切分支后统一只 `fetchDiffFiles()`。
- 分支切换：D178 的 `git stash push --include-untracked` 与仓规「stash 全面禁止」（多会话共享工作树会吞掉别人现场）冲突，改为 `getGitStatus` 判脏 ⇒ 直接提示先提交或丢弃；探测失败/抛异常同样 fail-closed，不再降级直达。五个 web locale 的 `dirtySwitchDescription` 同步为「阻止切换、本系统不会自动 stash」。
- 测试：`git-workspace.test.ts` 9 passed（新增「暂存后又改过 ⇒ staged=true 且 unstaged=true」真实仓库断言）；`workspace-fs-ops.test.ts` 9 passed；`source-control-branch-guard.test.tsx` 5 passed（脏阻断、探测失败阻断、抛异常阻断、干净直达、双组呈现与分组动作）；`ide-workspace-diff-stat.test.ts` 4 passed、`search-panel.test.tsx` 9 passed、watcher 2 passed。`@ihui/api` + `@ihui/api-client` + `@ihui/web` typecheck 13/13。

## 追加批（同日）：图片上下文超预算时卸载旧图为路径占位

- `d1d35b3a`。对齐 DSH `dsh-compaction-image-offload` 的「超预算就把旧图换成文本、选择持久生效」语义。
- `apps/ai-service/app/services/tool_image_delivery.py`：新增 `IMAGE_INLINE_BUDGET=4` 与 `offload_images_over_budget()`。只处理 `role=user` 的内联 `image_url`，按消息顺序保留最新 4 张，更旧的原位替换为 `OFFLOADED_IMAGE_MARKER` 起首的文本占位；占位携带同一条消息里 `format_image_envelope` 的 `<path>`，模型可再调 `read_image` 重读。无路径时如实说明无法恢复，不编造。幂等、畸形输入跳过、预算为负按 0。
- `apps/ai-service/app/services/agent_loop_v2.py`：接线在每轮 LLM 调用前的压缩之后。压缩只按 1200 token/张估算，不会真的把旧图移出请求；这一层才把视觉 payload 真正换掉。异常隔离为保留原图，不阻塞回合。
- 测试：`test_read_image_tool.py` 15 passed（含 6 图保留 2、路径随占位、幂等、无路径诚实回执、assistant 图不参与预算，以及「第 6 图时代理循环在首次 LLM 调用前已完成卸载」的接线判据）。同批把该文件的 read_image 端到端用例改为 `enable_checkpoint=False`：它只判图片交付，原先每次要等 30 秒数据库连接超时，属测试隔离缺陷。`ruff check` 全过。

## 追加批（同日）：已发送用户文本的显示面凭据遮挡

- 对齐 DSH `dsh-client-ui-secret-mask`：用户把 API key / token / 密码粘进消息后，屏幕默认遮挡；消息原文、复制与模型输入保持不变。
- `packages/shared/src/utils/redact.ts` 新增 `maskSecretsForDisplay()` 与 `DISPLAY_SECRET_MASK_CHAR='∗'`。**不另写第二套凭据正则**：直接遍历既有 `SECRET_RULES`（output_cleaning.py 与 cli/redact.ts 的并集），命中整段保留前 8 字符，其余逐字符换成 `∗`。用 `∗` 而不用 `*` 是为了不让遮挡串被 Markdown 当成强调语法。PEM 私钥块保留 BEGIN/END 两行，只遮中间内容。函数幂等，无凭据文本逐字不变。
- `apps/web/src/components/chat/message-list/user-message-body.tsx`：正文、围栏代码块、引用行与被拒行统一先过遮挡；有凭据时渲染 `user-message-secret-toggle`（Eye/EyeOff），展开后原文可见、再点收回。`secretMaskLabels` 由宿主注入，组件自身不读 intl，既有纯渲染用例无需 Provider。
- `MessageItem.tsx` 接入 `chat.secretMaskShow` / `chat.secretMaskHide`，五种 web 语言同步。
- `packages/shared/src/utils/__tests__/redact.test.ts` 新增 3 例（sk- 前缀保留、Bearer/password/URL/PEM、幂等与反误伤）；`apps/web/src/components/chat/__tests__/user-message-secret-mask.test.tsx` 3 例（正文遮挡与展开收回、围栏代码块、无凭据不出现按钮）。验证：shared `redact.test.ts` 20 passed；web 本批 + D129 17 passed；`pnpm turbo typecheck --filter=@ihui/web --filter=@ihui/shared` 8/8 successful；`pnpm check:i18n-keys` 5 语言 parity OK。

## 追加批（同日）：严格档先读再写，覆盖未读文件被拒

- `a4e27f28`。对齐 DSH `dsh-fs-observation-policy`：覆盖或编辑一个现有文件前，本会话必须先在读面留下登记；文件自读取后被改动则拒绝并提示重读；读一个不存在的路径可授权创建，但创建窗口内若文件已被别人创建，仍按"未读覆盖"拒绝。DSH 默认发行组合里该策略 `disabled: true`，本仓同样把拒写只挂在显式严格档，默认档只点名、不拦。
- `apps/ai-service/app/core/file_read_state.py`：`judge_read_state` 的 `blocking` 从「strict ∧ stale」扩为「strict ∧ (stale | never_read)」；新增 `_NEVER_READ_MESSAGE`，`never_read` 的提示统一为"请先 read_file 取得最新内容后再写入"。新建文件不在此列 —— 调用方写前用 `presence=missing` 判定，创建语义不依赖读登记。
- `apps/ai-service/app/services/mcp_server.py`：`_tool_file_edit` 按 verdict 分流 `FS_NOT_OBSERVED` / `STALE_READ_CONFIRMATION_REQUIRED`；`_tool_write_file` 在写前 `presence` 与读盘之后、并发冲突分类之前调用 `judge_read_state`，`blocking ∧ 非 force ∧ 目标当前存在` 时拒写并回 `readState`。防"判定期间文件被创建"的窗口：gate 优先看 `readState.current.status`，取不到 `current` 才退回写前 `presence`。
- 关键坑：`sample_file()` 的状态值是 `ok / absent / unreadable`，`_classify_existing_file()` 才是 `present / missing / unread`。首版 gate 误用 `current.status == "present"`，真实命中时 `status="ok"` ⇒ 拒绝不生效、覆盖照常落盘；调试脚本打印 `blocking=true` 但 `ok=true` 才暴露。改为 `status == "ok"` 后，同一调用回 `ok=false / FS_NOT_OBSERVED` 且盘上字节不变。
- 测试：`apps/ai-service/tests/test_file_read_state_wiring.py` **10 passed**（原 5 例 + 新增 5 例：严格档拒未读覆盖且盘上字节不变、严格档允许新建、严格档先读后写、严格档 `file_edit` 拒未读、默认档覆盖未读只报 `never_read`/`blocking=false`）。`ruff check` 对本批两文件全过；`mcp_server.py` 仍只有 HEAD 存量的 `I001`（`payroll_handoff_tools` 导入块排序，不是本批引入）。

## 追加批（同日）：压力档裁剪超大工具结果，保留头尾而不是整段抹掉

- `cf0cf9ba`。对齐 DSH `dsh-compaction-tool-result-pruner`：压缩压力触发后，文本超过 8,192 个 Unicode 码点的工具结果裁成「前 4,096 + `\n\n[... tool result middle pruned ...]\n\n` + 后 1,024」，未超阈值的对话原样；完整原文仍留在会话日志里，可回放。DSH 只设字符预算、不按 token 语义切，本仓同样把 token 压力判定留给既有 `assess_context_pressure`。
- `apps/ai-service/app/core/context_compaction.py`：新增 `prune_oversized_tool_results()` 与 `_prune_tool_content()`。字符串与多模态 parts 都支持 —— 多模态只合并 `type=text` 段再裁，图片/结构化 part 原位保留；`tool_call_id`、工具名、错误等元数据逐字不动；不修改传入消息对象。头+标记+尾严格 ≤ 阈值，构造非法预算直接 `ValueError`，不静默截短。按 Unicode 码点切片，不会把 emoji 拆开。
- `micro_compact_messages(..., prune_large=False)` 新增显式档：生产执行器 `AgentLoopV2._maybe_micro_compact` 在 0.6 压力线触发时传 `prune_large=True`，先做头尾裁剪，再做旧结果整段回收；`tools_removed` 与 `tools_pruned` 分开计数，`trigger` 在只裁剪时为 `prune`、有回收时为 `micro`。默认 `False` 保证既有 micro 语义与用例逐字节不变。
- 测试：`apps/ai-service/tests/test_context_pressure_micro_compaction.py` **32 passed**（新增 6 例：头尾/元数据/原对象不变、短结果与非 tool 不裁、多模态非文本顺序保留、非法预算拒绝、只裁剪最近一轮时 `trigger=prune`、默认档不动最近大结果）；`ruff check` 三文件全过。

## 追加批（同日）：重放感知 token 计量，补上 provider 用量复用闸与三投影

- 对齐 DSH `dsh-token-meter`，这条是 `rea-capabilities.ts` 里明确标注的「真缺」：本仓 `token_baseline.py` 只做累计 prompt 的按链增量，`turn_token_usage.py` 只做轮内直方图，二者都没有"回放持久日志 → 同一次测量同时给 tokenUsage / contextPressure / contextBreakdown"的确定性投影。
- `apps/ai-service/app/core/token_meter.py`：纯函数、零 IO、零模型调用。固定密度 `CHARS_PER_TOKEN=4` / `BLOCK_OVERHEAD=4` / `ROLE_OVERHEAD=4`，支持 text / reasoning / tool-call / image 结构块（image 的 `offloaded` 标记不参与启发式），system 提示词走"纯文本 + role 开销、无逐块开销"的单独口径；`measure_messages()` 产出 `totalTokens` / `surfaceTokens` / `contextBreakdown` / 逐节点价格。
- provider 用量复用闸：只有 `anchor.envelope_key` 与当前规范信封键逐字一致，且 `provider_usage.total_tokens >= anchor.estimated_tokens` 时才复用；否则回退完整固定密度估算。复用后 `totalTokens = provider total + surfaceDelta`，`projectedTokens = pressureTokens + surfaceDelta`，压缩造成的负增量也按带符号值回传、钳到 0，不把旧用量冒充现值。`ProviderUsage` 四桶互斥，reasoning 已含在 output 内不二次累加。
- 真实接线两处：① `/api/agents/{id}/token-usage` 的 checkpoint 逐轮估算从 `len//4` 改成 `prompt_completion_tokens` + `measure_messages`，响应新增 `totalTokens` / `surfaceTokens` / `contextBreakdown` / `baseline` / `envelopeKey`；② `thread.contextUsage` 控制帧在七类账本之外追加 `tokenMeter` 构成参考 —— 账本仍是七类真实占用的权威口径，meter 只回答"system / tools / messages 各占多少"，两者不互相冒充。
- 测试：`apps/ai-service/tests/test_token_meter.py` **9 passed**（固定密度、system 口径、tool_calls、image offloaded 不变量、tools schema、最后一条非空 system 归 system、provider 复用/信封不匹配回退/用量低于锚点回退/reasoning 不二次累加/prompt-completion 拆分与入参不变）；`test_token_meter_endpoint.py` **1 passed**（checkpoint → 路由 → breakdown 字段）；`test_engine_control_frames_1106.py` **6 passed**（原 5 例 + `tokenMeter` 接线断言）。合计 **16 passed**；`ruff check` 四文件全过，新增三文件已注入水印。

## 追加批补充：把 provider 锚点装到真实回合结束点上

第一版只做到了模块层复用闸，生产两条读面都没传 `provider_usage` / `anchor`，等于闸门造好没装车；同时 `canonical_envelope_key` 把 messages 也纳入哈希，消息一变锚点就失配。本轮把这两处补实：

- `canonical_envelope_key` 改为**只含 tools / model / provider / config**，不再含 messages；surface 变化由带符号 `surfaceDeltaTokens` 单独计价，否则每追加一条消息都会让 provider 数无法复用。
- `ProviderUsage.from_normalized_usage()`：从本仓 `normalize_usage` 的 `prompt_tokens / cached_tokens / cache_creation_tokens` 构造四桶，未缓存输入 = `prompt - cache_read - cache_write`，避免同一段缓存双计；reasoning 只入 `reasoning_output_tokens`，不二次累加。
- `build_anchor()`：取**最后一条 assistant 消息之前**的 surface 作为 sampled 价，把该 assistant 自身 token 计入 `estimated_tokens`（provider 总量已含这段输出，下一请求 surface 也含它，delta 必须从它之前起算）；找不到 assistant 或 usage 不可解析返回 `None`，调用方回退完整估算。
- `AgentEngine`：`EngineThread` 新增 `last_provider_usage` / `last_token_anchor`；每轮开始清空，`_run_prompt_turn` 正常结束后取 `usage.perIteration[-1]` 调 `build_anchor`；`thread.contextUsage` 把两者传给 `measure_messages`，并在同一信封键下复用 provider 数。取不到锚点的轮次仍 `baseline=estimated`，不拿旧数冒充。
- 测试：`test_token_meter.py` 新增 `from_normalized_usage` 减缓存双计、`build_anchor` sampled 点/estimated 口径、复用后 total/projected 三值；`test_engine_control_frames_1106.py` 新增真实 `contextUsage` 复用断言（`baseline=provider_usage`、`pressure=100`、`projected=100+assistant`）。合计 **19 passed in 10.57s**；`ruff check` 六文件全过；水印 verify 4/4 完整。`agent_engine.py` 只保留 29 行增量，**未整文件格式化**（首轮 ruff format 曾把 7,000 行文件重排 784 行，已从 HEAD 还原后重贴小改动）。

## 追加批：turn.diff 逐文件行数统计（对齐 workspace/changes 摘要）

DSH `dsh-workspace-changes` 在每轮结束宣告 `workspace/changes`，摘要给每个文件 `additions/deletions`，并区分 `binary` / `coarse` / `oversized`；本仓 `turn.diff` 已有文件清单、A/M/D 状态、32k 截断 unifiedDiff，但**没有逐文件行数**。本轮只补统计层，不改 diff 正文与既有事件形状：

- `turn_diff_tracker.py` 新增 `FileDiffStat` / `diff_file_stats(unified_diff)`：纯函数解析 unified diff，只数 hunk 内 `+` / `-` 行（文件头 `---`/`+++` 不计）；`GIT binary patch` / `Binary files` 标 `binary`；病态输入跳过行级 diff或非 git 基线缺失标 `coarse`，**不把 0 冒充精确**；同一路径多段 diff 合并计数。解析面同时支持 git 原生 `diff --git` 头与本仓 `_aggregate_unified_diff` 的合成 `--- a/...` 头（hunk 内下一行为 `+++` 才认新文件头，避免把内容行误判成文件边界）。
- `agent_engine.py` 两处 `turn.diff`：
  - git 路径：用**完整** `_tracked_diff or unified_diff` 派生 `stats`，再给 `changes` 每项补 `additions/deletions/binary/coarse`；32k 只截 `unifiedDiff` 正文，行数不受截断影响，找不到统计的文件标 `coarse=true`。
  - 非 git mtime 路径：同一函数解析合成 diff；修改文件没有基线内容，显式 `coarse=true`，新增/删除文件给精确行数。
- 测试：`test_engine_harness_twentyseventh.py` 新增纯函数 1 例（多文件、二进制、改名、超大 coarse）；`test_engine_harness_thirteenth.py` 的 `turn.diff` 用例补 `tracked.txt` / `new_file.py` 行数与 `coarse=false` 断言；`test_engine_harness_fourteenth.py` 的非 git 用例补 `brand.py additions=1`。目标面 **39 passed in 9.07s**，非 git 单例 **1 passed**；`ruff check` 四文件全过。
- 说明：更广的 `third/tenth/fourteenth` 回归里 `test_tool_retry_event_emitted` 出现 `calls["n"]==0`（工具未被执行，与本轮 diff 统计无关的存量/顺序现象），不把该例计入本轮绿账，也不借此报整包绿。

## 追加批：审批档位反向语义显式化（deny）并把 apply_patch 策略接线

对照 `dsh-user-approval` 的 `never` 语义（每个 ask 确定性拒绝），本仓已有 `never` 是 Codex 语义（不问人、直接放行）。两个词同名反向，直接抄名就会把 fail-open 抄得更彻底。处理不是改掉既有 `never`（那会破坏 Codex 语义和现有用例），而是**新增独立档 `deny`**，并把三个静默口一并堵上：

- `patch_safety.py`：新增 `APPROVAL_POLICY_DENY="deny"`；`assess_patch_safety` 在 `deny` 下，无论路径是否全在 `writable_roots`、沙箱可用与否，一律 `reject`，文案 `writing requires approval, but approval policy is deny`；`never` 原语义逐字不动。
- `agent_loop_v2.py`：工具级合法档扩为 `never / on-request / always / deny`。`deny` 只在 `needs_approval=true` 时短路返回 `ToolResult(error_type="approval_policy_deny")`，executor 一次都不跑；本可只读免审的工具仍按原路径放行（拒绝的是"要问人的操作"，不是所有操作）。
- `agent_engine.py`：
  - `_VALID_APPROVAL_POLICIES` 同步加 `deny`，`thread.start` / `toolApprovalPolicies` / `policyToml` 三入口都显式接受；
  - `_resolve_patch_approval_policy()` 把线程级 `apply_patch` 策略映射成 patch_safety 档（`never→never`、`always→unless_trusted`、`deny→deny`、缺省 `on_request`），`apply_patch` 的 safety 判定改用它 —— 此前写死 `on_request`，线程策略等于没接线；
  - `_unmatched_command_decision_meta` 的未知档位不再 `.get(..., "on_request")` 静默折叠，改为返回空元数据（拦截行为仍由危险分类器负责）。
- 测试：`test_patch_safety_56.py` 新增 deny 全条件满足仍 reject；`test_engine_harness_policies.py` 新增 deny 高危工具不执行 + `apply_patch` 四档映射；目标面 **27 passed in 15.64s**，`apply_patch` 历史 41 例 **41 passed in 1.55s**；`ruff check` 五文件全过。

## 追加批：回合级工作树快照（turn-start tree → turn-end tree）

上一批给 `turn.diff` 补了逐文件行数，但基线仍是「回合前后 git status 脏文件集合差」：轮前已脏、轮内又被别的工具改写的文件，路径在前后两个集合里都有，会被整条漏掉；轮前脏但轮内没动的文件又可能被 `git diff HEAD` 的正文带进来。对齐 `dsh-workspace-changes` 的回合快照语义，新增 `app/core/workspace_changes.py`：

- `TurnWorkspaceSnapshot.start()`：用**独立临时 index + 临时 object 目录**执行 `git add -A --ignore-errors` 后 `write-tree`，得到回合开始 tree；不碰真实 index、不 commit、不 stash。工作区必须是仓库根（父仓库子目录直接降级，避免把工作区外的脏文件带进来）。
- `finish()`：再写一棵结束 tree，`git diff --name-status/--numstat/--unified=3` 两棵树；只有两棵树真正不同的路径才进入变更集，`A/M/D`、`binary`、`coarse` 都带。文件数 >500 或正文 >2MB 截断并 `truncated=true`。
- `agent_engine._run_prompt_turn`：回合开始 `await asyncio.to_thread(snapshot_turn_workspace, ...)`；回合结束先 `finish()` 再 `cleanup()`，有快照就以它为准，`turn.diff` 新增 `baselineTree`、`baselineSource="turn-start-snapshot"`、`diffSource="turn-snapshot"`；快照失败/非 git 自动回退既有 status 差集与 mtime 路径。回合异常也清理临时目录，下一轮开始再幂等清一次。
- 测试：`test_workspace_changes.py` 5 例（轮前脏不混入且轮内增量精确、删除/二进制、无变化、超文件预算截断、非 git 降级）；`test_engine_harness_thirteenth.py` 新增端到端「轮前脏文件不算本轮」；目标面 **12 passed in 16.19s**；全量 turn.diff 相关五文件 **82 passed / 1 存量 flake**（`test_tool_retry_event_emitted` 的 `calls["n"]==0`，与本批无关）；`ruff check` 四文件全过，`mypy --follow-imports=skip` 对新模块零错误。

## 追加批：模型可见文件沙箱策略（对齐 DSH `dsh-sandbox-policy`）

DSH 的 `@deepseek-ai/dsh-sandbox-policy` 在**每个模型请求的运行时上下文快照**里放一段 `sandbox:policy`：说明当前文件策略（`read-only` / `workspace-write` / `danger-full-access`）、`workspace-write` 下的工作区绝对路径、显式授权的额外可写目录；切换模式只在下一次请求生效，模型看得到策略但看不到挂载能力清单。本仓 `app/core/sandbox_policy.py` 与 `permission_mode` 早已是执行面真源，但模型此前**看不到这些边界**，只能在工具被拒后反推。本批只补“呈现”，不改任何执行判定：

- 新增 `app/core/sandbox_policy_context.py`：
  - `_policy_mode()` 把权限模式映射为 DSH 三档：`plan → read-only`、`bypassPermissions → danger-full-access`、其余 `workspace-write`；
  - `render_sandbox_policy_context()` 按档生成固定标记包裹的块（`<!-- IHUI-SANDBOX-POLICY -->` / 闭合），`workspace-write` 带工作区绝对路径与 `额外可写目录:["..."]`，`read-only` 明确“需要修改时按工具返回的拒绝/升权指引申请更宽权限，不要仅凭本策略直接拒绝任务”，`danger-full-access` 仍要求遵守用户指令与工具自身路径护栏；无工作区返回空串；
  - `inject_sandbox_policy_context()` 找首条含标记的 system 消息：策略未变幂等返回 `False`，变了原地替换并清掉其它 system 的旧块；无 system 时插到最前，有 system 时追加到末尾；全程不重复、不残留。
- `agent_loop_v2.run()` 在 `_inject_deliverable_guidance(messages)` 之后调用 `_inject_sandbox_policy_context(messages)`：从 `get_session_extra_roots(session_id, user_id)` 取额外目录，异常 warning 降级为不注入，绝不阻塞主循环。执行面（permission_mode / path_guard / patch_safety）逐字未动。
- 测试：`test_sandbox_policy_context.py` 7 例（三档文案、无工作区、幂等、旧块替换、其它 system 旧块清理、`AgentLoopV2` 真实方法接线后 plan 档注入只读块）；**7 passed in 1.37s**；`test_engine_harness_thirteenth.py` + `test_engine_harness_policies.py` 回归 **19 passed in 24.67s**；`ruff check` 三文件全过；水印 verify 3/3 完整。

## 追加批：精确逐次 token 记账（对齐 DSH `dsh-token-meter` 的 turn-usage）

DSH 的 `turn-usage.ts` 把“能否声称精确”当硬判据：单轮 `exact` 要求**每一次**计费尝试都带 `input_tokens` / `output_tokens` / `total_tokens`；缓存读写与路由是可选维度，但只要有一次尝试缺可选桶，整轮就不展示该桶；`exactPrompt = total - output` 小于已知 prompt 或缓存两维都已知时与已知 prompt 不等，整轮判不可精确；计数必须是安全整数。本仓此前 `turn.usage` 只有总量与迭代数，`perIteration` 事实上恒空（`LoopIteration` 没有 usage 字段，也没有任何代码写入），`turn_token_usage` 遥测只记四桶。本批把“原始尝试 → 严格 fold → 事件字段”全链补齐：

- `app/core/usage_cache.py` 新增 `raw_usage_shape()`：保留缺省语义（未报告 = `None`，不折 0），兼容 OpenAI `prompt_tokens` 总量式、Anthropic `input_tokens` 非缓存式、Gemini camelCase、嵌套 `prompt_tokens_details.cached_tokens` / `completion_tokens_details.reasoning_tokens`；`_first_int()` 同步拒绝 bool（`True` 不再被折成 1 token）。
- 新增 `app/core/turn_exact_usage.py`：
  - `parse_attempt_usage()` 解析单次尝试，校验非负安全整数、`reasoning <= output`、总量与 prompt 自洽、缓存两维已知时不得有隐藏差额；缺必需桶/矛盾即返回 `None`；
  - `aggregate_attempts()` 汇总整轮，可选桶只有在**全部尝试**都报告时才出现，路由只在全部尝试都有 provider/model 时出现；
  - `derive_exact_turn_usage_from_iterations()` 从 `LoopIteration`/dict 读取 `usage_attempts`，任何一次迭代没有尝试就判不可精确（不拿部分样本冒充整轮）；
  - `summarize_attempts_for_display()` 保留旧 `perIteration` 四键并补 `attemptCount` 与可选缓存/推理桶。
- `agent_loop_v2.LoopIteration` 新增 `usage_attempts` / `usage`；每次成功 LLM 响应（含 max_tokens 续写分段）把原始 provider usage append 进本迭代，失败重试不产生样本。这样“一次尝试 = 一次计费请求”在数据层成立，而不是事后估算。
- `agent_engine._turn_usage()` 改为严格 fold：`breakdownSource` 三态 `provider-exact` / `provider-partial` / `none`；只有精确时输出 `exact`（`uncachedInputTokens` / `promptTokens` / `outputTokens` / `totalTokens` / 可选缓存读写与推理 / 可选 routes），`perIteration` 取六桶汇总；`totalTokens` 历史口径保留不动。
- `agent_engine` 的 `turn_token_usage` 遥测改吃同一批尝试：六桶全部落账（`cache_write_input_tokens`、`reasoning_output_tokens` 不再恒 0），解析失败回退 `normalize_usage` 四桶，不因单个坏样本丢整轮。
- 测试：`test_turn_exact_usage.py` **14 passed in 16.19s**（总量式/Anthropic 式、缺总量必须两维缓存、矛盾总量、reasoning/bool/负数、可选桶全有才汇总、路由全有才出、安全整数溢出、缺一次尝试即不可精确、旧 perIteration 键、LoopIteration 真实记录）；回归 `test_turn_token_usage_58.py` + `test_engine_context_wiring_58.py` + `test_usage_cache.py` **48 passed in 18.32s**；`test_engine_harness_fine.py::test_environment_context_and_turn_usage_emitted` **1 passed in 6.33s**；`ruff check` 五文件全过。

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
