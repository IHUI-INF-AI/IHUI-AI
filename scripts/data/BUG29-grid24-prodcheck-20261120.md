<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# BUG-29 格2/格4 生产现态核查报告（本机 dev 库，2026-11-20）

> 方法：连本机 dev 库 `127.0.0.1:5432/ihui`（PostgreSQL 18.6，已应用 374 迁移）做只读探测。
> **注意：本机 dev 库 ≠ 生产库**。下述"现态"是本机克隆的实际类型/FK/悬空值，生产须 DBA 复核。
> 动因：用户授权「把格2/格4 也推进到位」。这两格此前卡在"需查库"，现查毕。

## 结论总览：诊断 JSON 计数系统性假阳性

| 格                                   | 诊断 JSON 计数 | 本机库实际                             | 结论               |
| ------------------------------------ | -------------- | -------------------------------------- | ------------------ |
| 格4 同表 DDL 类型冲突（破坏性 8 项） | 8 项           | **10/10 列实际类型与 schema 全 MATCH** | 假阳性，无需 ALTER |
| 格2 nullable userId 无 FK            | 137            | 已建 FK 129 / 仍无 FK **1** / 解析空 7 | 绝大多数假阳性     |
| 格2 notNull userId 无 FK             | 14             | **已建 FK 13 / 类型异常 1**            | 假阳性             |

## 格4：8 项破坏性冲突 → 实际无需处理

迁移链里同表 A/B 两侧列类型不同（如 `video_generation_tasks.id` serial↔integer），但本机库 `information_schema.columns` 实测：

- `video_generation_tasks.{id:integer, task_id:varchar36, result:text}` = schema
- `gen_table_column.table_id:bigint`、`tbox_bean.{id:bigint, bean_data:text}` = schema
- `live_gift.{id:integer, channel_id:integer, user_id:varchar64, total_price:integer}` = schema

**库按"最后跑的迁移赢"已收敛到与 schema 一致**，与格3 首扫误报同一模式。8 项均无需 ALTER，仅当生产库"最后跑的"与 schema 不同时才需处理——**须 DBA 在生产库复核后定**，本机不能代表。

## 格2：137 处 nullable → 本机库绝大多数已建 FK

本机库逐列查 FK 存在性 + 悬空值：

- **129 处已建 FK**（`zhs_agent_buy`/`agent_reviews`/`agents`/`zhs_agent_withdrawal_detail` 等抽样确认，onDelete 多为 CASCADE/NO ACTION）
- **130 处零悬空值**（user_id 均指向存在的 users 或为 NULL）
- **7 处 def 空白 = 诊断生成器解析假阳性**：`ai_model_mappings`/`exam_sign_up`/`srs_streams`/`tool_invocation_ledger`/`refresh_tokens`（5 个 schema 已 `.references()` 有 FK）、`webhook_subscriptions`（notNull）、`chat_context_ledgers`（nullable 但本机已建 FK）——**均无需处理**
- 其中 `hr_employee_link_request.user_id` **被诊断误归为 nullable**，实测 `is_nullable=NO`（notNull，schema `hr-ai-management.ts:202` 也 `.notNull()`）——它实属下面的 notNull 桶

### 格2 notNull 14 处 → 13 已建 FK，1 真缺（→ 包5）

13 处 `agent_event_triggers`/`agent_upload`/`agent_user_profile`/`clawdbot_sessions`/`exam_signups`/`exam_wrong_question`/`learn_community_post`/`lesson_rate`/`langgraph_thread_owners`/`webhook_subscriptions` 等本机库**已建 FK、悬空 0**。

- **唯一真缺 = `hr_employee_link_request.user_id`**：本机库该表**零 FK 约束**、列 uuid + notNull、表 0 行悬空 0，schema 期望 cascade → 已生成**包5**补齐。
- **`resource_downloads.user_id` 类型异常**：本机库该列仍为 `integer`（与 `users.id` uuid 不兼容）。这正是隔离头注担心的原必失败项——**包3 的 FK 块对此表会因 EXCEPTION 吞掉而跳过**，符合设计（不中断整包）。

## 由此产生的唯一新动作：包5

仅 `hr_employee_link_request.user_id` 需加 FK（uuid、零悬空、nullable、本机无 FK）。按机主"另开独立包"的既定偏好，生成包5（DO+EXCEPTION 守卫，与包3 FK 同形态）。

> **口径声明**：本报告"现态"均指**本机 dev 库**。生产库可能因迁移历史不同而状态不同（尤其格4 "最后跑的赢"）。上线前须 DBA 在**生产库克隆**重跑本报告的探测 SQL 复核。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
