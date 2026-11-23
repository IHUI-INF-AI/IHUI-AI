-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Migration 20261123010000: 财务代账核心账套模型(客户/账套/科目/期初/凭证/余额/结账)
-- 创建时间: 2026-11-23
-- 描述: 把「AI 一键代账」的产物从临时文件升级为可跨期连续的真账:
--       客户(纳税主体) → 账套 → 科目 → 期初余额 → 凭证 → 科目余额 → 期间结账。
--       三条不变量:凭证必平才能过账 / 已结账期间拒绝写入 / 期间内凭证号唯一。
-- 幂等安全:全部 IF NOT EXISTS,可安全重复执行。
-- 与 packages/database/src/schema/fin-accounting.ts 按行为规格。

CREATE TABLE IF NOT EXISTS "fin_client" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "short_name" varchar(100),
  "tax_no" varchar(50),
  "taxpayer_type" varchar(20) DEFAULT 'small' NOT NULL,
  "industry" varchar(100),
  "region" varchar(100),
  "tax_authority" varchar(200),
  "legal_person" varchar(100),
  "contact_name" varchar(100),
  "contact_phone" varchar(50),
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "start_date" date,
  "remark" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  CONSTRAINT "fin_client_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "ix_fin_client_status" ON "fin_client" ("status");
CREATE INDEX IF NOT EXISTS "ix_fin_client_name" ON "fin_client" ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_client_tax_no" ON "fin_client" ("tax_no") WHERE "deleted_at" IS NULL AND "tax_no" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "fin_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "name" varchar(100) NOT NULL,
  "accounting_standard" varchar(30) DEFAULT 'small_business' NOT NULL,
  "base_currency" varchar(8) DEFAULT 'CNY' NOT NULL,
  "start_period" varchar(7) NOT NULL,
  "current_period" varchar(7) NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  CONSTRAINT "fin_ledger_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "fin_client" ("id") ON DELETE CASCADE,
  CONSTRAINT "fin_ledger_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "ix_fin_ledger_client" ON "fin_ledger" ("client_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_ledger_client_name" ON "fin_ledger" ("client_id", "name") WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "fin_account" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ledger_id" uuid NOT NULL,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "category" varchar(20) NOT NULL,
  "direction" varchar(10) NOT NULL,
  "parent_code" varchar(20),
  "level" integer DEFAULT 1 NOT NULL,
  "is_leaf" boolean DEFAULT true NOT NULL,
  "aux_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "is_system" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "fin_account_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "fin_ledger" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_account_ledger_code" ON "fin_account" ("ledger_id", "code");
CREATE INDEX IF NOT EXISTS "ix_fin_account_ledger" ON "fin_account" ("ledger_id", "enabled");

CREATE TABLE IF NOT EXISTS "fin_opening_balance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ledger_id" uuid NOT NULL,
  "period" varchar(7) NOT NULL,
  "account_code" varchar(20) NOT NULL,
  "debit_amount" numeric(16,2) DEFAULT '0.00' NOT NULL,
  "credit_amount" numeric(16,2) DEFAULT '0.00' NOT NULL,
  "aux" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "fin_opening_balance_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "fin_ledger" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_opening_ledger_period_code" ON "fin_opening_balance" ("ledger_id", "period", "account_code");

CREATE TABLE IF NOT EXISTS "fin_voucher" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ledger_id" uuid NOT NULL,
  "period" varchar(7) NOT NULL,
  "voucher_no" varchar(30) NOT NULL,
  "voucher_date" date NOT NULL,
  "summary" varchar(500),
  "source" varchar(20) DEFAULT 'manual' NOT NULL,
  "source_ref" varchar(200),
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "total_debit" numeric(16,2) DEFAULT '0.00' NOT NULL,
  "total_credit" numeric(16,2) DEFAULT '0.00' NOT NULL,
  "attachment_count" integer DEFAULT 0 NOT NULL,
  "review_status" integer DEFAULT 0 NOT NULL,
  "reviewed_by" uuid,
  "reviewed_at" timestamptz,
  "review_comment" text,
  "reverses_voucher_id" uuid,
  "created_by" uuid,
  "posted_by" uuid,
  "posted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  CONSTRAINT "fin_voucher_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "fin_ledger" ("id") ON DELETE CASCADE,
  CONSTRAINT "fin_voucher_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL,
  CONSTRAINT "fin_voucher_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users" ("id") ON DELETE SET NULL,
  CONSTRAINT "fin_voucher_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_voucher_ledger_period_no" ON "fin_voucher" ("ledger_id", "period", "voucher_no") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_voucher_source_ref" ON "fin_voucher" ("ledger_id", "source_ref") WHERE "deleted_at" IS NULL AND "source_ref" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ix_fin_voucher_ledger_period" ON "fin_voucher" ("ledger_id", "period", "status");

CREATE TABLE IF NOT EXISTS "fin_voucher_line" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "voucher_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "account_code" varchar(20) NOT NULL,
  "account_name" varchar(100) NOT NULL,
  "direction" varchar(10) NOT NULL,
  "amount" numeric(16,2) NOT NULL,
  "summary" varchar(500),
  "aux" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "fin_voucher_line_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "fin_voucher" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_voucher_line_no" ON "fin_voucher_line" ("voucher_id", "line_no");
CREATE INDEX IF NOT EXISTS "ix_fin_line_account" ON "fin_voucher_line" ("account_code");

CREATE TABLE IF NOT EXISTS "fin_account_balance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ledger_id" uuid NOT NULL,
  "period" varchar(7) NOT NULL,
  "account_code" varchar(20) NOT NULL,
  "opening_debit" numeric(16,2) DEFAULT '0.00' NOT NULL,
  "opening_credit" numeric(16,2) DEFAULT '0.00' NOT NULL,
  "period_debit" numeric(16,2) DEFAULT '0.00' NOT NULL,
  "period_credit" numeric(16,2) DEFAULT '0.00' NOT NULL,
  "closing_debit" numeric(16,2) DEFAULT '0.00' NOT NULL,
  "closing_credit" numeric(16,2) DEFAULT '0.00' NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "fin_account_balance_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "fin_ledger" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_balance_ledger_period_code" ON "fin_account_balance" ("ledger_id", "period", "account_code");

CREATE TABLE IF NOT EXISTS "fin_period_close" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ledger_id" uuid NOT NULL,
  "period" varchar(7) NOT NULL,
  "status" varchar(20) DEFAULT 'open' NOT NULL,
  "profit_amount" numeric(16,2) DEFAULT '0.00' NOT NULL,
  "voucher_count" integer DEFAULT 0 NOT NULL,
  "closed_by" uuid,
  "closed_at" timestamptz,
  "reopened_by" uuid,
  "reopened_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "fin_period_close_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "fin_ledger" ("id") ON DELETE CASCADE,
  CONSTRAINT "fin_period_close_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users" ("id") ON DELETE SET NULL,
  CONSTRAINT "fin_period_close_reopened_by_fkey" FOREIGN KEY ("reopened_by") REFERENCES "users" ("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_period_ledger_period" ON "fin_period_close" ("ledger_id", "period");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
