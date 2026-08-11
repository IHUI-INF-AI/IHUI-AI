CREATE TABLE IF NOT EXISTS "edu_exam_score" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "edu_class"("id") ON DELETE CASCADE,
  "subject" varchar(100) NOT NULL,
  "exam_name" varchar(200) NOT NULL,
  "score" integer NOT NULL,
  "total_score" integer DEFAULT 100 NOT NULL,
  "exam_date" date NOT NULL,
  "remark" text,
  "recorded_by" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_edu_score_student" ON "edu_exam_score" ("student_id");
CREATE INDEX IF NOT EXISTS "ix_edu_score_class" ON "edu_exam_score" ("class_id");
CREATE INDEX IF NOT EXISTS "ix_edu_score_subject" ON "edu_exam_score" ("subject");
CREATE INDEX IF NOT EXISTS "ix_edu_score_date" ON "edu_exam_score" ("exam_date");

CREATE TABLE IF NOT EXISTS "edu_ranking_snapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "class_id" uuid NOT NULL REFERENCES "edu_class"("id") ON DELETE CASCADE,
  "exam_name" varchar(200) NOT NULL,
  "subject" varchar(100),
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "score" integer NOT NULL,
  "rank" integer NOT NULL,
  "total_students" integer NOT NULL,
  "snapshot_date" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_edu_rank_class_exam" ON "edu_ranking_snapshot" ("class_id", "exam_name");
CREATE INDEX IF NOT EXISTS "ix_edu_rank_student" ON "edu_ranking_snapshot" ("student_id");
CREATE INDEX IF NOT EXISTS "ix_edu_rank_date" ON "edu_ranking_snapshot" ("snapshot_date");