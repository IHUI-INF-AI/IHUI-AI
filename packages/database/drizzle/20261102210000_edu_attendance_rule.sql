-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Migration 20261102210000: 教育考勤判定阈值与扫码密钥落库(edu_attendance_rule)
-- 创建时间: 2026-11-02
-- 描述: edu_attendance_record 的 status 有 present/late/early/absent/leave 五个值,
--       但仓内此前无任何判定阈值(表里无到校时刻列、也没有规则表)⇒ late/early/absent
--       三值无人写入、无人补录。本迁移把阈值与扫码签到密钥落到库里,
--       作为后端自动判定与缺勤补录的数据源。
--       1. edu_attendance_rule  新表:每班级一条规则(class_id 唯一),
--          late_after/early_before/absent_after 三个 time 阈值 + qr_secret 扫码令牌密钥。
--       2. edu_attendance_record 不加列,只补一个部分唯一索引
--          (student_id, class_id, date) WHERE deleted_at IS NULL,
--          用于批量签到/缺勤补录的幂等(onConflictDoNothing 的 conflict target)。
--
-- 幂等安全:全部使用 IF NOT EXISTS / DO $$ 守门,可安全重复执行。
--
-- 与 packages/database/src/schema/edu-ai-management.ts 的 eduAttendanceRule 及
-- eduAttendanceRecord.studentClassDateUqIdx 逐字对齐;约束名/索引名一律用 drizzle 默认形态,
-- 以免后续 `pnpm --filter @ihui/database db:generate` 产出 drop+create 噪音。
--
-- 执行方式(与项目 202610*/2026110* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20261102210000_edu_attendance_rule.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20261102210000_edu_attendance_rule.sql

CREATE TABLE IF NOT EXISTS "edu_attendance_rule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "class_id" uuid NOT NULL,
  "late_after" time,
  "early_before" time,
  "absent_after" time,
  "qr_secret" varchar(64),
  "enabled" boolean DEFAULT true NOT NULL,
  "deleted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'edu_attendance_rule_class_id_unique') THEN
    ALTER TABLE "edu_attendance_rule" ADD CONSTRAINT "edu_attendance_rule_class_id_unique"
      UNIQUE ("class_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'edu_attendance_rule_class_id_edu_class_id_fk') THEN
    ALTER TABLE "edu_attendance_rule" ADD CONSTRAINT "edu_attendance_rule_class_id_edu_class_id_fk"
      FOREIGN KEY ("class_id") REFERENCES "edu_class"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ix_edu_att_rule_class" ON "edu_attendance_rule" ("class_id");
CREATE INDEX IF NOT EXISTS "ix_edu_att_rule_enabled" ON "edu_attendance_rule" ("enabled");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_edu_att_student_class_date"
  ON "edu_attendance_record" ("student_id", "class_id", "date")
  WHERE deleted_at IS NULL;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
