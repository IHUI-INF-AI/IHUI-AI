-- 补齐 4 张表的 CREATE TABLE migration(预存在 schema drift 守门阻断项)
-- 涉及表: agent_billings / search_contents / zhs_agent_examine / zhs_agent_settlement
-- 来源: 之前会话已新增 TS schema 定义但未生成对应 migration SQL
-- 安全: 全部使用 IF NOT EXISTS,已有该表的实例不受影响

-- =============================================================================
-- 1. agent_billings (智能体计费表) - 来源 agent-billings.ts
-- =============================================================================
CREATE TABLE IF NOT EXISTS "agent_billings" (
	"billing_id" varchar(64) PRIMARY KEY,
	"event_id" varchar(128) NOT NULL,
	"record_id" varchar(64) NOT NULL,
	"consume_time" bigint NOT NULL,
	"consume_datetime" timestamptz,
	"created_at_coze" varchar(20),
	"record_root_id" varchar(64),
	"connector_id" varchar(64),
	"connector_uid" varchar(64),
	"device_id" varchar(64),
	"custom_consumer" varchar(255),
	"space_id" varchar(64),
	"root_entity_id" varchar(64),
	"root_entity_type" integer,
	"change_balance" numeric(10, 6) NOT NULL,
	"balance_type" integer,
	"cost_account_id" varchar(64),
	"resource_type" integer,
	"resource_id" varchar(64),
	"model_id" varchar(64),
	"model_input_token" integer DEFAULT 0 NOT NULL,
	"model_output_token" integer DEFAULT 0 NOT NULL,
	"rtc_begin_time" integer DEFAULT 0 NOT NULL,
	"rtc_end_time" integer DEFAULT 0 NOT NULL,
	"rtc_duration" integer DEFAULT 0 NOT NULL,
	"tts_char_num" integer DEFAULT 0 NOT NULL,
	"tts_count" integer DEFAULT 0 NOT NULL,
	"asr_audio_length" integer DEFAULT 0 NOT NULL,
	"billing_status" varchar(20) DEFAULT 'recorded' NOT NULL,
	"raw_callback_data" jsonb,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_billings_event_uniq" ON "agent_billings" ("event_id");
CREATE INDEX IF NOT EXISTS "agent_billings_record_idx" ON "agent_billings" ("record_id");
CREATE INDEX IF NOT EXISTS "agent_billings_consume_time_idx" ON "agent_billings" ("consume_time");
CREATE INDEX IF NOT EXISTS "agent_billings_model_idx" ON "agent_billings" ("model_id");
CREATE INDEX IF NOT EXISTS "agent_billings_status_idx" ON "agent_billings" ("billing_status");

-- =============================================================================
-- 2. search_contents (跨服务内容索引表) - 来源 search-contents.ts
-- =============================================================================
DO $$ BEGIN
	CREATE TYPE "search_content_topic_type" AS ENUM('article', 'news', 'question', 'resource', 'lesson');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "search_contents" (
	"id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	"topic_id" uuid NOT NULL,
	"topic_type" "search_content_topic_type" NOT NULL,
	"topic_title" varchar(300) NOT NULL,
	"topic_summary" text,
	"search_text" text NOT NULL,
	"author_id" uuid,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "search_contents_topic_idx" ON "search_contents" ("topic_type", "topic_id");
CREATE INDEX IF NOT EXISTS "search_contents_type_idx" ON "search_contents" ("topic_type");
CREATE INDEX IF NOT EXISTS "search_contents_author_idx" ON "search_contents" ("author_id");
CREATE INDEX IF NOT EXISTS "search_contents_created_idx" ON "search_contents" ("created_at");

-- =============================================================================
-- 3. zhs_agent_examine (智能体审核记录表) - 来源 zhs-full.ts
-- =============================================================================
CREATE TABLE IF NOT EXISTS "zhs_agent_examine" (
	"id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	"agent_id" varchar(64),
	"agent_name" varchar(128),
	"agent_avatar" varchar(500),
	"prologue" text,
	"category_id" uuid,
	"status" smallint,
	"start_time" timestamptz,
	"start_user" uuid,
	"start_phone" varchar(15),
	"start_name" varchar(128),
	"examine_user" varchar(128),
	"examine_user_id" uuid,
	"examine_time" timestamptz,
	"desc" text,
	"follow" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_zhs_agent_examine_agent_id" ON "zhs_agent_examine" ("agent_id");
CREATE INDEX IF NOT EXISTS "idx_zhs_agent_examine_status" ON "zhs_agent_examine" ("status");
CREATE INDEX IF NOT EXISTS "idx_zhs_agent_examine_examine_user_id" ON "zhs_agent_examine" ("examine_user_id");

-- =============================================================================
-- 4. zhs_agent_settlement (智能体结算表) - 来源 zhs-full.ts
-- =============================================================================
CREATE TABLE IF NOT EXISTS "zhs_agent_settlement" (
	"id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	"uuid" uuid,
	"order_no" varchar(36),
	"create_time" timestamptz DEFAULT now(),
	"buy_uuid" uuid,
	"agent_id" varchar(64),
	"agent_name" varchar(128),
	"prologue" text,
	"agent_avatar" varchar(500),
	"expiration_date" timestamptz,
	"settlement" varchar(2),
	"withdrawal" varchar(2),
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_settlement_order_no" ON "zhs_agent_settlement" ("order_no");
CREATE INDEX IF NOT EXISTS "idx_settlement_status" ON "zhs_agent_settlement" ("settlement");
CREATE INDEX IF NOT EXISTS "idx_settlement_withdrawal" ON "zhs_agent_settlement" ("withdrawal");
