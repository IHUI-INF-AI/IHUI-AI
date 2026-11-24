-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Migration 20261123050000: 发薪闭环(代发批次 + 工资条)
-- 创建时间: 2026-11-23
-- 描述:
--   1) hr_employee 补收款账户三列(bank_name / bank_account_no / bank_account_name);
--   2) hr_payroll_payout —— 代发批次(导出文件指纹、人数、总额、状态流转);
--   3) hr_payslip —— 一人一月一条工资条(冻结快照 + 推送/签收留痕)。
-- 幂等安全:全部 IF NOT EXISTS。

ALTER TABLE "hr_employee" ADD COLUMN IF NOT EXISTS "bank_name" varchar(100);
ALTER TABLE "hr_employee" ADD COLUMN IF NOT EXISTS "bank_account_no" varchar(40);
ALTER TABLE "hr_employee" ADD COLUMN IF NOT EXISTS "bank_account_name" varchar(100);

CREATE TABLE IF NOT EXISTS "hr_payroll_payout" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "period_id" uuid NOT NULL,
  "period_month" varchar(7) NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "file_hash" varchar(64),
  "file_rows" integer DEFAULT 0 NOT NULL,
  "head_count" integer DEFAULT 0 NOT NULL,
  "total_amount" numeric(16,2) DEFAULT '0.00' NOT NULL,
  "missing_accounts" jsonb,
  "exported_at" timestamptz,
  "submitted_at" timestamptz,
  "paid_at" timestamptz,
  "operator_id" uuid,
  "note" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "hr_payroll_payout_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "hr_payroll_period" ("id") ON DELETE CASCADE,
  CONSTRAINT "hr_payroll_payout_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "ix_hr_payout_period" ON "hr_payroll_payout" ("period_month", "status");

CREATE TABLE IF NOT EXISTS "hr_payslip" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "period_id" uuid NOT NULL,
  "period_month" varchar(7) NOT NULL,
  "employee_id" uuid NOT NULL,
  "payroll_item_id" uuid NOT NULL,
  "status" varchar(20) DEFAULT 'generated' NOT NULL,
  "snapshot" jsonb,
  "channel" varchar(30),
  "pushed_at" timestamptz,
  "acknowledged_at" timestamptz,
  "ack_channel" varchar(30),
  "remark" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "hr_payslip_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "hr_payroll_period" ("id") ON DELETE CASCADE,
  CONSTRAINT "hr_payslip_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employee" ("id") ON DELETE CASCADE,
  CONSTRAINT "hr_payslip_payroll_item_id_fkey" FOREIGN KEY ("payroll_item_id") REFERENCES "hr_payroll_item" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_hr_payslip_period_emp" ON "hr_payslip" ("period_id", "employee_id");
CREATE INDEX IF NOT EXISTS "ix_hr_payslip_status" ON "hr_payslip" ("period_month", "status");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
