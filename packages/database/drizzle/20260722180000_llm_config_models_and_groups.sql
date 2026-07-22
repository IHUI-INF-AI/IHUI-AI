-- Phase 1: LLM 配置中心重构(方案 B)数据库 migration
-- 日期:2026-07-22
-- 设计原则:保持向后兼容(不 DROP 现有列,只 ADD),所有数据迁移在事务内原子完成。
--
-- 改造内容:
--   1. ai_model_config 表加 8 个新字段(provider_group/group_label/default_model_id/
--      sort_order_in_group/health_status/last_health_check_at/usage_30d_tokens/usage_30d_cost_cents)
--   2. 新增 ai_model_config_models(1:N,FK CASCADE)子表,每个 provider 配置可对应多个 model
--   3. 新增 ai_model_config_groups 用户自定义分组表
--   4. 数据迁移:把现有 ai_model_config.model_id_for_test 同步到子表,并回填 default_model_id
--
-- 安全策略:全部使用 IF NOT EXISTS / DO $$ EXCEPTION 守门,可安全重复执行
-- 旧列 100% 保留,旧代码读取仍可用(向后兼容)
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致,不登记到 _journal.json):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260722180000_llm_config_models_and_groups.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260722180000_llm_config_models_and_groups.sql

-- =============================================================================
-- 1. ai_model_config 表扩展:8 个新字段(全部可空,除 2 个 usage 字段有默认值)
-- =============================================================================
ALTER TABLE "ai_model_config"
  ADD COLUMN IF NOT EXISTS "provider_group" varchar(64),
  ADD COLUMN IF NOT EXISTS "group_label" varchar(64),
  ADD COLUMN IF NOT EXISTS "default_model_id" varchar(128),
  ADD COLUMN IF NOT EXISTS "sort_order_in_group" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "health_status" varchar(16) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "last_health_check_at" varchar(32),
  ADD COLUMN IF NOT EXISTS "usage_30d_tokens" bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "usage_30d_cost_cents" integer DEFAULT 0;

-- 索引:按 provider_group 聚合查询、按 health_status 过滤
CREATE INDEX IF NOT EXISTS "ix_ai_model_config_provider_group"
  ON "ai_model_config" ("provider_group");
CREATE INDEX IF NOT EXISTS "ix_ai_model_config_health"
  ON "ai_model_config" ("health_status");

-- =============================================================================
-- 2. 新表 ai_model_config_models(1:N,FK CASCADE)
-- 每个 ai_model_config 可挂载多个 model,默认 model 标记 is_default = true
-- =============================================================================
CREATE TABLE IF NOT EXISTS "ai_model_config_models" (
  "id" bigserial PRIMARY KEY,
  "config_id" bigint NOT NULL,
  "model_id" varchar(128) NOT NULL,
  "display_name" varchar(256),
  "context_length" integer DEFAULT 32000,
  "input_price_per_1k" integer DEFAULT 0,
  "output_price_per_1k" integer DEFAULT 0,
  "enabled" boolean DEFAULT true,
  "default_params" jsonb DEFAULT '{}'::jsonb,
  "is_default" boolean DEFAULT false,
  "sort_order" integer DEFAULT 0,
  "last_test_status" varchar(16),
  "last_test_response_ms" integer,
  "last_tested_at" varchar(32),
  "last_test_error" text,
  "extra_metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 外键:config_id -> ai_model_config.id (ON DELETE CASCADE)
DO $$ BEGIN
  ALTER TABLE "ai_model_config_models"
    ADD CONSTRAINT "ai_model_config_models_config_id_ai_model_config_id_fk"
    FOREIGN KEY ("config_id") REFERENCES "ai_model_config"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 唯一约束:同一 config 下 model_id 不可重复
DO $$ BEGIN
  ALTER TABLE "ai_model_config_models"
    ADD CONSTRAINT "ai_model_config_models_config_id_model_id_unique"
    UNIQUE ("config_id", "model_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 索引
CREATE INDEX IF NOT EXISTS "ai_model_config_models_config_id_idx"
  ON "ai_model_config_models" ("config_id");
CREATE INDEX IF NOT EXISTS "ai_model_config_models_enabled_idx"
  ON "ai_model_config_models" ("enabled");

-- partial unique index:每个 config 只允许一个 is_default = true 的 model
CREATE UNIQUE INDEX IF NOT EXISTS "ai_model_config_models_one_default_per_config"
  ON "ai_model_config_models" ("config_id")
  WHERE "is_default" = true;

-- =============================================================================
-- 3. 新表 ai_model_config_groups(用户自定义分组)
-- group_code 唯一,user_uuid 维度
-- =============================================================================
CREATE TABLE IF NOT EXISTS "ai_model_config_groups" (
  "id" bigserial PRIMARY KEY,
  "user_uuid" varchar(64) NOT NULL,
  "group_code" varchar(64) NOT NULL,
  "group_label" varchar(64),
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 唯一约束:同一 user 下 group_code 不可重复
DO $$ BEGIN
  ALTER TABLE "ai_model_config_groups"
    ADD CONSTRAINT "ai_model_config_groups_user_uuid_group_code_unique"
    UNIQUE ("user_uuid", "group_code");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 索引
CREATE INDEX IF NOT EXISTS "ai_model_config_groups_user_uuid_idx"
  ON "ai_model_config_groups" ("user_uuid");

-- =============================================================================
-- 4. 数据迁移(事务原子):把现有 model_id_for_test 同步到子表
-- 旧字段保留,旧代码仍可读;新代码读子表
-- =============================================================================
BEGIN;

-- 4.1 把现有 ai_model_config 中 model_id_for_test 非空的行,逐行迁移到 ai_model_config_models
--     ON CONFLICT DO NOTHING 守门:若子表已有该 (config_id, model_id),跳过
INSERT INTO "ai_model_config_models" (
  "config_id", "model_id", "context_length", "enabled", "is_default",
  "last_test_status", "last_test_response_ms", "last_tested_at", "last_test_error",
  "default_params", "sort_order"
)
SELECT
  "id",
  "model_id_for_test",
  32000,
  "enabled",
  true,
  "last_test_status",
  "last_test_response_ms",
  "last_tested_at",
  "last_test_error",
  '{}'::jsonb,
  0
FROM "ai_model_config"
WHERE "model_id_for_test" IS NOT NULL
ON CONFLICT ("config_id", "model_id") DO NOTHING;

-- 4.2 同步 default_model_id 字段(给旧字段快速指示当前默认 model)
UPDATE "ai_model_config"
SET "default_model_id" = "model_id_for_test"
WHERE "model_id_for_test" IS NOT NULL
  AND "default_model_id" IS NULL;

COMMIT;
