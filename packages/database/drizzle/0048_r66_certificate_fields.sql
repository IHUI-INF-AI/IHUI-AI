-- R66 补建: M-45 证书表新增字段 (issuer / score / valid_days)
-- 对应 schema: packages/database/src/schema/certificate.ts

-- 颁发机构
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "issuer" varchar(100);

-- 成绩
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "score" varchar(20);

-- 有效天数
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "valid_days" integer;
