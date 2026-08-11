-- 批次4：智能排课 - 教师时间表 + 排课规则表 + 调课申请表
CREATE TABLE IF NOT EXISTS "edu_teacher_schedule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teacher_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "term_id" uuid NOT NULL REFERENCES "edu_term"("id") ON DELETE CASCADE,
  "day_of_week" integer NOT NULL,
  "start_time" varchar(10) NOT NULL,
  "end_time" varchar(10) NOT NULL,
  "time_slot" varchar(20),
  "is_available" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_edu_teacher_sched_teacher" ON "edu_teacher_schedule" ("teacher_id");
CREATE INDEX IF NOT EXISTS "ix_edu_teacher_sched_term" ON "edu_teacher_schedule" ("term_id");
CREATE INDEX IF NOT EXISTS "ix_edu_teacher_sched_day" ON "edu_teacher_schedule" ("day_of_week");

CREATE TABLE IF NOT EXISTS "edu_scheduling_rule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "term_id" uuid NOT NULL REFERENCES "edu_term"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "edu_class"("id") ON DELETE CASCADE,
  "subject" varchar(100) NOT NULL,
  "teacher_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "weekday" integer NOT NULL,
  "start_time" varchar(10) NOT NULL,
  "end_time" varchar(10) NOT NULL,
  "classroom" varchar(100),
  "weeks_per_term" integer DEFAULT 16,
  "priority" integer DEFAULT 0,
  "is_active" boolean DEFAULT true NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_edu_sched_rule_term" ON "edu_scheduling_rule" ("term_id");
CREATE INDEX IF NOT EXISTS "ix_edu_sched_rule_class" ON "edu_scheduling_rule" ("class_id");
CREATE INDEX IF NOT EXISTS "ix_edu_sched_rule_teacher" ON "edu_scheduling_rule" ("teacher_id");
CREATE INDEX IF NOT EXISTS "ix_edu_sched_rule_weekday" ON "edu_scheduling_rule" ("weekday");

CREATE TABLE IF NOT EXISTS "edu_schedule_change" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "schedule_id" uuid NOT NULL REFERENCES "edu_course_schedule"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "edu_class"("id") ON DELETE CASCADE,
  "subject" varchar(100) NOT NULL,
  "original_teacher" varchar(100),
  "new_teacher" varchar(100),
  "original_weekday" integer,
  "original_start_time" varchar(10),
  "original_end_time" varchar(10),
  "new_weekday" integer,
  "new_start_time" varchar(10),
  "new_end_time" varchar(10),
  "reason" text NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "applicant_id" uuid NOT NULL REFERENCES "users"("id"),
  "approver_id" uuid REFERENCES "users"("id"),
  "approve_remark" text,
  "approve_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_edu_sched_change_schedule" ON "edu_schedule_change" ("schedule_id");
CREATE INDEX IF NOT EXISTS "ix_edu_sched_change_class" ON "edu_schedule_change" ("class_id");
CREATE INDEX IF NOT EXISTS "ix_edu_sched_change_status" ON "edu_schedule_change" ("status");
CREATE INDEX IF NOT EXISTS "ix_edu_sched_change_applicant" ON "edu_schedule_change" ("applicant_id");