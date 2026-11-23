-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Migration 20261123020000: 发票台账与银行流水(代账取数的持久化底座)
-- 创建时间: 2026-11-23
-- 描述:
--   1. fin_invoice      —— 进项/销项发票台账,支撑"本期销项/进项/可抵扣"三个报税前置数;
--   2. fin_bank_account —— 银行账户;
--   3. fin_bank_statement —— 银行流水与对账状态(未匹配/已匹配/无关)。
-- 幂等安全:全部 IF NOT EXISTS,可安全重复执行。
-- 与 packages/database/src/schema/fin-accounting.ts 按行为规格。

CREATE TABLE IF NOT EXISTS "fin_invoice" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ledger_id" uuid NOT NULL,
  "direction" varchar(10) NOT NULL,
  "invoice_type" varchar(20) DEFAULT 'general' NOT NULL,
  "invoice_code" varchar(20),
  "invoice_no" varchar(20) NOT NULL,
  "invoice_date" date NOT NULL,
  "period" varchar(7) NOT NULL,
  "seller_name" varchar(200),
  "seller_tax_no" varchar(50),
  "buyer_name" varchar(200),
  "buyer_tax_no" varchar(50),
  "amount_excl_tax" numeric(16,2) NOT NULL,
  "tax_rate" numeric(6,4) DEFAULT '0.0000' NOT NULL,
  "tax_amount" numeric(16,2) DEFAULT '0.00' NOT NULL,
  "total_amount" numeric(16,2) NOT NULL,
  "status" varchar(20) DEFAULT 'unchecked' NOT NULL,
  "deductible" boolean DEFAULT false NOT NULL,
  "check_period" varchar(7),
  "certified_at" timestamptz,
  "voucher_id" uuid,
  "source" varchar(20) DEFAULT 'manual' NOT NULL,
  "source_ref" varchar(200),
  "remark" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  CONSTRAINT "fin_invoice_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "fin_ledger" ("id") ON DELETE CASCADE,
  CONSTRAINT "fin_invoice_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "fin_voucher" ("id") ON DELETE SET NULL,
  CONSTRAINT "fin_invoice_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "ix_fin_invoice_ledger_period" ON "fin_invoice" ("ledger_id", "period", "direction");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_invoice_ledger_no" ON "fin_invoice" ("ledger_id", "direction", "invoice_no") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "ix_fin_invoice_status" ON "fin_invoice" ("ledger_id", "status");

CREATE TABLE IF NOT EXISTS "fin_bank_account" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ledger_id" uuid NOT NULL,
  "bank_name" varchar(100) NOT NULL,
  "account_no" varchar(50) NOT NULL,
  "account_name" varchar(200),
  "currency" varchar(8) DEFAULT 'CNY' NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "fin_bank_account_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "fin_ledger" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_bank_account_ledger_no" ON "fin_bank_account" ("ledger_id", "account_no");

CREATE TABLE IF NOT EXISTS "fin_bank_statement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ledger_id" uuid NOT NULL,
  "bank_account_id" uuid NOT NULL,
  "txn_date" date NOT NULL,
  "period" varchar(7) NOT NULL,
  "direction" varchar(10) NOT NULL,
  "amount" numeric(16,2) NOT NULL,
  "balance" numeric(16,2),
  "counterparty" varchar(200),
  "summary" varchar(500),
  "serial_no" varchar(100),
  "match_status" varchar(20) DEFAULT 'unmatched' NOT NULL,
  "matched_voucher_id" uuid,
  "matched_at" timestamptz,
  "match_mode" varchar(20),
  "source" varchar(20) DEFAULT 'import' NOT NULL,
  "source_ref" varchar(200),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  CONSTRAINT "fin_bank_statement_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "fin_ledger" ("id") ON DELETE CASCADE,
  CONSTRAINT "fin_bank_statement_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "fin_bank_account" ("id") ON DELETE CASCADE,
  CONSTRAINT "fin_bank_statement_matched_voucher_id_fkey" FOREIGN KEY ("matched_voucher_id") REFERENCES "fin_voucher" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "ix_fin_bank_ledger_period" ON "fin_bank_statement" ("ledger_id", "period", "match_status");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_bank_source_ref" ON "fin_bank_statement" ("ledger_id", "source_ref") WHERE "deleted_at" IS NULL AND "source_ref" IS NOT NULL;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
