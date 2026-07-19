-- 0041: 补齐 agents 表丢失的 14 个 Coze 配置字段 (H-3)
-- 注意: agents 表在 0043_neat_the_spike 才创建,且 CREATE TABLE 已包含下列全部字段。
-- 在 fresh install 场景下 agents 表尚不存在,这里使用 DO 块幂等跳过;
-- 在升级场景(老库已有 agents 表但缺字段)下补齐缺失字段。

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agents') THEN
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
  END IF;
END $$;
