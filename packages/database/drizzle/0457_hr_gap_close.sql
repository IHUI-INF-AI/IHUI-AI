-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 人事补口(2026-11-24):排班落点 / 社保增减员台账 / 年终奖单独计税 / 经济补偿 / 算薪审批留痕

-- 1) 排班(人 × 日 × 班次)
CREATE TABLE IF NOT EXISTS "hr_shift_assignment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "department_id" uuid NOT NULL REFERENCES "hr_department"("id") ON DELETE CASCADE,
  "work_date" date NOT NULL,
  "shift_id" uuid NOT NULL REFERENCES "hr_shift"("id") ON DELETE RESTRICT,
  "note" varchar(200),
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_hr_shift_assign_emp_date"
  ON "hr_shift_assignment" ("employee_id", "work_date");
CREATE INDEX IF NOT EXISTS "ix_hr_shift_assign_date"
  ON "hr_shift_assignment" ("work_date");
CREATE INDEX IF NOT EXISTS "ix_hr_shift_assign_shift"
  ON "hr_shift_assignment" ("shift_id");

-- 2) 社保/公积金增减员台账
CREATE TABLE IF NOT EXISTS "hr_social_insurance_change" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "change_type" varchar(20) NOT NULL,
  "effective_month" varchar(7) NOT NULL,
  "region_name" varchar(100),
  "insurance_base" numeric(12,2),
  "fund_base" numeric(12,2),
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "platform_ref" varchar(100),
  "note" varchar(500),
  "operator_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "submitted_at" timestamptz,
  "accepted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_hr_social_change_emp_type_month"
  ON "hr_social_insurance_change" ("employee_id", "change_type", "effective_month");
CREATE INDEX IF NOT EXISTS "ix_hr_social_change_status"
  ON "hr_social_insurance_change" ("status");
CREATE INDEX IF NOT EXISTS "ix_hr_social_change_month"
  ON "hr_social_insurance_change" ("effective_month");

-- 3) 年终奖/一次性奖金单独计税记录
CREATE TABLE IF NOT EXISTS "hr_bonus_payment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "period_month" varchar(7) NOT NULL,
  "bonus_type" varchar(20) NOT NULL DEFAULT 'annual',
  "bonus_amount" numeric(12,2) NOT NULL,
  "tax_method" varchar(20) NOT NULL DEFAULT 'separate',
  "taxable_amount" numeric(12,2) NOT NULL,
  "tax_amount" numeric(12,2) NOT NULL,
  "net_amount" numeric(12,2) NOT NULL,
  "calc_detail" jsonb,
  "status" varchar(20) NOT NULL DEFAULT 'calculated',
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ix_hr_bonus_emp_month"
  ON "hr_bonus_payment" ("employee_id", "period_month");
CREATE INDEX IF NOT EXISTS "ix_hr_bonus_month"
  ON "hr_bonus_payment" ("period_month");

-- 4) 经济补偿金测算记录
CREATE TABLE IF NOT EXISTS "hr_severance_record" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "resignation_id" uuid REFERENCES "hr_resignation"("id") ON DELETE SET NULL,
  "years_of_service" numeric(6,2) NOT NULL,
  "monthly_avg_wage" numeric(12,2) NOT NULL,
  "local_avg_monthly_wage" numeric(12,2) NOT NULL,
  "capped" boolean NOT NULL DEFAULT false,
  "compensation_amount" numeric(14,2) NOT NULL,
  "exempt_amount" numeric(14,2) NOT NULL,
  "taxable_excess" numeric(14,2) NOT NULL,
  "tax_amount" numeric(14,2) NOT NULL,
  "net_amount" numeric(14,2) NOT NULL,
  "calc_detail" jsonb,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ix_hr_severance_emp"
  ON "hr_severance_record" ("employee_id");
CREATE INDEX IF NOT EXISTS "ix_hr_severance_created"
  ON "hr_severance_record" ("created_at");

-- 5) 算薪周期审批留痕
ALTER TABLE "hr_payroll_period"
  ADD COLUMN IF NOT EXISTS "submitted_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "submitted_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "reviewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "reviewed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "review_note" varchar(500),
  ADD COLUMN IF NOT EXISTS "rejected_reason" varchar(500);
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
