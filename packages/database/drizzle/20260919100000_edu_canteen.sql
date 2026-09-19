-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 教育机构食堂采购记账(2026-09-19 立):供应商 / 采购单(AI 多轮核对) / 采购明细。
-- 状态机: draft → ai_extracted → ai_verified / ai_conflict → confirmed → voided。
-- ai_verifications JSONB 存 AI 三轮核对全记录(extract/verify/arbitrate),receipt_image_url 存小票图。
-- 幂等:IF NOT EXISTS。外键 users/edu_canteen_supplier 均 ON DELETE SET NULL,明细随主表级联删除。

CREATE TABLE IF NOT EXISTS "edu_canteen_supplier" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "category" varchar(50),
  "contact_person" varchar(100),
  "phone" varchar(50),
  "address" text,
  "license_info" varchar(300),
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "notes" text,
  "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_edu_canteen_supplier_name" ON "edu_canteen_supplier" ("name");
CREATE INDEX IF NOT EXISTS "ix_edu_canteen_supplier_category" ON "edu_canteen_supplier" ("category");

CREATE TABLE IF NOT EXISTS "edu_canteen_procurement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "procurement_date" date NOT NULL,
  "supplier_id" uuid REFERENCES "edu_canteen_supplier" ("id") ON DELETE SET NULL,
  "supplier_name" varchar(200),
  "receipt_no" varchar(100),
  "total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
  "item_count" integer DEFAULT 0 NOT NULL,
  "receipt_image_url" text,
  "status" varchar(30) DEFAULT 'draft' NOT NULL,
  "ai_rounds" integer DEFAULT 0 NOT NULL,
  "ai_verifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "ai_confidence" integer,
  "confirmed_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
  "confirmed_at" timestamp with time zone,
  "notes" text,
  "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_edu_canteen_proc_date" ON "edu_canteen_procurement" ("procurement_date");
CREATE INDEX IF NOT EXISTS "ix_edu_canteen_proc_status" ON "edu_canteen_procurement" ("status");
CREATE INDEX IF NOT EXISTS "ix_edu_canteen_proc_supplier" ON "edu_canteen_procurement" ("supplier_id");

CREATE TABLE IF NOT EXISTS "edu_canteen_procurement_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "procurement_id" uuid NOT NULL REFERENCES "edu_canteen_procurement" ("id") ON DELETE CASCADE,
  "item_name" varchar(200) NOT NULL,
  "category" varchar(50),
  "quantity" numeric(12, 3),
  "unit" varchar(20),
  "unit_price" numeric(12, 2),
  "amount" numeric(12, 2) DEFAULT '0' NOT NULL,
  "verify_status" varchar(20) DEFAULT 'ok' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_edu_canteen_item_proc" ON "edu_canteen_procurement_item" ("procurement_id");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
