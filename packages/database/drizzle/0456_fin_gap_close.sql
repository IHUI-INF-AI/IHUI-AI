-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 财务代账补口(2026-11-24):凭证附件 / 年结台账 / 发票验真状态

-- 1) 凭证附件(票据影像引用;文件本体走 /api/files/upload/form)
CREATE TABLE IF NOT EXISTS "fin_voucher_attachment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "voucher_id" uuid NOT NULL REFERENCES "fin_voucher"("id") ON DELETE CASCADE,
  "ledger_id" uuid NOT NULL REFERENCES "fin_ledger"("id") ON DELETE CASCADE,
  "file_id" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "url" varchar(1000) NOT NULL,
  "mime_type" varchar(128) NOT NULL DEFAULT 'application/octet-stream',
  "size" bigint NOT NULL DEFAULT 0,
  "sha256" varchar(64),
  "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_voucher_attachment_file"
  ON "fin_voucher_attachment" ("ledger_id", "file_id")
  WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "ix_fin_voucher_attachment_voucher"
  ON "fin_voucher_attachment" ("voucher_id");

-- 2) 年结台账
CREATE TABLE IF NOT EXISTS "fin_year_end" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ledger_id" uuid NOT NULL REFERENCES "fin_ledger"("id") ON DELETE CASCADE,
  "year" integer NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'closed',
  "profit_balance" numeric(16,2) NOT NULL DEFAULT '0.00',
  "transfer_amount" numeric(16,2) NOT NULL DEFAULT '0.00',
  "voucher_id" uuid REFERENCES "fin_voucher"("id") ON DELETE SET NULL,
  "voucher_no" varchar(30),
  "opening_snapshot" jsonb,
  "closed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "closed_at" timestamptz,
  "reopened_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reopened_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_year_end_ledger_year"
  ON "fin_year_end" ("ledger_id", "year");

-- 3) 发票验真状态(外部查验源未接时落 unavailable,绝不冒充 verified)
ALTER TABLE "fin_invoice"
  ADD COLUMN IF NOT EXISTS "verify_status" varchar(20) NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS "verify_message" varchar(500),
  ADD COLUMN IF NOT EXISTS "verified_at" timestamptz;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
