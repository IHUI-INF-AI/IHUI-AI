-- Passkey (WebAuthn/FIDO2) 无密码登录支持(2026-08-01 立)
-- user_passkeys: 用户注册的 Passkey 凭证表
--   - credential_id: 客户端生成的唯一凭证 ID(base64url 字符串),全局唯一
--   - public_key: 凭证公钥(bytea,用于验证认证响应签名)
--   - counter: 签名计数器(防重放攻击,每次认证递增,必须 > 上次值)
--   - transports: 支持的传输方式数组(usb/nfc/ble/internal/hybrid)
--   - device_type: 设备类型(singleDevice | multiDevice,反映是否可漫游)
--   - aaguid: 认证器型号标识(AAGUID,用于识别硬件/软件 authenticator)
--   - name: 用户自定义名称(MacBook Pro / iPhone 等,便于管理多个 Passkey)
CREATE TABLE IF NOT EXISTS "user_passkeys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "credential_id" text NOT NULL UNIQUE,
  "public_key" bytea NOT NULL,
  "counter" bigint NOT NULL DEFAULT 0,
  "transports" text[],
  "device_type" text,
  "aaguid" text,
  "name" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_used_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "user_passkeys_user_id_idx" ON "user_passkeys"("user_id");
CREATE INDEX IF NOT EXISTS "user_passkeys_credential_id_idx" ON "user_passkeys"("credential_id");
