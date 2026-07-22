-- 修复 email_logs 幻影表 schema drift(2026-07-22 立)
-- 历史问题:TS schema(email-logs.ts)+ 5 个 snapshot(0121-0127)都有 email_logs 定义,
-- 但所有 migration sql 中无 CREATE TABLE 语句。
-- 代码引用:apps/api/src/services/email-service.ts:207 db.insert(emailLogs)
-- 影响:新数据库 apply 全部 migrations 后,email-service.ts 运行时报
--       "relation email_logs does not exist" 错误,所有邮件发送审计写日志失败。
-- 修复:补 CREATE TABLE,与 email-logs.ts schema 完全对齐,IF NOT EXISTS 守门可重复执行。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致,不登记到 _journal.json):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260722170000_email_logs_create.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260722170000_email_logs_create.sql
-- apply-migration.mjs 的 splitSqlStatements 正确处理 DO $$ ... $$ 块,可安全使用。

CREATE TABLE IF NOT EXISTS "email_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "to_email" varchar(255) NOT NULL,
  "subject" varchar(500) NOT NULL,
  "provider" varchar(16) NOT NULL,
  "status" varchar(16) NOT NULL,
  "error" text,
  "scene" varchar(32),
  "user_id" uuid,
  "template_slug" varchar(64),
  "message_id" varchar(200),
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 外键:email_logs.user_id -> users.id (ON DELETE SET NULL)
DO $$ BEGIN
  ALTER TABLE "email_logs"
    ADD CONSTRAINT "email_logs_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 索引:与 schema 中 4 个 index 对齐
CREATE INDEX IF NOT EXISTS "email_logs_to_email_idx" ON "email_logs" ("to_email");
CREATE INDEX IF NOT EXISTS "email_logs_status_idx" ON "email_logs" ("status");
CREATE INDEX IF NOT EXISTS "email_logs_user_id_idx" ON "email_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "email_logs_created_at_idx" ON "email_logs" ("created_at");
