-- 0041: 补齐 agents 表丢失的 14 个 Coze 配置字段 (H-3)

ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "agent_version" varchar(32);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "bot_id" varchar(64);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "bot_id_str" varchar(64);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "bot_name" varchar(200);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "agent_prompt" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "agent_model" varchar(100);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "agent_temperature" integer;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "agent_max_tokens" integer;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "agent_variables" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "publish_channel" varchar(50);
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "usage_count" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "like_count" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "share_count" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "coze_account_id" varchar(64);
