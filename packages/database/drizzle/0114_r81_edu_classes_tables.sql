-- 0114_r81_edu_classes_tables.sql
-- R81 补建: 班级课程表 + 班级成员表
-- 用于 admin.ts /edu/classes/schedules + /edu/classes/:id/members 真实化

-- 表 1: edu_classes_schedules
CREATE TABLE IF NOT EXISTS "edu_classes_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "class_id" varchar(64) NOT NULL,
  "lesson_id" varchar(64),
  "lesson_name" varchar(200),
  "teacher_name" varchar(100),
  "scheduled_at" timestamptz NOT NULL,
  "duration_minutes" integer NOT NULL DEFAULT 60,
  "location" varchar(200),
  "status" varchar(20) NOT NULL DEFAULT 'scheduled',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "edu_classes_schedules_class_idx" ON "edu_classes_schedules" ("class_id");
CREATE INDEX IF NOT EXISTS "edu_classes_schedules_scheduled_idx" ON "edu_classes_schedules" ("scheduled_at");
CREATE INDEX IF NOT EXISTS "edu_classes_schedules_status_idx" ON "edu_classes_schedules" ("status");

-- 表 2: edu_classes_members
CREATE TABLE IF NOT EXISTS "edu_classes_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "class_id" varchar(64) NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL DEFAULT 'student',
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "edu_classes_members_class_idx" ON "edu_classes_members" ("class_id");
CREATE INDEX IF NOT EXISTS "edu_classes_members_user_idx" ON "edu_classes_members" ("user_id");
CREATE INDEX IF NOT EXISTS "edu_classes_members_status_idx" ON "edu_classes_members" ("status");
