-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
--
-- 2026-10-26 短信 A 组:A6 台账号码保护(phone_hash + 掩码) + A2 幂等索引。
-- 回填使用 PG 内建 sha256(bytea)(PG 11+),不依赖 pgcrypto。
-- 与 apps/api/src/services/sms-compliance.ts 的 hashSmsPhone 同一算法:
--   sha256(utf8(归一后号码)) 的十六进制小写。

ALTER TABLE sms_delivery_logs ADD COLUMN IF NOT EXISTS phone_hash varchar(64);
ALTER TABLE sms_delivery_logs ADD COLUMN IF NOT EXISTS phone_masked varchar(32);

UPDATE sms_delivery_logs
   SET phone_hash = encode(sha256(convert_to(phone, 'UTF8')), 'hex')
 WHERE phone_hash IS NULL AND phone IS NOT NULL;

UPDATE sms_delivery_logs
   SET phone_masked = left(phone, 3) || '****' || right(phone, 4)
 WHERE phone_masked IS NULL AND length(phone) >= 7;

CREATE INDEX IF NOT EXISTS sms_delivery_logs_phone_hash_idx
  ON sms_delivery_logs (phone_hash);
CREATE INDEX IF NOT EXISTS sms_delivery_logs_biz_idx
  ON sms_delivery_logs (biz_type, biz_id);

ALTER TABLE sms_unsubscribes ADD COLUMN IF NOT EXISTS phone_hash varchar(64);
ALTER TABLE sms_unsubscribes ADD COLUMN IF NOT EXISTS phone_masked varchar(32);

UPDATE sms_unsubscribes
   SET phone_hash = encode(sha256(convert_to(phone, 'UTF8')), 'hex')
 WHERE phone_hash IS NULL AND phone IS NOT NULL;

UPDATE sms_unsubscribes
   SET phone_masked = left(phone, 3) || '****' || right(phone, 4)
 WHERE phone_masked IS NULL AND length(phone) >= 7;

CREATE INDEX IF NOT EXISTS sms_unsubscribes_phone_hash_idx
  ON sms_unsubscribes (phone_hash);
