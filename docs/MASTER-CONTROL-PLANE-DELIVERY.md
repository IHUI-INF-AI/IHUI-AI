# 总管主通用智能体 · 控制面交付说明（2026-11-28）

## 交付范围

本分支 `feat/ma-api` 已把「总管」落到可运行代码，而不是提示词方案：

- 总管人格：`apps/ai-service/app/agents/master.md`，服务端固定注入；`POST /api/v1/ai/master/chat` 不接受客户端改人格或工具面。
- 固定三工具：`agent_registry`（注册表治理）、`agent_ops`（派发/运行控制）、`master_memory`（user/team 长期记忆）。
- 运行控制面：`run_pause` / `run_resume` / `run_talk` 对 master 自己派发的 `single` run 真实可用；`run_stop` / `run_cancel` 保留终态停止语义。
- 三层治理：注册表定义（system/personal/team scope + 版本 + 内置保护）、运行账本（`agent_runs` / `agent_run_events`）、审批（删除/回滚/清理必须人工 typedName 确认）。

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

### UI

`/master` 页面用真实 Edge + 测试库 admin 登录态验收：11 个注册表定义、`coder` 运行统计可见；
本轮用 fresh token 重跑，`/api/agent-registry/definitions` 与 `/approvals` 均返回 200，
截图 `ma-api-e2e/master-authenticated.png` 已刷新。页面仍带 Next dev 模式的 `16 Issues` 浮层，
属于开发模式提示，不影响注册表数据加载。

## 测试门禁

- 聚焦 Python 回归：`179 passed`（master 全套 + orchestrator + checkpoint + cancel bus）。
- `test_llm_gateway.py`：`122 passed`。
- ruff：本轮改动 Python 文件全过。
- API `pnpm --filter @ihui/api typecheck`：通过。
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
C:\IHUI-AI\apps\ai-service\.venv\Scripts\python.exe -m pytest `
  D:\IHUI-Work\ma-api\apps\ai-service\tests\test_master_*.py `
  D:\IHUI-Work\ma-api\apps\ai-service\tests\test_agent_orchestrator.py `
  D:\IHUI-Work\ma-api\apps\ai-service\tests\test_agent_checkpoint*.py `
  D:\IHUI-Work\ma-api\apps\ai-service\tests\test_agent_run_cancel_bus.py -q -n 0
```

真库 E2E 脚本位于 `C:\Users\Administrator\IHUI-pnpm\ma-api-e2e\`：
`pause_resume_e2e.py`、`cross_process_resume.py`、`pause_resume_double_e2e.py`、`early_pause_e2e.py`、`cross_steer_executor.py` + `cross_steer_controller.py`、`checkpoint_ops_probe.py`。
