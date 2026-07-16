-- exam_papers 表新增 3 字段:题目乱序/选项乱序/难度
-- 对应 schema: packages/database/src/schema/exam.ts examPapers.questionDisordered/optionDisordered/difficulty
ALTER TABLE "exam_papers"
  ADD COLUMN IF NOT EXISTS "question_disordered" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "option_disordered" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "difficulty" integer DEFAULT 3 NOT NULL;
