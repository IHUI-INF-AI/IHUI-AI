-- Wave 23: OSS 存储驱动模块 (edu_platform 对象存储配置)
CREATE TABLE IF NOT EXISTS "oss_drivers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(128) NOT NULL UNIQUE,
  "driver" varchar(32) NOT NULL,
  "credentials" jsonb,
  "config" jsonb,
  "is_enabled" boolean DEFAULT false NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "description" text,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "oss_drivers_driver_idx" ON "oss_drivers"("driver");
CREATE INDEX IF NOT EXISTS "oss_drivers_enabled_idx" ON "oss_drivers"("is_enabled");
