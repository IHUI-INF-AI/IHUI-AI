-- 用户课程报名表 (uuid 体系,替代旧 edu_sign_up 的 integer memberId)
CREATE TABLE IF NOT EXISTS "user_course_enrollments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"."id" ON DELETE CASCADE,
  "course_id" uuid NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "user_course_enrollments_user_idx" ON "user_course_enrollments" ("user_id");

-- 用户学习记录表 (uuid 体系,替代旧 edu_lesson_study_record 的 integer memberId)
CREATE TABLE IF NOT EXISTS "user_learn_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"."id" ON DELETE CASCADE,
  "lesson_id" uuid NOT NULL,
  "study_duration" integer DEFAULT 0 NOT NULL,
  "progress" real DEFAULT 0 NOT NULL,
  "last_position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "user_learn_records_user_idx" ON "user_learn_records" ("user_id");
