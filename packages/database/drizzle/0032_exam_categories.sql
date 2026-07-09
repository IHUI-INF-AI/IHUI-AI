-- Exam categories table (试卷分类)
CREATE TABLE IF NOT EXISTS "exam_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "pid" uuid,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "exam_categories_pid_idx" ON "exam_categories"("pid");

-- Add FK: exam_papers.category_id -> exam_categories.id (ON DELETE SET NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exam_papers_category_id_exam_categories_id_fk'
  ) THEN
    ALTER TABLE "exam_papers"
      ADD CONSTRAINT "exam_papers_category_id_exam_categories_id_fk"
      FOREIGN KEY ("category_id") REFERENCES "exam_categories"("id")
      ON DELETE SET NULL;
  END IF;
END $$;
