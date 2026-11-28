# 总管 multi 模式 pause/resume 边界（2026-11-28）

## 结论

`run_pause` / `run_resume` **只支持 `mode=single`**。multi 模式收到这两个动作时，直接返回
`AGENT_RUN_PAUSE_UNSUPPORTED`，不写暂停位、不改账本、不伪造 paused。

`run_stop` / `run_cancel` 对 multi 仍可用：它们是终态停止，不需要重建参与者状态。

## 为什么不在这一轮支持 multi

single 的检查点是一个 `AgentOrchestrator` 的完整快照：messages、iteration、output、
model、chat_mode、permission_mode、tool_allow/tool_deny、session/run/agent。
恢复时只需要重建一个 provider、一个 ledger、一个 orchestrator。

multi 不是“一个循环里多几个 agent”，而是多个 participant 各自有循环、工具状态和
副作用账本。当前 `AgentCheckpoint` 没有 participant 维度的 manifest，也没有
“每个 participant 恢复到哪一步、哪些工具回执已经落盘”的统一视图。直接复用 single
的 checkpoint 会把多个参与者的中间状态压扁成一份 messages，续跑时无法判断：

- 哪个 participant 已经完成，哪个还要继续；
- 已执行的副作用工具是否需要跳过；
- 汇总者（aggregator）恢复后是否会重复消费子结果；
- 参与者的 model / 权限 / 工具白名单是否与暂停时一致。

在这些问题没有 participant manifest 之前，允许 multi pause 等于制造“看起来暂停成功、
续跑却重复执行或丢步骤”的假象，所以宁可显式拒绝。

## 当前可依赖的语义

| 动作 | single | multi |
| --- | --- | --- |
| `run_pause` | 支持；eager 或 boundary checkpoint | `AGENT_RUN_PAUSE_UNSUPPORTED` |
| `run_resume` | 支持；按 session 取最新 boundary checkpoint | 拒绝，必须先走 `run_stop` |
| `run_talk` | 本地 `steer` 或 Redis 跨实例队列 | 当前不承诺 steer 语义 |
| `run_stop` / `run_cancel` | 支持 | 支持（终态停止） |

拒绝时的响应必须带 `details: {runId, mode}`，调用方据此把按钮置灰或提示
“multi 运行只支持停止”，不能把 `ok=true` 当成“暂停已生效”。

## 后续要支持 multi 的最低门槛

1. checkpoint 增加 `participants[]`：每个 participant 的 agent、iteration、messages、
   tool_state、model、权限、已完成/未完成状态。
2. 工具回执按 participant 分账，恢复时逐 participant 做 CAS，不允许跨 participant
   复用同一个 rev。
3. aggregator 的输入游标单独持久化，恢复后只消费未消费的子结果。
4. 真实双参与者 E2E：暂停在 participant A 第 2 轮，恢复后 A 从第 3 轮继续、B 不重跑，
   最终账本 `succeeded` 且事件 seq 连续。

未满足以上四条前，不把 multi 纳入 `run_pause` / `run_resume` 的可用范围。

## 验收锚点

- `test_master_ops_tool.py::test_run_pause_rejects_multi_mode`
- `test_master_ops_tool.py::test_run_resume_rejects_non_paused_run`
- 真实 `run_stop` 对 multi 的终态迁移仍由现有 `AgentOrchestrator` 停止路径覆盖。
