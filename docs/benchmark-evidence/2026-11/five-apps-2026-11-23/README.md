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
