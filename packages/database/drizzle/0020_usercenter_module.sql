-- Wave 20: UserCenter 模块 (部门 + 用户扩展 + 证书)
CREATE TABLE IF NOT EXISTS "departments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "pid" uuid,
  "company_id" integer,
  "sort" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "departments_pid_idx" ON "departments"("pid");

CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "department_id" uuid REFERENCES "departments"("id") ON DELETE SET NULL,
  "company_id" integer,
  "employee_no" varchar(64),
  "position" varchar(100),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "user_profiles_dept_idx" ON "user_profiles"("department_id");

CREATE TABLE IF NOT EXISTS "user_certificates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(200) NOT NULL,
  "certificate_no" varchar(100),
  "issued_at" timestamptz,
  "expire_at" timestamptz,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "user_certificates_user_idx" ON "user_certificates"("user_id");
