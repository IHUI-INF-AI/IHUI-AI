-- 发布 API 独立账本补价格快照（2026-11-28）
-- 免费期 unit_price_cents=0、amount_cents=0；调价只影响新写入行，不改历史。
ALTER TABLE "publish_api_usage_records"
  ADD COLUMN IF NOT EXISTS "unit_price_cents" integer NOT NULL DEFAULT 0;
ALTER TABLE "publish_api_usage_records"
  ADD COLUMN IF NOT EXISTS "amount_cents" integer NOT NULL DEFAULT 0;
ALTER TABLE "publish_api_usage_records"
  ADD COLUMN IF NOT EXISTS "currency" varchar(8) NOT NULL DEFAULT 'CNY';
