-- API Key TPM 限流 + 标签管理(对齐 New API 行业标准)
-- 2026-07-31 立:给 developer_api_keys 表加 TPM 限流 + 标签字段,新增分钟级用量统计表

-- 给 developer_api_keys 表加 TPM 限流 + 标签字段
ALTER TABLE developer_api_keys
  ADD COLUMN IF NOT EXISTS tpm_limit INTEGER, -- 每分钟 token 上限,null=无限
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}', -- 标签数组,用于分组管理
  ADD COLUMN IF NOT EXISTS alias VARCHAR(100), -- 别名(显示用,区别于 name)
  ADD COLUMN IF NOT EXISTS description TEXT; -- 备注/描述

-- TPM 用量统计表(按分钟聚合,Redis 为主,DB 兜底)
CREATE TABLE IF NOT EXISTS api_key_minute_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  usage_minute TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  request_count INTEGER DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(api_key_id, usage_minute)
);

CREATE INDEX IF NOT EXISTS idx_api_key_minute_usage_time ON api_key_minute_usage(usage_minute);
CREATE INDEX IF NOT EXISTS idx_api_key_minute_usage_key ON api_key_minute_usage(api_key_id);
