-- 崩溃上报表(2026-08-06)
-- 打通崩溃率链路:各端全局错误捕获 → POST /api/crash-reports → 本表 → admin/mobile-stats 聚合真实崩溃率。
CREATE TABLE IF NOT EXISTS "crash_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "platform" varchar(24) NOT NULL,
  "version" varchar(64),
  "user_id" uuid,
  "error_message" text NOT NULL,
  "stack" text,
  "route" varchar(512),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "crash_reports_created_at_idx" ON "crash_reports" ("created_at");
CREATE INDEX IF NOT EXISTS "crash_reports_platform_idx" ON "crash_reports" ("platform");
