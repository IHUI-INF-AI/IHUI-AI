-- 0128_robustness_p0_security.sql
-- 2026-07-22 P0 鲁棒性加固:OAuth 字段加密 + refresh_tokens family 索引
--
-- 改动:
-- 1. oauth_apps 新增 client_secret_hash 列(bcrypt 哈希,逐步替代 client_secret 明文)
-- 2. oauth_private_keys 新增 encryption_key_id 列(KMS key ID 占位)
-- 3. refresh_tokens 新增 family_id 索引(加速 revokeRefreshTokenFamily)
--
-- 安全说明:
-- - client_secret_hash 列 nullable,迁移期 clientSecret(明文)与 clientSecretHash(哈希)并存
-- - 应用层优先用 clientSecretHash 验证,为 null 时回退到 clientSecret(向后兼容)
-- - 迁移完成后,运行数据迁移脚本:对每个 oauth_apps 行,把 clientSecret bcrypt 哈希化填入 client_secret_hash,然后清空 client_secret
-- - encryption_key_id 为空时,privateKey 仍为明文(向后兼容),生产环境应逐步迁移到 KMS
--
-- Down/rollback:
-- ALTER TABLE oauth_apps DROP COLUMN IF EXISTS client_secret_hash;
-- ALTER TABLE oauth_private_keys DROP COLUMN IF EXISTS encryption_key_id;
-- DROP INDEX IF EXISTS refresh_tokens_family_id_idx;

-- 1. oauth_apps 新增 client_secret_hash 列
ALTER TABLE "oauth_apps" ADD COLUMN IF NOT EXISTS "client_secret_hash" text;

-- 2. oauth_private_keys 新增 encryption_key_id 列
ALTER TABLE "oauth_private_keys" ADD COLUMN IF NOT EXISTS "encryption_key_id" varchar(256);

-- 3. refresh_tokens 新增 family_id 索引(加速 revokeRefreshTokenFamily 查询)
CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_idx" ON "refresh_tokens" ("family_id") WHERE "revoked_at" IS NULL;
