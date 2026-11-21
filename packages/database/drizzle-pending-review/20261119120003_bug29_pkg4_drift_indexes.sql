-- BUG-29 入链准备 包 4/4:补齐 ②段(11-06 冻结)之后 schema 漂移新增的 FK 列索引。
-- 背景:②段基于 11-06 的 schema 快照,而 11-11~11-13 又新增了 hr_attendance_daily / hr_attendance_monthly /
--   hr_import_batch / hr_import_row / hr_outgoing_record / hr_overtime_record / hr_payroll_period /
--   hr_salary_config(8 表 12 缺口)与 workflow_todo(11-13,2 缺口);这些 FK 列天然未被 ②段覆盖。
--   另 comments.parent_id 为 ②段自身漏建,traders.user_id 为 baseline 遗留。合计 15 处真缺口。
-- 来源清单: drizzle-pending-review/BUG29-sec2-drift-20261120.json(still_missing_total=15)。
-- 与包1 关系:本包**只用普通 CREATE INDEX IF NOT EXISTS,不用 CONCURRENTLY**——
--   这 15 个都是近期新增/小表,量小可短锁;若 DBA 判断其中某表已上量,可单独改 CONCURRENTLY。
--   索引名遵循迁移链 hr_* 惯例 <ix_表_列>。
-- 执行通道:与包1 相同,**事务外 psql** 逐件跑;不进 journal。
-- 幂等:全部 IF NOT EXISTS,可重复执行。本件只补齐,不删除既有对象、不改数据。
-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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

-- 包4 实际生成索引语句数: 15
