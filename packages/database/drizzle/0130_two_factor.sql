-- 0130_two_factor.sql — 2FA/MFA 字段(Wave 10,2026-07-22 立)
--
-- 用途:支持 TOTP (RFC 6238) 双因素认证
-- - two_factor_secret: TOTP 共享密钥(20 字节原始密钥,AES-256-GCM 加密后存为 bytea)
-- - two_factor_enabled: 是否已启用 2FA(默认 false)
-- - two_factor_backup_codes: 10 个 backup code 的 sha256 hash 数组(JSONB,明文不存)
-- - two_factor_enabled_at: 2FA 启用时间(用于风控/审计)
--
-- 加密 key 来自 CREDENTIALS_ENCRYPTION_KEY env(复用 apps/api/src/utils/crypto.ts 的 AES-256-GCM 实现)
-- backup code 单次使用:校验通过后立即从数组移除(由应用层负责)

ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret BYTEA;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled_at TIMESTAMPTZ;

-- 部分索引:仅对 two_factor_enabled = TRUE 的行建索引,加速登录时 2FA 校验路径
CREATE INDEX IF NOT EXISTS idx_users_two_factor_enabled
  ON users(two_factor_enabled)
  WHERE two_factor_enabled = TRUE;

COMMENT ON COLUMN users.two_factor_secret IS 'TOTP 共享密钥(AES-256-GCM 加密后的 EncryptedPayload 序列化为 bytea,key 来自 CREDENTIALS_ENCRYPTION_KEY env)';
COMMENT ON COLUMN users.two_factor_enabled IS '是否已启用 2FA(启用后登录需提供 TOTP/backup code)';
COMMENT ON COLUMN users.two_factor_backup_codes IS 'backup code 的 sha256 hash 数组(JSONB),明文不存,单次使用后立即移除';
COMMENT ON COLUMN users.two_factor_enabled_at IS '2FA 启用时间(用于风控/审计)';
