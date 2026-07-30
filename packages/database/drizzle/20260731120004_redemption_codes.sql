-- 兑换码表(2026-07-31 立,P0-5 刮刮卡式裂变充值)
-- status: 'unused'(未使用) / 'used'(已使用) / 'expired'(已过期) / 'disabled'(管理员禁用)
-- code: 16 位大写字母+数字,带 hyphen 分隔(如 IHUI-XXXX-XXXX-XXXX),全局唯一
CREATE TABLE IF NOT EXISTS redemption_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) NOT NULL UNIQUE,
  batch_id UUID,
  face_value_cents INTEGER NOT NULL,
  token_amount BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'unused',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS redemption_codes_code_idx ON redemption_codes(code);
CREATE INDEX IF NOT EXISTS redemption_codes_batch_idx ON redemption_codes(batch_id);
CREATE INDEX IF NOT EXISTS redemption_codes_status_idx ON redemption_codes(status);
