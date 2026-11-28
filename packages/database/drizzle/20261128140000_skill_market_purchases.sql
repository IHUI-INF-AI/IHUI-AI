-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
-- [IHUI-AI-PROVENANCE]: 2026-11-28 skill market purchases ledger.

CREATE TABLE IF NOT EXISTS "skill_market_purchases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "skill_name" varchar(64) NOT NULL,
  "skill_version" varchar(32) DEFAULT '1.0.0' NOT NULL,
  "buyer_user_id" uuid NOT NULL,
  "seller_user_id" uuid,
  "price_cents" integer DEFAULT 0 NOT NULL,
  "currency" varchar(8) DEFAULT 'CNY' NOT NULL,
  "revenue_share_bps" integer DEFAULT 0 NOT NULL,
  "author_share_cents" integer DEFAULT 0 NOT NULL,
  "platform_share_cents" integer DEFAULT 0 NOT NULL,
  "status" varchar(16) DEFAULT 'paid' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "skill_market_purchases_buyer_skill_uniq"
  ON "skill_market_purchases" ("buyer_user_id", "skill_name");

CREATE INDEX IF NOT EXISTS "skill_market_purchases_seller_time_idx"
  ON "skill_market_purchases" ("seller_user_id", "created_at");
