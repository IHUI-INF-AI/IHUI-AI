-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:watermarked

-- Migration 20261112220000: 月结与薪资配置建表(HR-5 第 4 期)
-- 创建时间: 2026-11-12
-- 描述: schema 文件早已写好(hr-attendance-monthly.ts / hr-salary-config.ts),
--       但**从未建过表** —— 导致月结、薪资、个税配置全都跑不起来。
--       本迁移补齐 6 张表:
--         · hr_attendance_monthly      月度考勤汇总(日结汇总结果)
--         · hr_payroll_period          薪资周期
--         · hr_payroll_item            薪资明细(含可审计的 breakdown)
--         · hr_salary_config           员工薪资配置
--         · hr_insurance_rate_config   地区社保公积金费率
--         · hr_employee_tax_profile    个税专项附加扣除档案
--
-- 幂等安全:CREATE TABLE IF NOT EXISTS,可安全重复执行。
-- 与 packages/database/src/schema/hr-attendance-monthly.ts、hr-salary-config.ts 逐字对齐。
--
-- 执行方式:
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20261112220000_hr_monthly_payroll.sql

-- ============ hr_attendance_monthly 月度考勤汇总 ============
CREATE TABLE IF NOT EXISTS "hr_attendance_monthly" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "period_month" varchar(7) NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "department_id" uuid NOT NULL REFERENCES "hr_department"("id") ON DELETE CASCADE,
  "scheduled_days" numeric(5,1) NOT NULL,
  "actual_days" numeric(5,1) NOT NULL,
  "late_count" integer DEFAULT 0 NOT NULL,
  "early_count" integer DEFAULT 0 NOT NULL,
  "absent_days" numeric(5,1) DEFAULT '0' NOT NULL,
  "leave_days" jsonb,
  "ot_hours" numeric(6,2) DEFAULT '0' NOT NULL,
  "ot_detail" jsonb,
  "source_batch_id" uuid REFERENCES "hr_import_batch"("id"),
  "generated_by" varchar(20) DEFAULT 'system_job' NOT NULL,
  "signed" boolean DEFAULT false NOT NULL,
  "signed_by" uuid REFERENCES "users"("id"),
  "signed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_hr_att_monthly_period_emp"
  ON "hr_attendance_monthly" ("period_month", "employee_id");
CREATE INDEX IF NOT EXISTS "ix_hr_att_monthly_period" ON "hr_attendance_monthly" ("period_month");
CREATE INDEX IF NOT EXISTS "ix_hr_att_monthly_dept" ON "hr_attendance_monthly" ("department_id");

-- ============ hr_payroll_period 薪资周期 ============
CREATE TABLE IF NOT EXISTS "hr_payroll_period" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "period_month" varchar(7) NOT NULL UNIQUE,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "attendance_sheet_file_id" uuid REFERENCES "files"("id"),
  "payroll_sheet_file_id" uuid REFERENCES "files"("id"),
  "closed_at" timestamptz,
  "operator_id" uuid REFERENCES "users"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_hr_pay_period_month" ON "hr_payroll_period" ("period_month");

-- ============ hr_payroll_item 薪资明细 ============
CREATE TABLE IF NOT EXISTS "hr_payroll_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "period_id" uuid NOT NULL REFERENCES "hr_payroll_period"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "base_salary" numeric(12,2) NOT NULL,
  "ot_amount" numeric(12,2) DEFAULT '0' NOT NULL,
  "allowance" numeric(12,2) DEFAULT '0' NOT NULL,
  "attendance_deduction" numeric(12,2) DEFAULT '0' NOT NULL,
  "gross_pay" numeric(12,2) NOT NULL,
  "insurance_personal" numeric(12,2) DEFAULT '0' NOT NULL,
  "housing_fund_personal" numeric(12,2) DEFAULT '0' NOT NULL,
  "taxable_income" numeric(12,2) DEFAULT '0' NOT NULL,
  "income_tax" numeric(12,2) DEFAULT '0' NOT NULL,
  "other_deduction" numeric(12,2) DEFAULT '0' NOT NULL,
  "net_pay" numeric(12,2) NOT NULL,
  "breakdown" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_hr_payroll_period_emp"
  ON "hr_payroll_item" ("period_id", "employee_id");
CREATE INDEX IF NOT EXISTS "ix_hr_payroll_item_period" ON "hr_payroll_item" ("period_id");

-- ============ hr_salary_config 员工薪资配置 ============
CREATE TABLE IF NOT EXISTS "hr_salary_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "base_salary" numeric(12,2) NOT NULL,
  "ot_base" numeric(12,2),
  "insurance_base" numeric(12,2),
  "housing_fund_rate" numeric(5,4),
  "fixed_allowance" numeric(12,2) DEFAULT '0' NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_hr_sal_cfg_emp" ON "hr_salary_config" ("employee_id");
CREATE INDEX IF NOT EXISTS "ix_hr_sal_cfg_emp_from" ON "hr_salary_config" ("employee_id", "effective_from");

-- ============ hr_insurance_rate_config 地区社保公积金费率 ============
CREATE TABLE IF NOT EXISTS "hr_insurance_rate_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "region_name" varchar(100) NOT NULL,
  "pension_employer" numeric(5,4),
  "pension_personal" numeric(5,4),
  "unemployment_employer" numeric(5,4),
  "unemployment_personal" numeric(5,4),
  "medical_employer" numeric(5,4),
  "medical_personal" numeric(5,4),
  "injury_employer" numeric(5,4),
  "housing_fund_rate" numeric(5,4),
  "insurance_base_min" numeric(12,2),
  "insurance_base_max" numeric(12,2),
  "fund_base_min" numeric(12,2),
  "fund_base_max" numeric(12,2),
  "effective_year" integer NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_hr_ins_region_year"
  ON "hr_insurance_rate_config" ("region_name", "effective_year");

-- ============ hr_employee_tax_profile 个税专项附加扣除 ============
CREATE TABLE IF NOT EXISTS "hr_employee_tax_profile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "children_count" integer DEFAULT 0 NOT NULL,
  "children_deduction_ratio" numeric(4,2) DEFAULT '1' NOT NULL,
  "infant_count" integer DEFAULT 0 NOT NULL,
  "is_only_child" boolean DEFAULT true NOT NULL,
  "elderly_support_share" numeric(12,2),
  "housing_type" varchar(10) DEFAULT 'none' NOT NULL,
  "housing_rent_amount" numeric(12,2),
  "other_monthly_deduction" numeric(12,2) DEFAULT '0' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_hr_tax_prof_emp" ON "hr_employee_tax_profile" ("employee_id");
