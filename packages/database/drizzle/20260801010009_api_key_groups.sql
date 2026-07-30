-- API Key 分组表(2026-08-01 立,P0 中转站造血能力批次)
-- 多 Key 共享一个额度池:组内任一 Key 消费即扣组池余额。
-- 子 Key 继承组级限制(allowedModels / allowedIps / rateLimitQpm),可在 member 行追加更严格限制。
-- 余额规则:-1 = 无限额度,0 = 耗尽,>0 = 可用。
CREATE TABLE IF NOT EXISTS api_key_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  owner_id UUID NOT NULL,
  description TEXT,
  shared_token_balance INTEGER NOT NULL DEFAULT 0,
  shared_cost_balance_cents INTEGER NOT NULL DEFAULT 0,
  rate_limit_qpm INTEGER NOT NULL DEFAULT 100,
  allowed_models JSONB,
  allowed_ips JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS api_key_groups_owner_idx ON api_key_groups(owner_id);

-- API Key 分组成员表(子 Key 加入组,继承组限制 + 可追加更严格限制)
-- 一个 API Key 同时只能在一个组(api_key_id 唯一索引)
CREATE TABLE IF NOT EXISTS api_key_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES api_key_groups(id) ON DELETE CASCADE,
  api_key_id UUID NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'member',
  max_tokens_per_req INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS api_key_group_members_group_idx ON api_key_group_members(group_id);
CREATE UNIQUE INDEX IF NOT EXISTS api_key_group_members_api_key_unique ON api_key_group_members(api_key_id);

-- API Key 分组邀请码表(8 位大写字母数字,24h 有效,一次性使用)
CREATE TABLE IF NOT EXISTS api_key_group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES api_key_groups(id) ON DELETE CASCADE,
  invite_code VARCHAR(16) NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS api_key_group_invites_group_idx ON api_key_group_invites(group_id);
CREATE INDEX IF NOT EXISTS api_key_group_invites_code_idx ON api_key_group_invites(invite_code);
