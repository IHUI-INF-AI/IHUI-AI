-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


-- Migration 20261112180000: 人事审批实例快照扩容(HR-3 第 2 期)
-- 创建时间: 2026-11-12
-- 描述: 把 hr_approval_instance 的快照固化范围从「仅审批链 chain_snapshot」扩到
--       「链 + 代理 + 超时时限 + 超时升级目标」全套。原实现里链是提交时固化的,
--       但代理(approver_proxy_id)和超时时限(timeout_hours)在 decide / escalate
--       时会重新路由取实时规则,导致规则中途改动会影响在飞实例 —— 与「链固化」
--       的隔离哲学不一致。本迁移给在飞实例补齐三列快照,使其提交后即与规则解耦:
--         · approver_proxy_snapshot     提交时刻的代理审批人(NULL=该链无代理)
--         · timeout_hours_snapshot      提交时刻的审批时限(小时)
--         · escalation_approver_snapshot 提交时刻的超时升级目标(NULL=到点仅记轨迹不换人)
--
-- 回填(backfill):已存在的在飞实例按其当前命中的规则回填三列,保证升级后行为与
--       升级前一致(即沿用提交时命中的规则)。规则后续再改动才不影响它们。
--       用相关子查询取「该假别 + 天数区间命中的最具体规则(min_days 最大)」,与
--       routeApprovalFlow 的应用层判据一致。
--
-- 幂等安全:IF NOT EXISTS / WHERE NOT EXISTS 守门,可安全重复执行。
-- 与 packages/database/src/schema/hr-approval-flow.ts 逐字对齐。
--
-- 执行方式:
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20261112180000_hr_approval_snapshot.sql

-- ============ hr_approval_instance 补齐快照列 ============
ALTER TABLE "hr_approval_instance"
  ADD COLUMN IF NOT EXISTS "approver_proxy_snapshot" uuid;
ALTER TABLE "hr_approval_instance"
  ADD COLUMN IF NOT EXISTS "timeout_hours_snapshot" integer DEFAULT 24 NOT NULL;
ALTER TABLE "hr_approval_instance"
  ADD COLUMN IF NOT EXISTS "escalation_approver_snapshot" uuid;

-- ============ 回填:按当前命中规则补齐在飞实例的三列快照 ============
-- 取「假别相同 ∧ active ∧ 未软删 ∧ min_days<=total_days ∧(max_days 空 ∨ total_days<max_days)」
-- 中 min_days 最大者(最具体规则优先),与 service 的 routeApprovalFlow 判据一致。
-- 守门:仅回填三列全为默认值(approver_proxy IS NULL AND timeout_hours = 24 AND
--       escalation_approver IS NULL)的实例 —— 即迁移刚加上、尚未被应用层显式写入
--       非默认值的行。幂等:重复执行时已回填行三列不再同时为默认值,自动跳过。
-- 注意:UPDATE 的 FROM 子查询不能 LATERAL 引用被更新目标表(PostgreSQL 42P10),
--       故把「待回填实例 ⨝ 命中规则」的配对整体放进 FROM 子查询,再按实例 id 回连更新。
UPDATE "hr_approval_instance" AS inst
SET
  "approver_proxy_snapshot" = pair."approver_proxy_id",
  "timeout_hours_snapshot" = pair."timeout_hours",
  "escalation_approver_snapshot" = pair."escalation_approver_id"
FROM (
  SELECT DISTINCT ON (i."id")
    i."id" AS inst_id,
    fl."approver_proxy_id",
    fl."timeout_hours",
    fl."escalation_approver_id"
  FROM "hr_approval_instance" i
  JOIN "hr_leave_request" lr ON lr."id" = i."leave_request_id"
  JOIN "hr_approval_flow" fl
    ON fl."leave_type" = lr."leave_type"
   AND fl."status" = 'active'
   AND fl."deleted_at" IS NULL
   AND fl."min_days" <= lr."total_days"
   AND (fl."max_days" IS NULL OR lr."total_days" < fl."max_days")
  WHERE i."approver_proxy_snapshot" IS NULL
    AND i."timeout_hours_snapshot" = 24
    AND i."escalation_approver_snapshot" IS NULL
  ORDER BY i."id", fl."min_days" DESC
) pair
WHERE inst."id" = pair."inst_id";
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
