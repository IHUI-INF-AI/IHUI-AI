-- Wave 16: Exam module (试卷/题目/答题记录)
CREATE TABLE IF NOT EXISTS "exam_papers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" text,
  "category_id" uuid,
  "total_score" numeric(6,2) DEFAULT '100' NOT NULL,
  "pass_score" numeric(6,2) DEFAULT '60' NOT NULL,
  "duration" integer DEFAULT 60 NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "is_random" boolean DEFAULT false NOT NULL,
  "question_count" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "exam_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "paper_id" uuid NOT NULL REFERENCES "exam_papers"("id") ON DELETE CASCADE,
  "type" varchar(20) NOT NULL,
  "title" text NOT NULL,
  "options" jsonb,
  "answer" jsonb,
  "analysis" text,
  "score" numeric(6,2) DEFAULT '5' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "exam_questions_paper_idx" ON "exam_questions"("paper_id");

CREATE TABLE IF NOT EXISTS "exam_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "paper_id" uuid NOT NULL REFERENCES "exam_papers"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "answers" jsonb,
  "score" numeric(6,2) DEFAULT '0' NOT NULL,
  "is_passed" boolean DEFAULT false NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "started_at" timestamptz DEFAULT now() NOT NULL,
  "submitted_at" timestamptz,
  "duration" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "exam_records_user_idx" ON "exam_records"("user_id");
CREATE INDEX IF NOT EXISTS "exam_records_paper_idx" ON "exam_records"("paper_id");
