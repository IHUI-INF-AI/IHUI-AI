-- Member companies & departments tables (会员企业/部门)
CREATE TABLE IF NOT EXISTS "edu_companies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "contact_name" varchar(100),
  "contact_phone" varchar(30),
  "address" varchar(500),
  "remark" varchar(500),
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_companies_sort_idx" ON "edu_companies"("sort");

CREATE TABLE IF NOT EXISTS "edu_departments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "edu_companies"("id") ON DELETE CASCADE,
  "name" varchar(200) NOT NULL,
  "pid" uuid,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_departments_company_idx" ON "edu_departments"("company_id");
CREATE INDEX IF NOT EXISTS "edu_departments_pid_idx" ON "edu_departments"("pid");

-- Add FKs: edu_members.company_id -> edu_companies.id, edu_members.department_id -> edu_departments.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'edu_members_company_id_edu_companies_id_fk'
  ) THEN
    ALTER TABLE "edu_members"
      ADD CONSTRAINT "edu_members_company_id_edu_companies_id_fk"
      FOREIGN KEY ("company_id") REFERENCES "edu_companies"("id")
      ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'edu_members_department_id_edu_departments_id_fk'
  ) THEN
    ALTER TABLE "edu_members"
      ADD CONSTRAINT "edu_members_department_id_edu_departments_id_fk"
      FOREIGN KEY ("department_id") REFERENCES "edu_departments"("id")
      ON DELETE SET NULL;
  END IF;
END $$;
