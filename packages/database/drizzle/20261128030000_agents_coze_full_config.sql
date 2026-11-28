-- 2026-11-28 Coze BotInfo 全量参数接入
-- 官方接口：GET https://api.coze.cn/v1/bots/:bot_id?is_published=true
-- 目标：把 BotInfo 的 24 个顶层字段及其嵌套字段全部落库，并保留原始 payload 与历史快照。

-- 1) agent_temperature：旧导入把 0.8 存成 80（integer 百分数），先无损转成小数。
ALTER TABLE "agents"
  ALTER COLUMN "agent_temperature" TYPE numeric(4, 3)
  USING (
    CASE
      WHEN "agent_temperature" IS NULL THEN NULL
      WHEN "agent_temperature" > 2 THEN "agent_temperature"::numeric / 100
      ELSE "agent_temperature"::numeric
    END
  );

-- 2) agents：BotInfo 全量字段
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "agent_prompt_mode" varchar(32);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "agent_prefix_prompt" jsonb;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_model_id" varchar(64);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_model_name" varchar(200);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_variables_raw" jsonb;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_top_k" integer;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_top_p" numeric(4, 3);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_context_round" integer;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_response_format" varchar(32);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_presence_penalty" numeric(4, 3);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_frequency_penalty" numeric(4, 3);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_model_parameters" jsonb;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_bot_mode" integer;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_default_user_input_type" varchar(20);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_onboarding" jsonb;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_prologue" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_plugins" jsonb;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_workflows" jsonb;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_knowledge" jsonb;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_shortcut_commands" jsonb;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_voices" jsonb;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_media_config" jsonb;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_background_image" jsonb;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_suggest_reply" jsonb;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_folder_id" varchar(64);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_owner_user_id" varchar(64);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_icon_url" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_description" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_create_time" bigint;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_update_time" bigint;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_config_raw" jsonb;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_config_source" varchar(32);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_config_status" varchar(20) NOT NULL DEFAULT 'never';
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_config_error" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_config_synced_at" timestamptz;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_config_version" varchar(64);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_config_hash" varchar(64);

CREATE INDEX IF NOT EXISTS "agents_coze_sync_idx"
  ON "agents" ("coze_config_status", "coze_config_synced_at");

-- 3) coze_variables：补齐 Coze Variable 的 enable / prompt_enable / channel 与原始对象
ALTER TABLE "coze_variables" ADD COLUMN IF NOT EXISTS "enabled" boolean DEFAULT true;
ALTER TABLE "coze_variables" ADD COLUMN IF NOT EXISTS "prompt_enable" boolean DEFAULT true;
ALTER TABLE "coze_variables" ADD COLUMN IF NOT EXISTS "channel" varchar(20) DEFAULT 'custom';
ALTER TABLE "coze_variables" ADD COLUMN IF NOT EXISTS "raw" jsonb;
ALTER TABLE "coze_variables" ADD COLUMN IF NOT EXISTS "synced_at" timestamptz;

-- 4) 每次版本变化的完整快照（agents.coze_config_raw 只留最新一版）
CREATE TABLE IF NOT EXISTS "coze_bot_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL,
  "bot_id" varchar(64) NOT NULL,
  "source" varchar(32) NOT NULL,
  "is_published" boolean,
  "version" varchar(64),
  "payload" jsonb NOT NULL,
  "payload_hash" varchar(64) NOT NULL,
  "fetched_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "coze_bot_snapshots_agent_hash_uniq"
  ON "coze_bot_snapshots" ("agent_id", "payload_hash");
CREATE INDEX IF NOT EXISTS "coze_bot_snapshots_agent_fetched_idx"
  ON "coze_bot_snapshots" ("agent_id", "fetched_at");
