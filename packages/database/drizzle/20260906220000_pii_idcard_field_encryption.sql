-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- P0 隐私修复(2026-09-06):敏感 PII 字段级加密(migration)
-- 背景:idCard 由 varchar(20) 改为 text,以承载字段级加密(AES-256-GCM)后的 JSON 密文。
--   应用密钥 CREDENTIALS_ENCRYPTION_KEY,写/读边界在 apps/api/src/routes/auth-identity.ts。
-- 兼容性:存量明文在 text 下仍可读(读路径 decryptField 对明文原样返回),不强制回填。

-- 1) 列类型放宽:varchar(20) -> text(密文 JSON 长度远超 20)
ALTER TABLE "user_auth_info" ALTER COLUMN "id_card" TYPE text;--> statement-breakpoint

-- 2) (可选/默认跳过)若需把存量明文 idCard 一次性加密回填,由运维脚本按行读写后
--    UPDATE "user_auth_info" SET "id_card" = '<encryptField(id_card)>' WHERE ...;
--    回填前请先升级应用并使用新版本完成迁移/重启,确保读路径已支持密文。此处仅注释说明。