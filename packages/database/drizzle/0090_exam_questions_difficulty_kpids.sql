-- 补齐 exam_questions 表缺失字段:difficulty / knowledge_point_ids
-- 对应 schema: packages/database/src/schema/exam.ts examQuestions.difficulty/knowledgePointIds
-- 注:这些列已在 0083 之前的 migration 中添加,本 migration 为幂等补齐(journal 引用)
ALTER TABLE "exam_questions"
  ADD COLUMN IF NOT EXISTS "difficulty" integer DEFAULT 3 NOT NULL,
  ADD COLUMN IF NOT EXISTS "knowledge_point_ids" jsonb;
