-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- ============================================================================
-- study_plans.lesson_id —— 给学习计划补上"课程(lessons)"外键(G-978070/978073 后续)。
--
-- 背景:/api/study/plans 每行其实是一条**报名记录**(lesson_sign_ups ⋈ lessons),
-- 其 title 直接取 lessons.title ⇒ 对外 title 与 courseName 天然同源。根因是
-- study_plans 此前根本没有 lessons 外键,谁也拿不到"计划自己关联的课程"。
-- 本迁移只补载体:**不回填、不改 title、不改任何既有行内容**。
--
-- 口径说明(三条,都是刻意选择):
--   ① FK 动作用 ON DELETE SET NULL(同 learn.ts 的 lessons.category_id),
--      **不用 CASCADE** —— 课程下架不该连带删掉用户的计划。
--   ② 可空且无默认值:历史行的 lesson_id 无可信来源可推断(报名记录与计划之间
--      目前没有任何关联列),按标题/时间猜等于制造假数据 ⇒ 一律留 NULL。
--   ③ ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS ⇒ 可重复执行,
--      重复跑不改变结果。
-- ============================================================================

--> statement-breakpoint
ALTER TABLE "study_plans" ADD COLUMN IF NOT EXISTS "lesson_id" uuid REFERENCES "lessons"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_plans_lesson_idx" ON "study_plans" USING btree ("lesson_id");
