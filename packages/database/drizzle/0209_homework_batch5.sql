-- 批次5：作业管理 - 作业提交记录表
CREATE TABLE IF NOT EXISTS "edu_homework_submission" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "homework_id" uuid NOT NULL,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "edu_class"("id") ON DELETE CASCADE,
  "content" text,
  "attachment" varchar(500),
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "score" integer,
  "comment" text,
  "teacher_id" uuid REFERENCES "users"("id"),
  "graded_at" timestamp with time zone,
  "status" varchar(20) DEFAULT 'submitted' NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_edu_hw_sub_homework" ON "edu_homework_submission" ("homework_id");
CREATE INDEX IF NOT EXISTS "ix_edu_hw_sub_student" ON "edu_homework_submission" ("student_id");
CREATE INDEX IF NOT EXISTS "ix_edu_hw_sub_class" ON "edu_homework_submission" ("class_id");
CREATE INDEX IF NOT EXISTS "ix_edu_hw_sub_status" ON "edu_homework_submission" ("status");