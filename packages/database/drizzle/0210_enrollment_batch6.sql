-- 批次6：招生管理 - 线索表 + 试听预约表 + 报名记录表
CREATE TABLE IF NOT EXISTS "edu_lead" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(100) NOT NULL,
  "phone" varchar(20),
  "student_name" varchar(100),
  "student_age" integer,
  "source" varchar(30) NOT NULL,
  "status" varchar(20) DEFAULT 'new' NOT NULL,
  "follower_id" uuid REFERENCES "users"("id"),
  "next_follow_date" date,
  "remark" text,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_edu_lead_status" ON "edu_lead" ("status");
CREATE INDEX IF NOT EXISTS "ix_edu_lead_follower" ON "edu_lead" ("follower_id");
CREATE INDEX IF NOT EXISTS "ix_edu_lead_phone" ON "edu_lead" ("phone");

CREATE TABLE IF NOT EXISTS "edu_trial_booking" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lead_id" uuid NOT NULL REFERENCES "edu_lead"("id") ON DELETE CASCADE,
  "student_name" varchar(100) NOT NULL,
  "student_age" integer,
  "parent_name" varchar(100),
  "parent_phone" varchar(20),
  "trial_date" date NOT NULL,
  "trial_time" varchar(50),
  "subject" varchar(100),
  "teacher_id" uuid REFERENCES "users"("id"),
  "classroom" varchar(100),
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "remark" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_edu_trial_lead" ON "edu_trial_booking" ("lead_id");
CREATE INDEX IF NOT EXISTS "ix_edu_trial_date" ON "edu_trial_booking" ("trial_date");
CREATE INDEX IF NOT EXISTS "ix_edu_trial_status" ON "edu_trial_booking" ("status");

CREATE TABLE IF NOT EXISTS "edu_enrollment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "edu_class"("id") ON DELETE CASCADE,
  "term_id" uuid NOT NULL REFERENCES "edu_term"("id") ON DELETE CASCADE,
  "enroll_date" date NOT NULL,
  "total_fee" integer NOT NULL,
  "paid_amount" integer DEFAULT 0 NOT NULL,
  "status" varchar(20) DEFAULT 'enrolled' NOT NULL,
  "remark" text,
  "operator_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_edu_enroll_student" ON "edu_enrollment" ("student_id");
CREATE INDEX IF NOT EXISTS "ix_edu_enroll_class" ON "edu_enrollment" ("class_id");
CREATE INDEX IF NOT EXISTS "ix_edu_enroll_term" ON "edu_enrollment" ("term_id");
CREATE INDEX IF NOT EXISTS "ix_edu_enroll_status" ON "edu_enrollment" ("status");