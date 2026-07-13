-- Migration 0056: AI 厂商配置表（R4 重构产物）
-- 创建时间: 2026-07-13
-- 关联重构洞察: 重构洞察-AI厂商配置管理混乱问题.md
--
-- 用途：将原 ai-vendors.ts 中硬编码的 VENDORS 配置迁移到数据库，
--       支持动态管理多模态 AI 厂商（启用/禁用、修改 baseUrl、authType 等）。
--       凭据（API Key/Secret）仍存放于环境变量，本表仅记录环境变量名（keyEnvName/secretKeyEnvName）。
--       数据库不可用时由 ai-vendor-config-service.ts 自动 fallback 到 FALLBACK_VENDORS。

CREATE TABLE IF NOT EXISTS "ai_vendor_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vendor_code" varchar(64) NOT NULL UNIQUE,
  "vendor_name" varchar(128) NOT NULL,
  "base_url" varchar(500) NOT NULL,
  "auth_type" varchar(32) NOT NULL,
  "key_env_name" varchar(100),
  "secret_key_env_name" varchar(100),
  "is_enabled" boolean NOT NULL DEFAULT true,
  "priority" integer NOT NULL DEFAULT 0,
  "rate_limit" integer DEFAULT 100,
  "config_json" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_ai_vendor_configs_enabled" ON "ai_vendor_configs" ("is_enabled");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_ai_vendor_configs_code" ON "ai_vendor_configs" ("vendor_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_ai_vendor_configs_priority" ON "ai_vendor_configs" ("priority");
