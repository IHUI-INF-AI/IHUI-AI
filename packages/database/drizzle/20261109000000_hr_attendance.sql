-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-- Migration 20261109000000: 人事部考勤板块(独立板块)落库
-- 创建时间: 2026-11-09
-- 描述: 与教育板块(edu_*) 共享 @ihui/attendance-core 判定内核,本迁移只建人事主体表 +
--       考勤规则/记录/请假表。判定阈值与扫码密钥落库,作为后端自动判定与缺勤补录的数据源。
--
-- 幂等安全:全部使用 IF NOT EXISTS / DO $$ 守门,可安全重复执行。
-- 与 packages/database/src/schema/hr-ai-management.ts 逐字对齐;约束名/索引名一律用 drizzle 默认形态,
-- 以免后续 `pnpm --filter @ihui/database db:generate` 产出 drop+create 噪音。
--
-- 执行方式(与项目 202610*/2026110* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20261109000000_hr_attendance.sql

CREATE TABLE IF NOT EXISTS "hr_department" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "parent_id" uuid,
  "leader_employee_id" uuid,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_hr_dept_parent" ON "hr_department" ("parent_id");

CREATE TABLE IF NOT EXISTS "hr_employee" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "employee_no" varchar(50) NOT NULL,
  "name" varchar(100) NOT NULL,
  "department_id" uuid NOT NULL,
  "position" varchar(100),
  "hire_date" date,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "phone" varchar(30),
  "id_number" varchar(30),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  CONSTRAINT "hr_employee_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "hr_department" ("id") ON DELETE CASCADE,
  CONSTRAINT "hr_employee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "ix_hr_emp_dept" ON "hr_employee" ("department_id");
CREATE INDEX IF NOT EXISTS "ix_hr_emp_status" ON "hr_employee" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_hr_emp_no" ON "hr_employee" ("employee_no");

CREATE TABLE IF NOT EXISTS "hr_attendance_rule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "department_id" uuid NOT NULL,
  "late_after" time,
  "early_before" time,
  "absent_after" time,
  "workdays" integer DEFAULT 127 NOT NULL,
  "qr_secret" varchar(64),
  "enabled" boolean DEFAULT true NOT NULL,
  "deleted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "hr_attendance_rule_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "hr_department" ("id") ON DELETE CASCADE,
  CONSTRAINT "hr_attendance_rule_department_id_unique" UNIQUE ("department_id")
);
CREATE INDEX IF NOT EXISTS "ix_hr_att_rule_dept" ON "hr_attendance_rule" ("department_id");
CREATE INDEX IF NOT EXISTS "ix_hr_att_rule_enabled" ON "hr_attendance_rule" ("enabled");

CREATE TABLE IF NOT EXISTS "hr_attendance_record" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "date" date NOT NULL,
  "check_in_time" timestamptz,
  "check_out_time" timestamptz,
  "status" varchar(20) DEFAULT 'present' NOT NULL,
  "check_in_method" varchar(20) DEFAULT 'manual' NOT NULL,
  "check_out_method" varchar(20) DEFAULT 'manual',
  "operated_by" uuid,
  "remark" text,
  "deleted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "hr_attendance_record_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employee" ("id") ON DELETE CASCADE,
  CONSTRAINT "hr_attendance_record_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "hr_department" ("id") ON DELETE CASCADE,
  CONSTRAINT "hr_attendance_record_operated_by_fkey" FOREIGN KEY ("operated_by") REFERENCES "users" ("id")
);
CREATE INDEX IF NOT EXISTS "ix_hr_att_emp_date" ON "hr_attendance_record" ("employee_id", "date");
CREATE INDEX IF NOT EXISTS "ix_hr_att_dept_date" ON "hr_attendance_record" ("department_id", "date");
CREATE INDEX IF NOT EXISTS "ix_hr_att_status" ON "hr_attendance_record" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_hr_att_emp_dept_date" ON "hr_attendance_record" ("employee_id", "department_id", "date") WHERE ("deleted_at" IS NULL);

CREATE TABLE IF NOT EXISTS "hr_leave_request" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "leave_type" varchar(30) NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "total_days" integer NOT NULL,
  "reason" text NOT NULL,
  "attachment" varchar(500),
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "approver_id" uuid,
  "approve_remark" text,
  "approve_at" timestamptz,
  "deleted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "hr_leave_request_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employee" ("id") ON DELETE CASCADE,
  CONSTRAINT "hr_leave_request_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "hr_department" ("id") ON DELETE CASCADE,
  CONSTRAINT "hr_leave_request_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users" ("id")
);
CREATE INDEX IF NOT EXISTS "ix_hr_leave_emp" ON "hr_leave_request" ("employee_id");
CREATE INDEX IF NOT EXISTS "ix_hr_leave_dept" ON "hr_leave_request" ("department_id");
CREATE INDEX IF NOT EXISTS "ix_hr_leave_status" ON "hr_leave_request" ("status");
CREATE INDEX IF NOT EXISTS "ix_hr_leave_dates" ON "hr_leave_request" ("start_date", "end_date");
