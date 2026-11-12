-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Migration 20261111180100: 人事请假审批流(HR-3)
-- 创建时间: 2026-11-11
-- 描述: 把请假审批从写死的二元决策(approved/rejected)升级为「按假别×天数区间路由的
--       多级审批链」:
--         · hr_approval_flow      审批规则(假别 × 天数区间 → 有序审批链),管理端维护;
--         · hr_approval_instance  审批实例(提交时把链快照固化,规则后续改动不影响在飞实例)。
--       区间语义 [min_days, max_days);命中取 min_days 最大者。
--       超时未决由 escalateTimedOut 升级到 escalation_approver_id,结果经站内信/微信订阅消息回告。
--
-- 幂等安全:IF NOT EXISTS 守门,可安全重复执行。
-- 与 packages/database/src/schema/hr-approval-flow.ts 逐字对齐。
--
-- 执行方式:
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20261111180100_hr_approval_flow.sql

-- ============ hr_approval_flow 审批规则 ============
CREATE TABLE IF NOT EXISTS "hr_approval_flow" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "leave_type" varchar(30) NOT NULL,
  "min_days" integer DEFAULT 0 NOT NULL,
  "max_days" integer,
  "approver_ids" jsonb NOT NULL,
  "approver_proxy_id" uuid,
  "timeout_hours" integer DEFAULT 24 NOT NULL,
  "escalation_approver_id" uuid,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "deleted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_hr_approval_flow_type_min" ON "hr_approval_flow" ("leave_type", "min_days");
CREATE INDEX IF NOT EXISTS "ix_hr_approval_flow_status" ON "hr_approval_flow" ("status");

-- ============ hr_approval_instance 审批实例 ============
CREATE TABLE IF NOT EXISTS "hr_approval_instance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "leave_request_id" uuid NOT NULL REFERENCES "hr_leave_request"("id") ON DELETE CASCADE,
  "current_step" integer DEFAULT 0 NOT NULL,
  "chain_snapshot" jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "steps" jsonb DEFAULT '[]' NOT NULL,
  "due_at" timestamptz,
  "submitted_at" timestamptz DEFAULT now() NOT NULL,
  "decided_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_hr_approval_inst_status_step" ON "hr_approval_instance" ("status", "current_step");
CREATE INDEX IF NOT EXISTS "ix_hr_approval_inst_leave_req" ON "hr_approval_instance" ("leave_request_id");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
