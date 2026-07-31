-- API Key 临时分享/限时 token 表(2026-08-01 立,B 端协作场景高频需求)
-- 允许用户生成限时分享 token 给他人使用,scope 限定 + 速率限制 + 自动过期。
-- share_token 作为 API key 调用(独立于源 Key 的速率/配额),过期或撤销后自动失效。
-- 余额规则:max_total_tokens null = 无限;used_total_tokens 累计递增不回退。
CREATE TABLE IF NOT EXISTS api_key_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_api_key_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  share_token VARCHAR(64) NOT NULL UNIQUE,
  scope_models TEXT[],
  scope_endpoints TEXT[],
  rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
  rate_limit_tpm INTEGER NOT NULL DEFAULT 100000,
  max_total_tokens BIGINT,
  used_total_tokens BIGINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_key_shares_token ON api_key_shares(share_token) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_key_shares_source ON api_key_shares(source_api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_shares_expires ON api_key_shares(expires_at) WHERE revoked_at IS NULL;
