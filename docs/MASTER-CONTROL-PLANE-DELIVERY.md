# 总管主通用智能体 · 控制面交付说明（2026-11-28）

## 交付范围

本分支 `feat/ma-api` 已把「总管」落到可运行代码，而不是提示词方案：

- 总管人格：`apps/ai-service/app/agents/master.md`，服务端固定注入；`POST /api/v1/ai/master/chat` 不接受客户端改人格或工具面。
- 固定三工具：`agent_registry`（注册表治理）、`agent_ops`（派发/运行控制）、`master_memory`（user/team 长期记忆）。
- 运行控制面：`run_pause` / `run_resume` / `run_talk` 对 master 自己派发的 `single` run 真实可用；`run_stop` / `run_cancel` 保留终态停止语义。
- 三层治理：注册表定义（system/personal/team scope + 版本 + 内置保护）、运行账本（`agent_runs` / `agent_run_events`）、审批（删除/回滚/清理必须人工 typedName 确认）。

## 2026-11-28 架构更正:总管是 AI 面板,不是独立页面

用户明确否决了"单独做一个 `/master` 页面"的形态。当前定稿:

- 左侧菜单栏在「新建任务」上方新增「AI总管」按钮(`SidebarQuickActions`)。
- 点击后用 `useAiPanelStore.openMaster()` 打开**现有** AI 面板,并把面板主体切到 `MasterAssistantPanel`:
  身份胶囊 + 总管对话 + 两枚去工作区的入口。
- 右侧工作展示区只放面板: `/master` = **总管这次对话里实际派出去的智能体运行列表**,
  `/master/approvals` = 待你确认;顶部 `GlobalShell`、左侧 `Sidebar`、右侧 `AISidePanel`
  都保留,不再为总管隐藏任何一层。
- `/master` 不是项目原有的「智能体」/AI 应用商店,也不是 `agent-registry` 模板卡片墙。
  数据面为 `GET /api/agent-registry/runs?sessionId=...`,只读 `agent_runs` 中
  `metadata.masterSessionId` 等于本次总管对话 session 的运行。
- 进行中(`queued/running/paused/blocked`)带圆形旋转动画;`succeeded/failed/canceled/timeout`
  统一归入「已完成」。
- `/master` 不再注册为侧栏一级导航项;顶栏标签显示「总管智能体」/「待你确认」。
- 旧的 `MasterRegistryConsole` 保留 `embedded` 模式:只画工作区面板,不画顶部菜单栏和左栏导航;
  但 embedded 的 registry 视图已替换为 `MasterCreatedAgentsPanel`,不再渲染模板卡片。

## 本轮提交

| 提交 | 内容 |
| --- | --- |
| `6f738f8f` | pause/resume/talk 控制面与真库 checkpoint 续跑 |
| `7578e954` | 续跑重建控制面登记 + 账本 seq 分页 |
| `eedb4238` | `ihui/` 前缀路由到 `ihui_relay` + 解析测试 |
| `4e238484` | 早停无 eager checkpoint 时继续等 paused 收口 |
| `e72d825c` | Windows Proactor 下回执/归位/删除/清理全部走同步 PG |
| `8e7a4d52` | 跨实例 `run_talk` Redis steer 队列 |
| `6f1dc7d6` | multi 模式 pause/resume 边界文档 |
| `3ea5d78e` | 总管默认对话模型走统一解析入口 |
| `8da8b516` | 跨实例 steer/早停/默认模型/多模式边界记录 |
| `84e58981` | PG async 分支用例固定 event loop 形态 |
| `bcdf906c` | 显式 run pause/resume/talk/stop HTTP 控制面 + Next 同源 rewrite |
| `05fa4f1a` | Web 总管控制台接入 run 暂停/续跑/停止/注入提示 |

## 真实运行证据

### 同进程 pause / talk / resume

run `663bdfc9-a037-4f77-867f-29d51312e792`：

- `run_talk` → `steered / delivery=next_iteration`，LLM 第 3 轮看到提示；
- `run_pause` → `paused / checkpointId=1073495699c44a7195cabaa3c8382d62 / runStatus=paused`；
- dispatch → `status=paused / iterations=4 / output=已完成的步骤 4`；
- `run_resume` → `resumed / completed / iterations=5 / output=pause-resume-e2e-finished`；
- 真库终态 `succeeded`；事件 `running → step ×4 → paused → running → step → succeeded`。

### 跨进程续跑

run `985b4abc-8103-4232-814f-5c9fb848be8a`：

- phase A 暂停后进程退出，phase B 只凭真库 paused checkpoint 调 `run_resume`；
- 无进程内控制记录仍成功恢复，最终 `succeeded`，事件 seq 1–9 无重号。

### 续跑后二次暂停

run `7f6b1b67-1910-41de-bfde-2c6de871593a`：

- 第一次暂停 iteration 1/2，续跑中再次暂停 iteration 3/4，再续跑完成；
- 真库 11 条事件 `running → step×2 → paused → running → step×2 → paused → running → step → succeeded`；
- 4 份 checkpoint 的 eager/boundary、owner 全部正确。

### 早停边界

run `fd0534b0-37b4-46c8-8b92-847db0b4b021`：

- `run_pause` 在早轮触发，返回 `paused`；dispatch 返回 `status=paused / iterations=1`；
- `run_resume` 最终 `succeeded`；事件 `running → step → paused → running → step×3 → succeeded`。

### 跨实例 steer

run `bdcb3255-6d65-497e-8ea0-77d9a8c2b717`：

- 控制进程 B 调 `run_talk`，本进程没有该 run 控制句柄；
- B 返回 `outcome=queued / delivery=next_iteration / remote=true`；
- 执行进程 A 的 watcher 消费 Redis 队列，A 第 3 轮 LLM 输入出现“请补充风险点”；
- 最终 `succeeded`。

### Windows checkpoint 真库分支

probe `e41afe2b8e734080957dcb3ae041fc44`：

- `record_tool_receipt` 真库落盘，fresh manager 读回 `resume_receipts.rev=1`；
- `reconcile_for_resume` 把 running 归位 paused，`applied=true`；
- `delete_checkpoint` 真删；同一 manager 写、另一个 fresh manager 读，证明不是内存假象。

### 真实 HTTP 总管对话

`POST /api/v1/ai/master/chat`，不传 `model`：

- 返回 `persona=master`、`tools=["agent_registry","agent_ops","master_memory"]`；
- `model=agnes-2.5-flash`，`final_response` 为真实文本；
- 不再落到 `@cf/zai-org/glm-4.7-flash` 的 429 免费链。

真实工具调用也跑通：同一端点发“列出当前所有可派发的智能体”，intent 判为 `tool_use`，
第 1 轮调用 `agent_registry.list`（`isDispatchable=true`，耗时 235ms），第 2 轮返回
10 个可派发智能体的名字与 ID；`iterations=2 / model=agnes-2.5-flash`，不是桩。

真实派发也跑通：同一端点发“用 agent_ops 派发 coder 执行最小任务，只输出 READY”，
第 1 轮调用 `agent_ops.dispatch`（耗时 2547ms），真实建 run
`96988744-aa8b-49b8-83ab-8b8ebb39b016`，coder 返回 `succeeded / output=READY / 1 轮`；
master 第 2 轮把 runId 带回。真库 `agent_runs` 终态 `succeeded`，事件 seq 1–2。

### 显式运行控制 HTTP 面

`bcdf906c` 把确定性控制动作从“只有 LLM 会调工具”提升为显式同源 API：

- `POST /api/v1/ai/master/runs/{runId}/pause`
- `POST /api/v1/ai/master/runs/{runId}/resume`
- `POST /api/v1/ai/master/runs/{runId}/talk`，body `{"message":"..."}`
- `POST /api/v1/ai/master/runs/{runId}/stop`

四个端点都复用全局 `agent_ops_tool`，不新增第二套执行语义；身份只从请求 JWT/cookie
取，body 不能自报 `user_id`。Next 侧加 `/api/master/runs/:path*` rewrite，浏览器同源
带 `auth_token` cookie 直达 AI 服务。

真实 HTTP 链路（不是 TestClient mock）：

- master chat 发“用 agent_ops 派发 coder 执行短任务，只输出 READY”，使用
  `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` 避开 agnes 免费额度 429；
- 建 run `85ccf6f4-06f0-4c0c-863b-8cf8e35056ee`，`POST /pause` 返回
  `outcome=paused / checkpointId=ddcb6f63e04c40f38f4b16eed86bccb2 / runStatus=paused`；
- 真库状态 `paused` 后 `POST /resume` 返回 `outcome=resumed / result.status=completed /
  runStatus=succeeded / output=READY / iterations=2 / durationMs=1266`；
- 真库终态 `succeeded`，事件 seq 1–4；同一 master 请求最后带回 runId 与 final_response。

同一端点的错误映射也实测：对已完成 run 调 `/pause` 返回 `409 /
AGENT_RUN_ALREADY_TERMINAL`；对已 canceled run 调 `/stop` 返回
`outcome=already_terminal / runStatus=canceled`。长任务在轮次边界前暂停会返回
`outcome=pause_requested / runStatus=running`，调用方必须继续轮询账本；客户端提前断开
HTTP 连接会让服务端取消正在执行的派发 run，这是长请求的既有语义，不是控制面伪造。

### UI

`/master` 页面用真实 Edge + 测试库 admin 登录态验收：11 个注册表定义、`coder` 运行统计可见；
本轮用 fresh token 重跑，`/api/agent-registry/definitions` 与 `/approvals` 均返回 200，
截图 `ma-api-e2e/master-authenticated.png` 已刷新。页面仍带 Next dev 模式的 `16 Issues` 浮层，
属于开发模式提示，不影响注册表数据加载。

`05fa4f1a` 在同一页面加入 `MasterRunControlPanel`：粘贴 runId 后可暂停、续跑、停止，
并可给运行中的 run 注入一条中途提示；结果区只显示后端返回的 `outcome / runStatus /
checkpointId / detail`，不在前端伪造状态。

真实 Edge 验收 `ma-api-e2e/w2-run-control-playwright.py`：

- `/master` 200，面板可见；
- 输入已完成 run `85ccf6f4-06f0-4c0c-863b-8cf8e35056ee` 点“停止”，
  `POST /api/master/runs/{runId}/stop` 经 Next rewrite 返回
  `200 / outcome=already_terminal / status=succeeded`，页面显示同一结果；
- 同 run 点“暂停”，`POST /pause` 返回 `409 / AGENT_RUN_ALREADY_TERMINAL`，
  页面显示错误码而不是成功；
- 截图 `ma-api-e2e/master-run-control.png`。

页面仍有既有的 `missing ) after argument list` console error 与 `16 Issues` dev 浮层，
本轮没有把它归因于运行控制面板；面板的输入、按钮、请求与错误展示已实际跑通。

## 2026-11-28 产品化：总管身份头与用户自定义名字

产品名固定为「总管」，但每个用户可以给自己的总智能体改名：

- `GET/PUT/DELETE /api/master/profile`：登录用户读取、设置、恢复默认名。
  存储复用 `user_preferences(group='master_profile', key='display_name')`，零新表。
- 名字限制 24 字符，只收中英文、数字、空格、下划线、中间点；换行/引号等会被 400 拒绝，
  避免名字拼进 system prompt 时形成指令分隔符。
- `POST /api/v1/ai/master/chat` 新增可选 `master_name`；服务端只把它追加为“显示名”，
  明确声明“不改变人格、工具边界或审批纪律”。三工具、`master.md` 人格仍由服务端固定。
- Web 新组件 `MasterIdentityHeader`：深色渐变身份头、头像首字、在线状态、注册表/待审批统计、
  内联重命名与恢复默认；名字写入后下一轮对话即用新名字自称。
- `/master` 页按控制台语义重排：身份头 → 对话 → 运行控制 → 注册表；聊天增加空态建议词、
  清空会话、彩色状态与更紧凑的 composer；运行控制按暂停/续跑/停止分色。
- 浏览器不发送 `X-Tenant-Id`，`/api/master/profile` 与 `/api/agent-registry` 加入租户豁免；
  两者都不在免登录清单，鉴权仍由路由自身强制。

真实 Edge 验收 `ma-api-e2e/w3-master-redesign.py`：

- 页面加载出身份头（默认「总管」）、对话、运行控制、注册表，注册表 15 条、待审批 1 条；
- 点“重命名”输入「智汇总管」保存，页面立即换名；刷新后仍显示「智汇总管」，
  证明名字来自 `/api/master/profile` 的持久化而不是前端内存；
- 点“恢复默认「总管」”回到默认名；测试后数据库已复原为 `display_name=总管`；
- 截图 `ma-api-e2e/master-redesign-hero-custom.png` / `master-redesign-full.png`。

## 测试门禁

- 聚焦 Python 回归：`185 passed`（master 全套 + orchestrator + checkpoint + cancel bus，含 `test_master_runs.py` 3 项与自定义名 2 项）。
- 既有 pause/runtime 回归：`147 passed`（`test_pause_resume_65` + `test_durable_resume_84` + runtime + runtime_router）。
- 跨进程崩溃/回执恢复：`test_agent_crossprocess_resume.py` `10 passed`（子进程 stdin 置 DEVNULL，修掉 Windows 下 pytest 采集句柄失效）。
- `test_llm_gateway.py`：`122 passed`。
- ruff：本轮改动 Python 文件全过。
- API `pnpm --filter @ihui/api typecheck`：通过。
- API 总管名字路由测试：`master-profile.test.ts` `4 passed`（默认名 / PUT 持久化 / 注入形状拒绝 / DELETE 复位）。
- Web 组件测试：`pnpm --filter @ihui/web exec vitest run src/components/master/__tests__`
  `11 passed`（ChatPanel 2 + RunControlPanel 3 + RegistryConsole 3 + IdentityHeader 3）。
- Web `pnpm --filter @ihui/web typecheck`：通过；新增组件 eslint 通过。
- 真库注册表集成：`AGENT_REGISTRY_REAL_DB=1` 下 `7 passed`。
- 真库 PostgreSQL 18：`ihui_agent_test_fresh`。

## 边界与未落点

- `run_pause` / `run_resume` 只支持 `mode=single`；multi 显式 `AGENT_RUN_PAUSE_UNSUPPORTED`，原因与后续门槛见 `docs/MASTER-MULTI-BOUNDARY.md`。
- `run_stop` 到轮次边界，工具批中途不硬砍。
- 跨实例 steer 依赖执行进程 watcher 在跑；执行进程已退出时仍回退 `wake_session`。
- `master_memory` 的 agent 作用域仍未开放；agent 记忆不是长期 DB 权威。
- `ihui/glm-5.3` 路由已通，但上游返回 “No active subscription found for this group”；默认可用档为 `agnes/agnes-2.5-flash`。

## 复跑入口

```powershell
$env:PYTHONPATH="D:\IHUI-Work\ma-api\apps\ai-service"
$env:CORS_ORIGIN="http://localhost:8801"
C:\IHUI-AI\apps\ai-service\.venv\Scripts\python.exe -m pytest `
  D:\IHUI-Work\ma-api\apps\ai-service\tests\test_master_*.py `
  D:\IHUI-Work\ma-api\apps\ai-service\tests\test_agent_orchestrator.py `
  D:\IHUI-Work\ma-api\apps\ai-service\tests\test_agent_checkpoint*.py `
  D:\IHUI-Work\ma-api\apps\ai-service\tests\test_agent_run_cancel_bus.py -q -n 0
```

真库 E2E 脚本位于 `C:\Users\Administrator\IHUI-pnpm\ma-api-e2e\`：
`pause_resume_e2e.py`、`cross_process_resume.py`、`pause_resume_double_e2e.py`、`early_pause_e2e.py`、`cross_steer_executor.py` + `cross_steer_controller.py`、`checkpoint_ops_probe.py`。
