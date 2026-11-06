-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 补偿迁移(2026-11-07): edu_attendance_rule 唯一约束改软删感知(partial unique)
-- 证据: packages/database/src/schema/edu-ai-management.ts:271 对 classId 全局 unique,同表有 deleted_at 软删;
-- 实库约束 edu_attendance_rule_class_id_unique UNIQUE(class_id)。dev 实测 total=0 soft_deleted=0,无历史冲突;
-- 迁移仍先探测"未删除行重复",有重复则明确报错,不静默失败。
DO $$
DECLARE dup int;
BEGIN
  IF to_regclass('public.edu_attendance_rule') IS NOT NULL THEN
    SELECT count(*) INTO dup FROM (
      SELECT "class_id" FROM "public"."edu_attendance_rule"
       WHERE "deleted_at" IS NULL
       GROUP BY "class_id" HAVING count(*) > 1
    ) x;
    IF dup > 0 THEN
      RAISE EXCEPTION 'edu_attendance_rule: % 个 class_id 在未删除行中重复,需先人工合并再迁移', dup;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'edu_attendance_rule_class_id_unique'
        AND conrelid = 'public.edu_attendance_rule'::regclass
    ) THEN
      ALTER TABLE "public"."edu_attendance_rule" DROP CONSTRAINT "edu_attendance_rule_class_id_unique";
    END IF;
    CREATE UNIQUE INDEX IF NOT EXISTS "edu_attendance_rule_class_id_live_unique"
      ON "public"."edu_attendance_rule" ("class_id") WHERE "deleted_at" IS NULL;
  END IF;
END $$;--> statement-breakpoint
