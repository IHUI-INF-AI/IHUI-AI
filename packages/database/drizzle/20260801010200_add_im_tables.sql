-- Migration: add_im_tables
-- Description: IM 多平台远程连接控制完整接入(P0)— 新建 2 张表
--   1. im_adapters:用户对 16 平台(飞书/企业微信/钉钉/Discord/Telegram/Slack/微信/
--      Webhook/WhatsApp/LINE/KakaoTalk/Signal/Matrix/Rocket.Chat/Mattermost/Zulip)
--      的适配器配置,替代原 im-gateway.ts 的 Redis 兜底方案
--   2. im_messages:入站 + 出站消息历史统一存储(替代原 Redis im:inbound/im:outbound 队列)
-- Author: P0 IM 多平台远程连接控制(2026-07-31)
-- Hazard: 全新表,无破坏性;原 Redis 兜底逻辑保留(降级方案)

-- 1. im_adapters 表(用户 × 平台 维度配置)
CREATE TABLE IF NOT EXISTS "im_adapters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "platform" varchar(32) NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "credentials_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "schema_version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- 每个 user 每个 platform 只能有一条配置(upsert 依据)
CREATE UNIQUE INDEX IF NOT EXISTS "im_adapters_user_platform_idx" ON "im_adapters"("user_id", "platform");
CREATE INDEX IF NOT EXISTS "im_adapters_user_idx" ON "im_adapters"("user_id");
CREATE INDEX IF NOT EXISTS "im_adapters_enabled_idx" ON "im_adapters"("enabled");

-- 2. im_messages 表(消息历史:入站 + 出站统一存储)
CREATE TABLE IF NOT EXISTS "im_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "platform" varchar(32) NOT NULL,
  "direction" varchar(16) NOT NULL,  -- 'inbound' | 'outbound'
  "chat_id" varchar(255),
  "platform_message_id" varchar(255),
  "content" text,
  "raw_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "delivery_status" varchar(16) DEFAULT 'sent',  -- outbound 专用:pending/sent/failed
  "error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "im_messages_user_idx" ON "im_messages"("user_id");
CREATE INDEX IF NOT EXISTS "im_messages_platform_idx" ON "im_messages"("platform");
CREATE INDEX IF NOT EXISTS "im_messages_user_platform_idx" ON "im_messages"("user_id", "platform");
CREATE INDEX IF NOT EXISTS "im_messages_direction_idx" ON "im_messages"("direction");
CREATE INDEX IF NOT EXISTS "im_messages_created_at_idx" ON "im_messages"("created_at");

-- 3. updated_at 自动更新触发器(同 webhooks 等其他表惯例)
CREATE OR REPLACE FUNCTION "im_adapters_update_timestamp"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "im_adapters_update_timestamp" ON "im_adapters";
CREATE TRIGGER "im_adapters_update_timestamp"
  BEFORE UPDATE ON "im_adapters"
  FOR EACH ROW
  EXECUTE FUNCTION "im_adapters_update_timestamp"();
