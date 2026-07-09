-- Wave 24: edu_platform 教育平台设置模块 (edu_settings 表,与 system_configs 区分)
CREATE TABLE IF NOT EXISTS "edu_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group" varchar(64) DEFAULT 'general' NOT NULL,
  "key" varchar(128) NOT NULL,
  "value" text,
  "type" varchar(16) DEFAULT 'string' NOT NULL,
  "credentials" jsonb,
  "description" text,
  "is_public" boolean DEFAULT false NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_settings_group_idx" ON "edu_settings"("group");
CREATE INDEX IF NOT EXISTS "edu_settings_group_key_idx" ON "edu_settings"("group", "key");
CREATE INDEX IF NOT EXISTS "edu_settings_public_idx" ON "edu_settings"("is_public");
