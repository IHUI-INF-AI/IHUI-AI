-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:watermarked

-- Migration 20261112200000: 请假/加班导入 + 加班记录表(HR-5 第 3 期)
-- 创建时间: 2026-11-12
-- 描述: 第 2 期只做了打卡导入。本期把同一套「解析→匹配→裁决→确认」框架扩到请假与加班:
--         · hr_import_batch 增加 import_kind(attendance/leave/overtime),防重口径改为「类型+文件哈希」
--         · 新建 hr_overtime_record 加班记录表 —— 系统原先只有 hr_attendance_daily.overtime_minutes
--           这个核算结果,丢掉了「几点到几点、谁批的、什么倍率」的原始凭据,争议时无法举证
--
-- 幂等安全:ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT EXISTS,可安全重复执行。
-- 与 packages/database/src/schema/hr-import.ts、hr-overtime.ts 逐字对齐。
--
-- 执行方式:
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20261112200000_hr_import_leave_overtime.sql

-- ============ hr_import_batch 扩类型 ============
ALTER TABLE "hr_import_batch"
  ADD COLUMN IF NOT EXISTS "import_kind" varchar(20) DEFAULT 'attendance' NOT NULL;

-- 同文件防重必须按「类型 + 哈希」判:同一份文件重传为不同类型不应被拦
CREATE INDEX IF NOT EXISTS "ix_hr_imp_batch_kind_hash"
  ON "hr_import_batch" ("import_kind", "file_hash");

-- ============ hr_overtime_record 加班记录 ============
CREATE TABLE IF NOT EXISTS "hr_overtime_record" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "hr_employee"("id") ON DELETE CASCADE,
  "department_id" uuid NOT NULL REFERENCES "hr_department"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "minutes" integer NOT NULL,
  "overtime_type" varchar(20) DEFAULT 'workday' NOT NULL,
  "reason" text,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "source" varchar(20) DEFAULT 'manual' NOT NULL,
  "external_id" varchar(120),
  "operated_by" uuid REFERENCES "users"("id"),
  "deleted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_hr_ot_emp_date" ON "hr_overtime_record" ("employee_id", "date");
CREATE INDEX IF NOT EXISTS "ix_hr_ot_dept_date" ON "hr_overtime_record" ("department_id", "date");
CREATE INDEX IF NOT EXISTS "ix_hr_ot_status" ON "hr_overtime_record" ("status");
CREATE INDEX IF NOT EXISTS "ix_hr_ot_external" ON "hr_overtime_record" ("external_id");
