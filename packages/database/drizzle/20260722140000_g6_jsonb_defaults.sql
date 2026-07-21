-- G6 jsonb 预留字段填充:13 个 P0 字段加 default + 回填 NULL
-- 审计发现这些 jsonb 字段未设 default,代码访问 NULL 会崩(特别是 workflows.steps 被 .map() 依赖)
-- 安全策略:全部幂等,可安全重复执行

-- =============================================================================
-- 阶段 1:回填 NULL 数据(必须在 SET DEFAULT 和 SET NOT NULL 之前)
-- =============================================================================

-- 对象类型字段回填 '{}'
UPDATE "audit_logs" SET "details" = '{}'::jsonb WHERE "details" IS NULL;
UPDATE "search_history" SET "filters" = '{}'::jsonb WHERE "filters" IS NULL;
UPDATE "workflows" SET "trigger_config" = '{}'::jsonb WHERE "trigger_config" IS NULL;
UPDATE "workflow_instances" SET "context" = '{}'::jsonb WHERE "context" IS NULL;
UPDATE "chat_conversations" SET "metadata" = '{}'::jsonb WHERE "metadata" IS NULL;
UPDATE "chat_messages" SET "metadata" = '{}'::jsonb WHERE "metadata" IS NULL;
UPDATE "ai_vendor_configs" SET "config_json" = '{}'::jsonb WHERE "config_json" IS NULL;
UPDATE "certificate_templates" SET "template_config" = '{}'::jsonb WHERE "template_config" IS NULL;
UPDATE "oss_drivers" SET "config" = '{}'::jsonb WHERE "config" IS NULL;
UPDATE "integration_configs" SET "config" = '{}'::jsonb WHERE "config" IS NULL;
UPDATE "llm_call_logs" SET "metadata" = '{}'::jsonb WHERE "metadata" IS NULL;
UPDATE "analytics_events" SET "properties" = '{}'::jsonb WHERE "properties" IS NULL;

-- 数组类型字段回填 '[]'
UPDATE "workflows" SET "steps" = '[]'::jsonb WHERE "steps" IS NULL;

-- =============================================================================
-- 阶段 2:SET DEFAULT(13 个字段)
-- PostgreSQL ALTER COLUMN SET DEFAULT 原生幂等
-- audit_logs 是分区表(R70 重建),SET DEFAULT 会自动传播到子分区
-- =============================================================================

ALTER TABLE "audit_logs" ALTER COLUMN "details" SET DEFAULT '{}'::jsonb;
ALTER TABLE "search_history" ALTER COLUMN "filters" SET DEFAULT '{}'::jsonb;
ALTER TABLE "workflows" ALTER COLUMN "trigger_config" SET DEFAULT '{}'::jsonb;
ALTER TABLE "workflows" ALTER COLUMN "steps" SET DEFAULT '[]'::jsonb;
ALTER TABLE "workflow_instances" ALTER COLUMN "context" SET DEFAULT '{}'::jsonb;
ALTER TABLE "chat_conversations" ALTER COLUMN "metadata" SET DEFAULT '{}'::jsonb;
ALTER TABLE "chat_messages" ALTER COLUMN "metadata" SET DEFAULT '{}'::jsonb;
ALTER TABLE "ai_vendor_configs" ALTER COLUMN "config_json" SET DEFAULT '{}'::jsonb;
ALTER TABLE "certificate_templates" ALTER COLUMN "template_config" SET DEFAULT '{}'::jsonb;
ALTER TABLE "oss_drivers" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb;
ALTER TABLE "integration_configs" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb;
ALTER TABLE "llm_call_logs" ALTER COLUMN "metadata" SET DEFAULT '{}'::jsonb;
ALTER TABLE "analytics_events" ALTER COLUMN "properties" SET DEFAULT '{}'::jsonb;

-- =============================================================================
-- 阶段 3:SET NOT NULL(仅 workflows.steps,代码 .map() 强依赖)
-- 必须在阶段 1 回填之后执行,否则已有 NULL 行会报错
-- PostgreSQL ALTER COLUMN SET NOT NULL 原生幂等(已是 NOT NULL 时无副作用)
-- =============================================================================

ALTER TABLE "workflows" ALTER COLUMN "steps" SET NOT NULL;
