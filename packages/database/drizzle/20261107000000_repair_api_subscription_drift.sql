-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 补偿迁移(2026-11-07):修复 20260916170000 在存量库(dev/生产)未生效的 3 表 + plans 8 列 + 7 索引。
-- 背景:该迁移正文在本地应用后又扩展了内容(账本 __drizzle_migrations 只记 created_at、不校验 hash),
-- 已 applied 的库不会重跑新正文,于是出现"账本说已应用、库里表/列不存在"的漂移:
--   · plans 缺 daily/weekly/monthly_token_limit、validity_days、original_price、model_whitelist、
--     is_for_sale、billing_group_code —— 而 apps/api 里 select().from(plans) 会选中全部声明列(42703)。
--   · api_subscriptions / api_subscription_window_usage / relay_peak_pricing_rules 三表不存在。
-- 本迁移只做幂等补建(全部 IF NOT EXISTS),不改任何既有迁移正文;空库重放与存量库修复都安全。

ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "daily_token_limit" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "weekly_token_limit" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "monthly_token_limit" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "validity_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "original_price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "model_whitelist" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "is_for_sale" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "billing_group_code" varchar(64);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "api_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "plan_id" uuid REFERENCES "plans" ("id") ON DELETE SET NULL,
  "order_id" uuid REFERENCES "orders" ("id") ON DELETE SET NULL,
  "order_no" varchar(64),
  "plan_name" varchar(64) NOT NULL,
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "start_at" timestamp with time zone DEFAULT now() NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "daily_token_limit" bigint DEFAULT 0 NOT NULL,
  "weekly_token_limit" bigint DEFAULT 0 NOT NULL,
  "monthly_token_limit" bigint DEFAULT 0 NOT NULL,
  "auto_renew" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "api_subscriptions_user_status_idx" ON "api_subscriptions" ("user_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_subscriptions_end_at_idx" ON "api_subscriptions" ("end_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_subscriptions_order_no_idx" ON "api_subscriptions" ("order_no");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "api_subscription_window_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscription_id" uuid NOT NULL REFERENCES "api_subscriptions" ("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "window_type" varchar(8) NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "window_end" timestamp with time zone NOT NULL,
  "tokens_used" bigint DEFAULT 0 NOT NULL,
  "cost_used_cents" numeric(18, 6) DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "api_subscription_window_usage_uniq_idx" ON "api_subscription_window_usage" ("subscription_id", "window_type", "window_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_subscription_window_usage_user_idx" ON "api_subscription_window_usage" ("user_id", "window_type");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "relay_peak_pricing_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(64) NOT NULL,
  "model_id" varchar(128),
  "provider_code" varchar(64),
  "days_of_week" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "start_minute" integer NOT NULL,
  "end_minute" integer NOT NULL,
  "multiplier" numeric(10, 4) NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "remark" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "relay_peak_pricing_rules_enabled_idx" ON "relay_peak_pricing_rules" ("enabled", "priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relay_peak_pricing_rules_model_idx" ON "relay_peak_pricing_rules" ("model_id");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
