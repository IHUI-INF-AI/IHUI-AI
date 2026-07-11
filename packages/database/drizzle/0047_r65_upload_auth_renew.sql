-- 0047_r65_upload_auth_renew.sql
-- R65 补建：M-52 分片上传表 + M-67 实名认证字段 + M-56 连续订阅字段

-- 1. 分片上传会话表（M-52）
CREATE TABLE IF NOT EXISTS "upload_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "upload_id" varchar(128) NOT NULL UNIQUE,
  "file_name" varchar(255) NOT NULL,
  "file_size" bigint DEFAULT 0 NOT NULL,
  "file_md5" varchar(64),
  "total_chunks" integer NOT NULL,
  "uploaded_chunks" integer DEFAULT 0 NOT NULL,
  "chunk_size" integer DEFAULT 5242880 NOT NULL,
  "mime_type" varchar(128),
  "status" varchar(32) DEFAULT 'uploading' NOT NULL,
  "file_path" varchar(512),
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "upload_sessions_upload_id_idx" ON "upload_sessions" ("upload_id");
CREATE INDEX IF NOT EXISTS "upload_sessions_user_idx" ON "upload_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "upload_sessions_status_idx" ON "upload_sessions" ("status");

-- 2. 实名认证字段（M-67）—— 扩展 user_auth_info 表
ALTER TABLE "user_auth_info" ADD COLUMN IF NOT EXISTS "real_name" varchar(50);
ALTER TABLE "user_auth_info" ADD COLUMN IF NOT EXISTS "id_card" varchar(20);
ALTER TABLE "user_auth_info" ADD COLUMN IF NOT EXISTS "auth_status" varchar(32) DEFAULT 'unverified' NOT NULL;
ALTER TABLE "user_auth_info" ADD COLUMN IF NOT EXISTS "auth_source" varchar(50);
ALTER TABLE "user_auth_info" ADD COLUMN IF NOT EXISTS "auth_at" timestamptz;
ALTER TABLE "user_auth_info" ADD COLUMN IF NOT EXISTS "reject_reason" varchar(255);

-- 3. 连续订阅字段（M-56）—— 扩展 user_vips 表
ALTER TABLE "user_vips" ADD COLUMN IF NOT EXISTS "auto_renew" integer DEFAULT 0 NOT NULL;
