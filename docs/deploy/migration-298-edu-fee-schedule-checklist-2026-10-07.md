<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 迁移 idx 298(edu_fee_schedule)生产应用清单与复核 — 2026-10-07

> 票:**G-816106 ①**(D180 2026-09-29 立,"等部署动作"格)
> 迁移文件:`packages/database/drizzle/20260929140000_edu_fee_schedule.sql`
> 主库:`127.0.0.1:5432/ihui`(apps/api/.env `DATABASE_URL` 指向;旧 8810 实例已停机,当轮连接拒绝)

## 1. 当轮现读结论(2026-10-07,只读取证)

| 判据 | 读数 | 含义 |
|---|---|---|
| `to_regclass('public.edu_fee_schedule')` | 非空 | 账期载体表**已在库** |
| `edu_payment_record` 新列 `schedule_id` / `enrollment_id` | 两列俱在 | 钱账线**已在库** |
| `pg_indexes: uq_edu_payment_receipt_no` | 在 | 缴费单号唯一约束**已在库** |
| `receipt_no LIKE '%#dup%'` | **0 行** | 未发生过双入账,消歧语句无事可做(零副作用实证) |
| `drizzle.__drizzle_migrations` 行数 | **285/286** vs journal **311** | 记账**落后 26 条,含 298 本条** |
| `pnpm migration:check:db`(B6/B7) | **红**:行数不符 + 双射破裂 | 298 不是经 `drizzle-kit migrate` 通道应用的 —— 结构在、记账缺 |
| `node scripts/check-db-schema-drift.mjs` | ✅ 通过 | TS schema ↔ 迁移 SQL 表级无漂移 |

**定性**:298 的结构产物已在主库在位(表/列/索引/消歧全量核实),该迁移的"投产"事实上已发生;
**未发生的是记账**——`__drizzle_migrations` 缺 26 条,`drizzle-kit migrate` 通道对这 26 条处于重放窗口。
B8(max created_at 一致)此前由"结构已应用但记账未记"的错位掩盖,补账前任何人跑 `migrate` 都会把 26 条当 pending 重放。

## 2. 26 条缺账明细(journal 有、库记账无;2026-10-07 现读)

`20260806040000_download_events`(1 条旧账)+ 2026-09-23 → 2026-10-04 的 25 条:
`chat_message_feedbacks`、`chat_history_projection`、`exam_sign_up_owner_uuid`、`github_app_tables`、
`team_knowledge_engine`、`backfill_turn_ordinal`、`tenant_rls_policies_batch1`、
`point_transactions_user_created_idx`、`desktop_prefs`、`lessons_difficulty`、
`llm_call_logs_trace_id`、**`edu_fee_schedule`(idx 298)**、`sequence_autofill_triggers`、
`edu_time_check_constraint`、`edu_reminder_delivery`、`edu_study_loops`、`points_mall_orders`、
`chat_conversation_groups`、`automation_retry_ledger`、`im_messages_platform_msg_unique`、
`codebase_chunks_tenant_ttl`、`agent_memory_tables_expiry`、`study_plans_lesson_id`、
`user_browse_history`、`lesson_sign_ups_study_plan_id`。

## 3. 收账/部署动作(按序,逐条留痕)

1. **离线前置**:`pnpm migration:check` B1-B5 全绿(记账结构/journal 完整)。
2. **逐条核对 26 条的结构产物**(不要盲跑 `drizzle-kit migrate` 重放):结构已在库的走**补账**
   ——按 `docs/deploy/migration-bookkeeping-rebuild-2026-09-13.md` 的记账重建通道,把
   hash/when 补进 `__drizzle_migrations`(**只补账,不重放 SQL**);结构确缺的才真应用。
   - 298 若需重放是**安全的**:全部为加法(`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` /
     `CREATE INDEX IF NOT EXISTS` / DO 块只回填 `enrollment_id IS NULL` 的行、消歧对重复单号 0 命中),
     幂等性已由本清单 §1 现读实证。
   - 其余 25 条不保证幂等(如 RLS 策略、触发器类),**必须逐条审计后**才能决定重放或补账。
3. **复核**:`pnpm migration:check:db` 全绿(B6-B9;本机跑需把
   `C:\Program Files\PostgreSQL\17\bin` 加进 PATH,否则 psql ENOENT 恒"未判定")。
4. **drift 复核**:`node scripts/check-db-schema-drift.mjs` ✅。
5. **应用层冒烟**:缴费列表端点返回 `legacy` 段(⑤ 已并,契约测试
   `apps/api/tests/edu-legacy-paylog-contract.test.ts` 7/7 当轮绿)。

## 4. G-816106 六格对账(本清单即 ①)

| 格 | 状态 |
|---|---|
| ① 部署动作 | **本清单**(结构已投产 + 记账缺 26 条待收,按 §3 收口) |
| ② 前端表单 | 已落:`finance/page.tsx`「添加缴费记录」Dialog 带 enrollmentId Select |
| ③ 家长端界面 | 已落:`edu/parent/page.tsx` 挂 BillsView(账期数据由 api 算好) |
| ④ 通道决策 | 已拍板(2026-10-07):微信订阅消息;基础设施(通道分派/43101 分档/封装)已在库 |
| ⑤ 归属裁决 | 已拍板(2026-10-07):遗留表维持历史账、读数出口并入缴费列表(`source:'legacy'` 只读展示,不参与欠费/汇总);API 纯函数 + web 表格 + 契约测试齐 |
| ⑥ 防回潮尺子 | 已落:`scripts/check-edu-arrears-single-source.mjs` + 守门 165(self-test 23/23) |
