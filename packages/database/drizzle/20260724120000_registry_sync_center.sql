-- 资源上游自动同步中心 (registry sync center) — 2026-07-24 新增
-- 3 张表:registry_items / registry_sync_logs / registry_webhook_triggers
-- 统一 MCP / Skill / Plugin 三类资源从多上游源(github/npm/mcp_marketplace/custom)拉取、缓存、评分

-- 1. 资源条目表
CREATE TABLE IF NOT EXISTS "registry_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_type" varchar(20) NOT NULL,
  "source" varchar(20) NOT NULL,
  "source_id" varchar(255) NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" text,
  "version" varchar(100),
  "author" varchar(200),
  "homepage" varchar(500),
  "repo_url" varchar(500),
  "download_url" varchar(500),
  "categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "install_count" integer DEFAULT 0 NOT NULL,
  "heat_score" integer DEFAULT 0 NOT NULL,
  "quality_score" integer DEFAULT 0 NOT NULL,
  "latest_synced_at" timestamp with time zone,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "registry_items_source_type_idx" ON "registry_items" ("source_type");
CREATE INDEX IF NOT EXISTS "registry_items_source_idx" ON "registry_items" ("source");
CREATE UNIQUE INDEX IF NOT EXISTS "registry_items_source_type_source_id_uniq" ON "registry_items" ("source_type","source","source_id");
CREATE INDEX IF NOT EXISTS "registry_items_heat_score_idx" ON "registry_items" ("heat_score");
CREATE INDEX IF NOT EXISTS "registry_items_quality_score_idx" ON "registry_items" ("quality_score");
CREATE INDEX IF NOT EXISTS "registry_items_latest_synced_at_idx" ON "registry_items" ("latest_synced_at");

-- 2. 同步日志表
CREATE TABLE IF NOT EXISTS "registry_sync_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_type" varchar(20) NOT NULL,
  "source_name" varchar(255) NOT NULL,
  "status" varchar(20) DEFAULT 'running' NOT NULL,
  "error_message" text,
  "payload_hash" varchar(64),
  "old_version" varchar(100),
  "new_version" varchar(100),
  "duration_ms" integer DEFAULT 0 NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "registry_sync_logs_source_type_idx" ON "registry_sync_logs" ("source_type");
CREATE INDEX IF NOT EXISTS "registry_sync_logs_status_idx" ON "registry_sync_logs" ("status");
CREATE INDEX IF NOT EXISTS "registry_sync_logs_started_at_idx" ON "registry_sync_logs" ("started_at");

-- 3. Webhook 触发记录表(持久化 webhooks-trigger.ts 内存 Map)
CREATE TABLE IF NOT EXISTS "registry_webhook_triggers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "event_type" varchar(100) NOT NULL,
  "source" varchar(20) NOT NULL,
  "signature" varchar(255),
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "result_message" text
);
CREATE INDEX IF NOT EXISTS "registry_webhook_triggers_source_idx" ON "registry_webhook_triggers" ("source");
CREATE INDEX IF NOT EXISTS "registry_webhook_triggers_status_idx" ON "registry_webhook_triggers" ("status");
CREATE INDEX IF NOT EXISTS "registry_webhook_triggers_received_at_idx" ON "registry_webhook_triggers" ("received_at");
