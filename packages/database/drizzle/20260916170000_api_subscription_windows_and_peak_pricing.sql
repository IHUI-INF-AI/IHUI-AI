-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 中转站对外售卖产品化补强(2026-09-16 立)。
--
-- 背景:对外售卖模型 API 的主链路已闭环(目录→下单→支付→Key→调用→计费→对账→返佣),
-- 但商品化层有四处缺口(对标 Sub2API 型中转站):
--   1. 订阅套餐无法表达"日/周/月窗口限额"——配额被塞进 plans.features 字符串
--      (如 "500000 tokens/month"),运行时正则解析,既不能限窗口,也承载不了
--      原价、在售状态、套餐模型白名单。
--   2. 订阅没有"有效期"——激活即把 token 一次性累加进 developer_api_keys.token_balance,
--      无 startAt/endAt,续费与到期无法表达,也无从做窗口用量统计。
--   3. 定价只能一条固定倍率,无法按时段浮动(高峰加价/低谷降价)。
--   4. 无套餐与计费分组的软关联字段。
--
-- 本迁移新增 3 张表 + 给 plans 加 8 列,全部向后兼容:
--   - plans 新列均有 DEFAULT 或可空,存量方案不受影响,旧 features 解析逻辑保留为兜底。
--   - relay_peak_pricing_rules 无启用规则时倍率为 1,既有账单金额完全不变。
--   - api_subscriptions / api_subscription_window_usage 为新增表,存量订阅用户
--     (只有 token_balance、无订阅实例)在窗口校验中按"无窗口约束"处理,不被拦截。
--
-- 幂等:全部使用 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS,重复执行无副作用。

ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "daily_token_limit" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "weekly_token_limit" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "monthly_token_limit" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "validity_days" integer DEFAULT 30 NOT NULL;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "original_price" integer DEFAULT 0 NOT NULL;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "model_whitelist" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "is_for_sale" boolean DEFAULT true NOT NULL;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "billing_group_code" varchar(64);

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
);

CREATE INDEX IF NOT EXISTS "api_subscriptions_user_status_idx" ON "api_subscriptions" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "api_subscriptions_end_at_idx" ON "api_subscriptions" ("end_at");
CREATE INDEX IF NOT EXISTS "api_subscriptions_order_no_idx" ON "api_subscriptions" ("order_no");

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
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_subscription_window_usage_uniq_idx" ON "api_subscription_window_usage" ("subscription_id", "window_type", "window_start");
CREATE INDEX IF NOT EXISTS "api_subscription_window_usage_user_idx" ON "api_subscription_window_usage" ("user_id", "window_type");

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
);

CREATE INDEX IF NOT EXISTS "relay_peak_pricing_rules_enabled_idx" ON "relay_peak_pricing_rules" ("enabled", "priority");
CREATE INDEX IF NOT EXISTS "relay_peak_pricing_rules_model_idx" ON "relay_peak_pricing_rules" ("model_id");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
