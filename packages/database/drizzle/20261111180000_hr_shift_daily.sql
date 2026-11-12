-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Migration 20261111180000: 人事考勤第 1 期·工时与假期额度数据模型(HR-2)
-- 创建时间: 2026-11-11
-- 描述: 在 HR-1 的原始签到签退(hr_attendance_record)之上补四张表,让「工时核算」与
--       「假期额度」有据可依:
--         · hr_shift            部门班次(上下班时刻/弹性/跨天)
--         · hr_attendance_daily 日结(应出勤/实出勤/迟到早退加班分钟,由 HR-1 日任务产出)
--         · hr_leave_balance    假期额度(员工×假别×年度记账,请假提交时校验)
--         · hr_punch_fix        补卡申请(审批通过后回写 hr_attendance_record)
--       月度汇总、年假余额、忘打卡自助补卡三件事不再靠人工。
--
-- 幂等安全:IF NOT EXISTS 守门,可安全重复执行。
-- 与 packages/database/src/schema/hr-shift-daily.ts 逐字对齐。
--
-- 执行方式(与项目 202610*/2026110* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20261111180000_hr_shift_daily.sql

-- ============ hr_shift 部门班次 ============
CREATE TABLE IF NOT EXISTS "hr_shift" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "department_id" uuid NOT NULL REFERENCES "hr_department"("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "start_time" time NOT NULL,
  "end_time" time NOT NULL,
  "flex_minutes" integer DEFAULT 0 NOT NULL,
  "crosses_midnight" boolean DEFAULT false NOT NULL,
  "status" varchar(20) DEFAULT 'enabled' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "ix_hr_shift_dept" ON "hr_shift" ("department_id");
CREATE INDEX IF NOT EXISTS "ix_hr_shift_status" ON "hr_shift" ("status");

-- ============ hr_attendance_daily 考勤日结 ============
CREATE TABLE IF NOT EXISTS "hr_attendance_daily" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "department_id" uuid NOT NULL REFERENCES "hr_department"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "shift_id" uuid REFERENCES "hr_shift"("id") ON DELETE SET NULL,
  "scheduled_minutes" integer DEFAULT 0 NOT NULL,
  "actual_minutes" integer DEFAULT 0 NOT NULL,
  "late_minutes" integer DEFAULT 0 NOT NULL,
  "early_minutes" integer DEFAULT 0 NOT NULL,
  "overtime_minutes" integer DEFAULT 0 NOT NULL,
  "status" varchar(20) DEFAULT 'present' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_hr_daily_emp_date" ON "hr_attendance_daily" ("employee_id", "date");
CREATE INDEX IF NOT EXISTS "ix_hr_daily_dept_date" ON "hr_attendance_daily" ("department_id", "date");
CREATE INDEX IF NOT EXISTS "ix_hr_daily_status" ON "hr_attendance_daily" ("status");
-- 同一员工同一部门同一日只应有一行日结(与 hr_attendance_record 幂等口径一致)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_hr_daily_emp_dept_date" ON "hr_attendance_daily" ("employee_id", "department_id", "date");

-- ============ hr_leave_balance 假期额度 ============
CREATE TABLE IF NOT EXISTS "hr_leave_balance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "leave_type" varchar(30) NOT NULL,
  "year" integer NOT NULL,
  "total_days" integer DEFAULT 0 NOT NULL,
  "used_days" integer DEFAULT 0 NOT NULL,
  "frozen_days" integer DEFAULT 0 NOT NULL,
  "remaining_days" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_hr_leave_bal_emp" ON "hr_leave_balance" ("employee_id");
CREATE INDEX IF NOT EXISTS "ix_hr_leave_bal_type_year" ON "hr_leave_balance" ("leave_type", "year");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_hr_leave_bal_emp_type_year" ON "hr_leave_balance" ("employee_id", "leave_type", "year");

-- ============ hr_punch_fix 补卡申请 ============
CREATE TABLE IF NOT EXISTS "hr_punch_fix" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "department_id" uuid NOT NULL REFERENCES "hr_department"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "punch_type" varchar(20) NOT NULL,
  "punch_time" timestamptz,
  "reason" text NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "approver_id" uuid REFERENCES "users"("id"),
  "approve_remark" text,
  "approve_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_hr_punch_fix_emp_date" ON "hr_punch_fix" ("employee_id", "date");
CREATE INDEX IF NOT EXISTS "ix_hr_punch_fix_dept_date" ON "hr_punch_fix" ("department_id", "date");
CREATE INDEX IF NOT EXISTS "ix_hr_punch_fix_status" ON "hr_punch_fix" ("status");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
