-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 运营控制台模块(2026-09-17 立,4-4-12):lottery / points-mall / promotion-rules / tax
-- 按前端管理页既有契约精确建表(admin/lottery|points-mall|promotion-rule|tax 四个列表管理页),
-- CRUD 统一经 registerCrud 暴露于 /api/admin/{promotions/lottery,points/mall,promotions/rules,billing/tax}。
-- 幂等:IF NOT EXISTS。prizes 用 JSONB(管理端配置展示;真实抽奖引擎上线时再拆 prizes 表)。

CREATE TABLE IF NOT EXISTS "lotteries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(128) NOT NULL,
  "cover" text,
  "cost_points" integer DEFAULT 0 NOT NULL,
  "free_quota" integer DEFAULT 0 NOT NULL,
  "prizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "participants" integer DEFAULT 0 NOT NULL,
  "winners" integer DEFAULT 0 NOT NULL,
  "status" varchar(16) DEFAULT 'draft' NOT NULL,
  "start_time" timestamp with time zone,
  "end_time" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_lotteries_status" ON "lotteries" ("status");
CREATE INDEX IF NOT EXISTS "ix_lotteries_name" ON "lotteries" ("name");

CREATE TABLE IF NOT EXISTS "points_mall_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(128) NOT NULL,
  "cover" text,
  "category" varchar(16) DEFAULT 'virtual' NOT NULL,
  "points_cost" integer DEFAULT 0 NOT NULL,
  "stock" integer DEFAULT 0 NOT NULL,
  "sold" integer DEFAULT 0 NOT NULL,
  "limit_per_user" integer DEFAULT 0 NOT NULL,
  "status" varchar(16) DEFAULT 'on' NOT NULL,
  "start_time" timestamp with time zone,
  "end_time" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_points_mall_status" ON "points_mall_products" ("status");
CREATE INDEX IF NOT EXISTS "ix_points_mall_name" ON "points_mall_products" ("name");

CREATE TABLE IF NOT EXISTS "promotion_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(128) NOT NULL,
  "type" varchar(16) DEFAULT 'discount' NOT NULL,
  "threshold" double precision DEFAULT 0 NOT NULL,
  "discount" double precision DEFAULT 0 NOT NULL,
  "discount_type" varchar(8) DEFAULT 'amount' NOT NULL,
  "scope" varchar(16) DEFAULT 'all' NOT NULL,
  "scope_ref" text,
  "priority" integer DEFAULT 0 NOT NULL,
  "status" varchar(16) DEFAULT 'draft' NOT NULL,
  "start_time" timestamp with time zone,
  "end_time" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_promotion_rules_status" ON "promotion_rules" ("status");
CREATE INDEX IF NOT EXISTS "ix_promotion_rules_name" ON "promotion_rules" ("name");

CREATE TABLE IF NOT EXISTS "billing_tax_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(128) NOT NULL,
  "category" varchar(64) DEFAULT 'default' NOT NULL,
  "rate" double precision DEFAULT 0 NOT NULL,
  "threshold" double precision DEFAULT 0 NOT NULL,
  "description" text,
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "effective_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_billing_tax_status" ON "billing_tax_rates" ("status");
CREATE INDEX IF NOT EXISTS "ix_billing_tax_name" ON "billing_tax_rates" ("name");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
