-- Wave 24: 教育平台 Topic 模块（课程专题）

CREATE TABLE IF NOT EXISTS "edu_lesson_topics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(200) NOT NULL,
  "cover_image" varchar(512),
  "description" text,
  "lesson_ids" jsonb,
  "is_published" boolean DEFAULT false NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_lesson_topics_published_idx" ON "edu_lesson_topics"("is_published");
CREATE INDEX IF NOT EXISTS "edu_lesson_topics_status_idx" ON "edu_lesson_topics"("status");
