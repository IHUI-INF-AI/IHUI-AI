<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R131 —— 账本最后一格：六个 sqlite 全读，`threads` 43 列

> 账本上有一格挂了很多轮：`state_5.sqlite` 的 17 张表数过了，从没读过。这一轮把它和五个兄弟库
> 一起只读打开，读的是内容不是表名。

## 一、六个库，不是一个

目录 `C:\Users\Administrator\.codex`：

| 库 | 表 | 迁移 |
|---|---|---|
| `goals_1.sqlite` | 3 | **2** |
| `logs_2.sqlite` | 3 | **2** |
| `memories_1.sqlite` | 4 | **2** |
| `queue_1.sqlite` | 4 | **2** |
| `state_5.sqlite` | **17** | **62** |
| `thread_history_1.sqlite` | 5 | **8** |
| 合计 | **36** | |

打开方式：`file:<path>?mode=ro` 加 `PRAGMA query_only=1`。只读是纪律，不是建议——这是用户活数据的
唯一副本。

**迁移数是最好用的指纹**。四个库停在 2，`thread_history_1` 8，`state_5` 62。62 那道是长成型的成熟库，
三个小的几乎是引入后没动过的单点追加口。

## 二、`threads` 的 43 列就是一部特性叠加史

读列名比读文档更快：

- 身份与存储：`id`、`rollout_path`、`created_at`/`updated_at` 以及它们的 `_ms` 双胞胎
- 出处：`source`、`thread_source`、`originator`、`cli_version`、`git_sha`/`git_branch`/`git_origin_url`
- 策略：`sandbox_policy`、`approval_mode`、`memory_mode`、`history_mode`、`daybreak_enabled`
- 身份：`agent_nickname`、`agent_role`、`agent_path`、`attached_thread_parent_id`
- 组织：`thread_section_id`、`section_position`、`project_id`、`is_pinned`
- 计量：`tokens_used`、`has_user_event`
- **后期补的身份列**：`creator_user_id`、`creator_account_id`

最值得记的一处：`created_at` 与 `created_at_ms` **并存**。这是毫秒迁移的签名——新列加上去了，
旧列删不掉（已有读取方）。同理 `updated_at`/`updated_at_ms`。

## 三、sqlite 反向校验协议：实验面早就有表了

这是这一轮真正的交叉发现。四个只在 `--experimental` 暴露的协议家族，在**稳定库**里已经有落表：

| 协议家族 | 已在稳定库里的表 |
|---|---|
| `project/*` | `projects` + `project_roots` + `project_idempotency_keys` |
| `remoteControl/*` | `remote_control_enrollments` |
| `thread/queue/*` | `queued_items` + `queued_thread_revisions` |
| `thread/goal` | `thread_goals` + `thread_goal_continuation_deferrals` |

结论：**持久层先上，wire 方法后加闸**。旗标闸的是协议暴露面，不是数据模型。这条比"我们有 77 个
实验方法"有用得多——它说明那些实验功能在本地是真跑过、真落过盘的。

## 四、三张表值得单独说

**`thread_goals` —— 目标循环的五个数**：`objective`、`status`、`token_budget`、`tokens_used`、
`time_used_seconds`。带 token 与挂钟**双账本**的目标循环。外加一张只以 `thread_id` 为键的
`thread_goal_continuation_deferrals` 做退避——退避状态独立于目标本体。

**`thread_dynamic_tools` —— 延迟加载**：`thread_id`、`position`、`name`、`description`、
`input_schema`、`defer_loading`、`namespace`。每 thread 一份**有序**工具注册表，带显式 defer 旗标。
本仓的 `tool_search` 是各自独立想到的同一件事。

**`memories_1` —— 两阶段**：`stage1_outputs` 存 `raw_memory` + `rollout_summary` +
`selected_for_phase2`，并带 `selected_for_phase2_source_updated_at` 水位（选过之后源又变了要能重跑）。
`jobs` 是完整租约协议：`worker_id`、`ownership_token`、`lease_until`、`retry_at`、`retry_remaining`、
`last_error`、`input_watermark`、`last_success_watermark`。`consolidation_progress` 是单行游标
（`singleton`、`max_thread_count`）。

**`logs_2` 每行自记体积**：`estimated_bytes` 与 `ts`/`ts_nanos` 并存。这让裁剪可以按算术做，
不必全表扫。2,361 行是观察值，不是契约。

## 五、落成什么

`apps/ai-service/app/core/codex_local_store_schema.py` + 测试 **25 passed**。
七条反向变异：threads 变宽 / 迁移数压平（62→8）/ 租约丢 `ownership_token` / 家族虚报无表 /
表总数下降 / 毫秒列被删 / 只读旗标被摘。

**计数一律不写进契约**。`threads` 8 行、`logs` 2,361 行、`thread_items` 7 行——这些每次跑都会变，
写进去就是把会漂的东西钉成判据。模块只钉 schema 与迁移数。

## 六、诚实的边界

- 列集会随未来迁移漂移，本模块描述的是 26.1111.2228.0 这一版。
- 只读了 schema 与行数，**没读行内容**：`threads.title`、`first_user_message`、`logs.feedback_log_body`
  这些字段里有什么，仍是空白。
- 五张空表（`projects`、`queued_items`、`thread_goals`…）在本机都是 0 行，所以"这些功能真的在用"
  只能由建表事实推断，不能由数据证明。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
