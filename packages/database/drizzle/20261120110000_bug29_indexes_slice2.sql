-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- BUG-29 索引补齐 入链切片 2：格1 外键列无索引 —— ②段冻结后 schema 漂移的 15 处真缺口
-- 来源：scripts/bug29-reconcile.mjs 现读对账（权威131 → 已补116 / 未补15），与
--       drizzle-pending-review/BUG29-sec2-drift-20261120.json(still_missing_total=15) 逐项一致。
-- 缺口构成：comments.parent_id(②段漏建) + hr_*(8表12处,11-11~13新增) + workflow_todo(2处,11-13新增)
--           + traders.user_id(baseline 遗留)。
-- 入链决策：这 15 处均为近期新增/小表，普通 CREATE INDEX IF NOT EXISTS 短锁即可，
--           不含 CONCURRENTLY / DO 块，可在 drizzle-kit migrate 事务内安全执行。
-- 幂等：全部 IF NOT EXISTS，可重复跑；只补索引，不删对象、不改数据。
-- 回滚（需 DBA 在生产库执行）：
--   DROP INDEX IF EXISTS "ix_comments_parent_id";
--   DROP INDEX IF EXISTS "ix_hr_attendance_daily_shift_id";
--   DROP INDEX IF EXISTS "ix_hr_attendance_monthly_signed_by";
--   DROP INDEX IF EXISTS "ix_hr_attendance_monthly_source_batch_id";
--   DROP INDEX IF EXISTS "ix_hr_import_batch_uploaded_by";
--   DROP INDEX IF EXISTS "ix_hr_import_row_resolved_by";
--   DROP INDEX IF EXISTS "ix_hr_outgoing_record_operated_by";
--   DROP INDEX IF EXISTS "ix_hr_overtime_record_operated_by";
--   DROP INDEX IF EXISTS "ix_hr_payroll_period_attendance_sheet_file_id";
--   DROP INDEX IF EXISTS "ix_hr_payroll_period_operator_id";
--   DROP INDEX IF EXISTS "ix_hr_payroll_period_payroll_sheet_file_id";
--   DROP INDEX IF EXISTS "ix_hr_salary_config_created_by";
--   DROP INDEX IF EXISTS "ix_traders_user_id";
--   DROP INDEX IF EXISTS "ix_workflow_todo_assignee_id";
--   DROP INDEX IF EXISTS "ix_workflow_todo_resolved_by";

CREATE INDEX IF NOT EXISTS "ix_comments_parent_id" ON "comments" ("parent_id");
CREATE INDEX IF NOT EXISTS "ix_hr_attendance_daily_shift_id" ON "hr_attendance_daily" ("shift_id");
CREATE INDEX IF NOT EXISTS "ix_hr_attendance_monthly_signed_by" ON "hr_attendance_monthly" ("signed_by");
CREATE INDEX IF NOT EXISTS "ix_hr_attendance_monthly_source_batch_id" ON "hr_attendance_monthly" ("source_batch_id");
CREATE INDEX IF NOT EXISTS "ix_hr_import_batch_uploaded_by" ON "hr_import_batch" ("uploaded_by");
CREATE INDEX IF NOT EXISTS "ix_hr_import_row_resolved_by" ON "hr_import_row" ("resolved_by");
CREATE INDEX IF NOT EXISTS "ix_hr_outgoing_record_operated_by" ON "hr_outgoing_record" ("operated_by");
CREATE INDEX IF NOT EXISTS "ix_hr_overtime_record_operated_by" ON "hr_overtime_record" ("operated_by");
CREATE INDEX IF NOT EXISTS "ix_hr_payroll_period_attendance_sheet_file_id" ON "hr_payroll_period" ("attendance_sheet_file_id");
CREATE INDEX IF NOT EXISTS "ix_hr_payroll_period_operator_id" ON "hr_payroll_period" ("operator_id");
CREATE INDEX IF NOT EXISTS "ix_hr_payroll_period_payroll_sheet_file_id" ON "hr_payroll_period" ("payroll_sheet_file_id");
CREATE INDEX IF NOT EXISTS "ix_hr_salary_config_created_by" ON "hr_salary_config" ("created_by");
CREATE INDEX IF NOT EXISTS "ix_traders_user_id" ON "traders" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_workflow_todo_assignee_id" ON "workflow_todo" ("assignee_id");
CREATE INDEX IF NOT EXISTS "ix_workflow_todo_resolved_by" ON "workflow_todo" ("resolved_by");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
