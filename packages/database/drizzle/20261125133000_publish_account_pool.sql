-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 发布账号池 + 会话守护(2026-11-25)
-- 与 ai-service account_pool.py / session_keeper.py 的 CREATE TABLE IF NOT EXISTS 严格对齐。

CREATE TABLE IF NOT EXISTS "publish_pools" (
  "pool_id" varchar(40) PRIMARY KEY NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "platform" varchar(32) NOT NULL,
  "name" varchar(128) DEFAULT '默认账号池' NOT NULL,
  "strategy" varchar(16) DEFAULT 'least_recent' NOT NULL,
  "min_healthy" integer DEFAULT 1 NOT NULL,
  "max_daily_posts" integer DEFAULT 0 NOT NULL,
  "probe_interval_minutes" integer DEFAULT 45 NOT NULL,
  "auto_reauth" boolean DEFAULT true NOT NULL,
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_publish_pools_user_platform"
  ON "publish_pools" ("user_id", "platform");

CREATE TABLE IF NOT EXISTS "publish_pool_members" (
  "pool_id" varchar(40) NOT NULL REFERENCES "publish_pools" ("pool_id") ON DELETE CASCADE,
  "account_id" bigint NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "weight" integer DEFAULT 1 NOT NULL,
  "daily_quota" integer DEFAULT 0 NOT NULL,
  "last_used_at" timestamp with time zone,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "publish_pool_members_pool_id_account_id_pk" PRIMARY KEY ("pool_id", "account_id")
);

CREATE INDEX IF NOT EXISTS "idx_publish_pool_members_account"
  ON "publish_pool_members" ("account_id");

CREATE TABLE IF NOT EXISTS "publish_session_state" (
  "account_id" bigint PRIMARY KEY NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "platform" varchar(32) NOT NULL,
  "status" varchar(24) DEFAULT 'unknown' NOT NULL,
  "last_probe_at" timestamp with time zone,
  "last_ok_at" timestamp with time zone,
  "next_probe_at" timestamp with time zone,
  "consecutive_failures" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "last_error_kind" varchar(24),
  "expires_at" timestamp with time zone,
  "reauth_task_id" varchar(64),
  "reauth_started_at" timestamp with time zone,
  "probe_interval_minutes" integer DEFAULT 60 NOT NULL,
  "last_duration_ms" integer,
  "last_alert_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_publish_session_next"
  ON "publish_session_state" ("next_probe_at");

CREATE TABLE IF NOT EXISTS "publish_session_events" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "account_id" bigint NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "platform" varchar(32) NOT NULL,
  "ok" boolean NOT NULL,
  "kind" varchar(24) NOT NULL,
  "message" text,
  "detail" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_publish_session_events_account"
  ON "publish_session_events" ("account_id", "created_at" DESC);
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
