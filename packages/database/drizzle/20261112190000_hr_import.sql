-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:watermarked

-- Migration 20261112190000: 人事考勤导入与核对(HR-5 第 2 期)
-- 创建时间: 2026-11-12
-- 描述: 让飞书/钉钉/企业微信导出的打卡表能进系统,且**不牺牲准确性**。
--       两条表:
--         · hr_import_batch 导入批次(文件 SHA-256 防重、列映射、四类行计数)
--         · hr_import_row   导入行明细(原始行 + 解析值 + 差异明细 + 裁决结果)
--       铁律:先进暂存、差异必须人工裁决、绝不自动覆盖系统记录。
--       原始文件走 storage-service(storage_file_id),不挂 files 表 ——
--       files.project_id 为必填且外键到 projects,人事考勤导入不属于任何项目。
--
-- 幂等安全:IF NOT EXISTS 守门,可安全重复执行。
-- 与 packages/database/src/schema/hr-import.ts 逐字对齐。
--
-- 执行方式:
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20261112190000_hr_import.sql

-- ============ hr_import_batch 导入批次 ============
CREATE TABLE IF NOT EXISTS "hr_import_batch" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "period_month" varchar(7) NOT NULL,
  "storage_file_id" uuid NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "file_hash" varchar(64) NOT NULL,
  "status" varchar(20) DEFAULT 'parsing' NOT NULL,
  "total_rows" integer DEFAULT 0 NOT NULL,
  "matched_rows" integer DEFAULT 0 NOT NULL,
  "conflict_rows" integer DEFAULT 0 NOT NULL,
  "not_found_rows" integer DEFAULT 0 NOT NULL,
  "mapping_config" jsonb,
  "uploaded_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_hr_imp_batch_period" ON "hr_import_batch" ("period_month");
CREATE INDEX IF NOT EXISTS "ix_hr_imp_batch_hash" ON "hr_import_batch" ("file_hash");

-- ============ hr_import_row 导入行明细 ============
CREATE TABLE IF NOT EXISTS "hr_import_row" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL REFERENCES "hr_import_batch"("id") ON DELETE CASCADE,
  "row_number" integer NOT NULL,
  "employee_no" varchar(50),
  "raw" jsonb,
  "parsed" jsonb,
  "match_status" varchar(20) DEFAULT 'pending' NOT NULL,
  "diff_detail" jsonb,
  "resolved" boolean DEFAULT false NOT NULL,
  "resolution" varchar(20),
  "final_value" jsonb,
  "resolved_by" uuid REFERENCES "users"("id"),
  "resolved_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "ix_hr_imp_row_batch" ON "hr_import_row" ("batch_id");
CREATE INDEX IF NOT EXISTS "ix_hr_imp_row_status" ON "hr_import_row" ("batch_id", "match_status");
CREATE INDEX IF NOT EXISTS "ix_hr_imp_row_emp" ON "hr_import_row" ("employee_no");
