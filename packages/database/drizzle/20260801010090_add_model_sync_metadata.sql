-- Migration: add_model_sync_metadata
-- Description: 为 ai_model_config_models 表添加 ModelSyncService v3 深度优化所需的元数据字段
--   tags / description / vendor / max_output_tokens / supports_tool_call / supports_vision
--   supports_streaming / rate_limit_rpm / rate_limit_tpd / release_date / deprecation_date
--   upstream_etag / upstream_last_modified / last_synced_at
-- Author: ModelSyncService v3 (2026-07-31)
-- Hazard: 无破坏性,全部 ADD COLUMN(可空 + DEFAULT)

-- 1. ai_model_config_models 新增 14 个元数据字段
ALTER TABLE ai_model_config_models
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS vendor varchar(64),
  ADD COLUMN IF NOT EXISTS max_output_tokens integer,
  ADD COLUMN IF NOT EXISTS supports_tool_call boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_vision boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_streaming boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS rate_limit_rpm integer,
  ADD COLUMN IF NOT EXISTS rate_limit_tpd integer,
  ADD COLUMN IF NOT EXISTS release_date varchar(32),
  ADD COLUMN IF NOT EXISTS deprecation_date varchar(32),
  ADD COLUMN IF NOT EXISTS upstream_etag varchar(255),
  ADD COLUMN IF NOT EXISTS upstream_last_modified varchar(64),
  ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone;

-- 2. 索引(为同步过滤常用查询添加)
CREATE INDEX IF NOT EXISTS idx_ai_model_config_models_tags ON ai_model_config_models USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_ai_model_config_models_vendor ON ai_model_config_models(vendor);
CREATE INDEX IF NOT EXISTS idx_ai_model_config_models_last_synced_at ON ai_model_config_models(last_synced_at DESC);
