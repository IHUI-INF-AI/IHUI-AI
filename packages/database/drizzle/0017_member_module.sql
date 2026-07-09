-- Wave 17: Member module (members + levels)
CREATE TABLE IF NOT EXISTS "edu_member_levels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "growth_value" integer DEFAULT 0 NOT NULL,
  "discount" numeric(5,2) DEFAULT '1.00' NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_member_levels_sort_idx" ON "edu_member_levels"("sort");

CREATE TABLE IF NOT EXISTS "edu_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "username" varchar(100),
  "mobile" varchar(30),
  "email" varchar(200),
  "password" varchar(128) DEFAULT '' NOT NULL,
  "avatar" varchar(500),
  "nickname" varchar(100),
  "gender" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 0 NOT NULL,
  "level_id" uuid REFERENCES "edu_member_levels"("id") ON DELETE SET NULL,
  "company_id" uuid,
  "department_id" uuid,
  "growth_value" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_members_username_idx" ON "edu_members"("username");
CREATE INDEX IF NOT EXISTS "edu_members_mobile_idx" ON "edu_members"("mobile");
CREATE INDEX IF NOT EXISTS "edu_members_level_idx" ON "edu_members"("level_id");
