-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
-- [IHUI-AI-PROVENANCE]: 2026-11-28 skill market purchase refund.

ALTER TABLE "skill_market_purchases"
  ADD COLUMN IF NOT EXISTS "refunded_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "refund_amount_cents" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "refund_reason" varchar(255),
  ADD COLUMN IF NOT EXISTS "refunded_by" uuid;

-- 退款后允许再次购买：把“买家+技能”的唯一约束收窄到 paid 行。
DROP INDEX IF EXISTS "skill_market_purchases_buyer_skill_uniq";

CREATE UNIQUE INDEX IF NOT EXISTS "skill_market_purchases_buyer_skill_uniq"
  ON "skill_market_purchases" ("buyer_user_id", "skill_name")
  WHERE "status" = 'paid';
