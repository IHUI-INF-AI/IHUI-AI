CREATE TABLE IF NOT EXISTS "edu_parent_student_binding" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "parent_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "relationship" varchar(30) NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "confirmed_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_edu_parent_binding_parent" ON "edu_parent_student_binding" ("parent_id");
CREATE INDEX IF NOT EXISTS "ix_edu_parent_binding_student" ON "edu_parent_student_binding" ("student_id");
CREATE INDEX IF NOT EXISTS "ix_edu_parent_binding_status" ON "edu_parent_student_binding" ("status");