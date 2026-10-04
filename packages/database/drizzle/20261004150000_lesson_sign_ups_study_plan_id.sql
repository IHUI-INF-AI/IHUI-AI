-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- ============================================================================
-- lesson_sign_ups.study_plan_id —— 给报名记录补上"学习计划(study_plans)"外键。
--
-- 背景:/api/study/plans 每行其实是一条**报名记录**(lesson_sign_ups ⋈ lessons),
-- 其 title 直接取 lessons.title ⇒ 对外 title 与 courseName 天然同源。上一轮迁移
-- (20261004103000_study_plans_lesson_id)给 study_plans 补了 lessons 外键,但方向是
-- 反的:报名侧仍拿不到"这条报名属于哪个计划"。本迁移补上报名 → 计划这一侧,
-- 读侧才能 leftJoin 出**真正的计划名**(study_plans.title)与**课程名**(lessons.title),
-- 两者天然不同源。
--
-- 口径说明(四条,都是刻意选择):
--   ① FK 动作用 ON DELETE SET NULL(同上一轮 study_plans.lesson_id),
--      **不用 CASCADE** —— 计划被删不该连带删掉用户的报名记录。
--   ② 可空且无默认值:历史行的 study_plan_id 无可信来源可推断(此前报名与计划之间
--      根本没有任何关联列),按标题/时间猜等于制造假数据 ⇒ 一律留 NULL,
--      读侧 leftJoin 出来是 NULL 并回落到 lessonTitle(这是"没有计划"的正常态,不是缺陷)。
--   ③ UNIQUE(lesson_id, user_id) 决定同一课程同一用户只有一行报名 ⇒ 一对一候选,
--      因此**不**再加 study_plan_id 上的唯一约束。
--   ④ ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS ⇒ 可重复执行,
--      重复跑不改变结果。
-- ============================================================================

--> statement-breakpoint
ALTER TABLE "lesson_sign_ups" ADD COLUMN IF NOT EXISTS "study_plan_id" uuid REFERENCES "study_plans"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_sign_ups_study_plan_idx" ON "lesson_sign_ups" USING btree ("study_plan_id");
