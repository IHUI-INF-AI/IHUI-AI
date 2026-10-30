-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- G-241(2026-10-26 立):给 user_automations 补「结算状态机」缺的两格 —— 认领 + 终态成因。
-- 退避那一格本票**不动**(G-669 已把 attempt / last_error 落库,见
-- 20261001170000_automation_retry_ledger;现读:重启后计数与排程都在库里,不在内存里)。
--
-- 立因一(认领):apps/api/src/services/agent-automation-scheduler.ts 的 tick 原先只做
--   `SELECT … WHERE 到期 LIMIT 10` + 取回后的**只读**复核,随后直接执行;进程内单飞
--   (services/automations/index.ts 的 createSingleFlightTick)是闭包布尔,第二个执行体看不见。
--   而"取回"与"执行"之间隔着一次可能长达数分钟的 agent 运行 ⇒ 两个 api 进程(或 tick 与
--   POST /automations/:id/run-now)会在同一刻读到同一行、各打一次上游
--   /api/agent-runtime/execute/stream:同一次触发跑两遍(会话产出重复、算力双扣),
--   后结算者以 `WHERE id=…` 无条件覆盖前结算者。表上原先没有任何"谁在跑"的列可用来挡住这件事。
--   现由 claim_token + claimed_at 支撑一条行级 CAS:
--     UPDATE … SET claim_token=…, claimed_at=… WHERE id=… AND (claim_token IS NULL
--       OR claimed_at < now - 租约) AND <到期判据> RETURNING id
--   命中 1 行才执行;"是否被持有"因此进了那条 SQL(窄筛),不再只在进程内存里。
--   claimed_at 必须与 claim_token 同笔写、同笔清 ⇒ 执行体崩溃时租约会超龄、那一行不会永久停摆。
--
-- 立因二(终态):permanent 失败 / transient 超上限 / rrule 不可解析 / 用户手动暂停
--   四条路径原先**全部压成 status='paused'**,彼此只差在自由文本 last_error —— 而它会被
--   transient 写脏、被成功清成 null,人为暂停既不写也不清它 ⇒ 判据读不出"为什么不排了",
--   也读不出"一次性任务是跑完了还是被打断了"(once 成功后 status 仍是 active)。
--   现由 terminal_reason 逐档写明,取值是封闭集 AUTOMATION_TERMINAL_REASONS
--   (packages/database/src/schema/user-automations.ts,词表只住这一份):
--   manual_pause / failed_permanent / failed_retries_exhausted / completed,NULL = 无终态。
--
-- 三列全可空、无默认值、无 DROP、不改既有列 ⇒ 旧行读作"未被认领 + 无终态",与改造前同义;
-- 三条都 IF NOT EXISTS ⇒ 可重放。

--> statement-breakpoint
ALTER TABLE "user_automations" ADD COLUMN IF NOT EXISTS "terminal_reason" varchar(32);
--> statement-breakpoint
ALTER TABLE "user_automations" ADD COLUMN IF NOT EXISTS "claim_token" varchar(64);
--> statement-breakpoint
ALTER TABLE "user_automations" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp with time zone;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
