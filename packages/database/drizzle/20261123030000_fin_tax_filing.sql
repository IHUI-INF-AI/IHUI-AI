-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Migration 20261123030000: 税种核定与申报日历
-- 创建时间: 2026-11-23
-- 描述:
--   fin_tax_profile —— 客户级税种核定(税种 + 申报周期 + 截止日 + 征收方式 + 税率);
--   fin_filing_task —— 由核定生成的申报任务(申报日历的一格),按(核定,期间)唯一。
--   目标:把"每月 15 日前必须报什么"从人的记忆变成可核对、可防漏的台账。
-- 幂等安全:全部 IF NOT EXISTS,可安全重复执行。
-- 与 packages/database/src/schema/fin-accounting.ts 按行为规格。

CREATE TABLE IF NOT EXISTS "fin_tax_profile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "tax_type" varchar(20) NOT NULL,
  "taxpayer_type" varchar(20),
  "collection_method" varchar(20) DEFAULT 'audit' NOT NULL,
  "filing_cycle" varchar(20) DEFAULT 'monthly' NOT NULL,
  "due_month_offset" integer DEFAULT 1 NOT NULL,
  "due_day" integer DEFAULT 15 NOT NULL,
  "rate" numeric(6,4) DEFAULT '0.0000' NOT NULL,
  "deemed_rate" numeric(6,4),
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "effective_from" date,
  "effective_to" date,
  "remark" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  CONSTRAINT "fin_tax_profile_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "fin_client" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_tax_profile_active" ON "fin_tax_profile" ("client_id", "tax_type") WHERE "deleted_at" IS NULL AND "status" = 'active';
CREATE INDEX IF NOT EXISTS "ix_fin_tax_profile_client" ON "fin_tax_profile" ("client_id", "status");

CREATE TABLE IF NOT EXISTS "fin_filing_task" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "ledger_id" uuid,
  "tax_profile_id" uuid NOT NULL,
  "tax_type" varchar(20) NOT NULL,
  "period" varchar(10) NOT NULL,
  "due_date" date NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "taxable_base" numeric(16,2),
  "tax_amount" numeric(16,2),
  "paid_amount" numeric(16,2),
  "draft_ref" varchar(500),
  "submitted_at" timestamptz,
  "accepted_at" timestamptz,
  "receipt_no" varchar(100),
  "receipt_payload" jsonb,
  "assignee" uuid,
  "note" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "fin_filing_task_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "fin_client" ("id") ON DELETE CASCADE,
  CONSTRAINT "fin_filing_task_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "fin_ledger" ("id") ON DELETE SET NULL,
  CONSTRAINT "fin_filing_task_tax_profile_id_fkey" FOREIGN KEY ("tax_profile_id") REFERENCES "fin_tax_profile" ("id") ON DELETE CASCADE,
  CONSTRAINT "fin_filing_task_assignee_fkey" FOREIGN KEY ("assignee") REFERENCES "users" ("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fin_filing_task" ON "fin_filing_task" ("tax_profile_id", "period");
CREATE INDEX IF NOT EXISTS "ix_fin_filing_due" ON "fin_filing_task" ("due_date", "status");
CREATE INDEX IF NOT EXISTS "ix_fin_filing_client" ON "fin_filing_task" ("client_id", "status");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
