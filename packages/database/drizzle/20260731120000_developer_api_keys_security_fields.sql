-- P0-7 API Key 安全粒度字段(2026-07-31 立,对齐 New API 行业标准)
-- 为 developer_api_keys 加 4 个安全字段:
--   expires_at         — 过期时间(null = 永不过期),过期后 Key 自动失效
--   allowed_ips        — IP 白名单(jsonb 字符串数组,null/空 = 不限制),支持 CIDR
--   allowed_models     — 模型白名单(jsonb 字符串数组,null/空 = 不限制),支持通配符 gpt-4*
--   max_tokens_per_req — 单次请求 token 上限(null = 不限制),超过拒绝
-- 幂等:使用 ADD COLUMN IF NOT EXISTS(PostgreSQL 9.6+)

-- =============================================================================
-- 1. developer_api_keys 加 4 个安全字段
-- =============================================================================
ALTER TABLE developer_api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE developer_api_keys ADD COLUMN IF NOT EXISTS allowed_ips JSONB;
ALTER TABLE developer_api_keys ADD COLUMN IF NOT EXISTS allowed_models JSONB;
ALTER TABLE developer_api_keys ADD COLUMN IF NOT EXISTS max_tokens_per_req INTEGER;

COMMENT ON COLUMN developer_api_keys.expires_at IS 'P0-7 过期时间(null=永不过期),过期后 Key 自动失效';
COMMENT ON COLUMN developer_api_keys.allowed_ips IS 'P0-7 IP 白名单(jsonb 字符串数组,null/空=不限制),支持 CIDR';
COMMENT ON COLUMN developer_api_keys.allowed_models IS 'P0-7 模型白名单(jsonb 字符串数组,null/空=不限制),支持通配符 gpt-4*';
COMMENT ON COLUMN developer_api_keys.max_tokens_per_req IS 'P0-7 单次请求 token 上限(null=不限制),超过拒绝';

-- 索引:便于过期清理 job 快速扫描已过期 Key
CREATE INDEX IF NOT EXISTS developer_api_keys_expires_at_idx
  ON developer_api_keys (expires_at)
  WHERE expires_at IS NOT NULL;
