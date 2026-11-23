-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:PLACEHOLDER

-- Migration 20260928050000: 课程难度列（lessons.difficulty）
--
-- 为什么这份文件是本轮补出来的:
--   journal 里一直有 tag = 20260928050000_lessons_difficulty 的条目,schema 也定义了
--   lessons.difficulty(packages/database/src/schema/learn.ts:71),但 .sql 文件在
--   4fa6b2cf「仓库最终快照(仅保留当前代码,不保留历史)」里被丢掉了 —— 于是
--   migrate() 找不到对应文件、按链新建的库缺这一列,而 schema 端却以为它存在。
--   守门 check-drizzle-journal-sync.mjs 以 journalOnly=1 持续报 drift,任何
--   触碰 packages/database/drizzle 的提交都会被它拦。
--
-- 内容按 schema 反推(schema 是单源):varchar(20) / 可空 / 无默认值;
-- 取值域 beginner|intermediate|advanced 由 LESSON_DIFFICULTIES 在应用层约束,库侧不建约束。
-- IF NOT EXISTS ⇒ 对已有该列的库零副作用,可重放。

ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "difficulty" varchar(20);

COMMENT ON COLUMN "lessons"."difficulty" IS '课程难度:beginner|intermediate|advanced(应用层取值域)';

-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
