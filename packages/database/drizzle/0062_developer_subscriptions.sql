-- 开发者套餐订阅记录表
-- 对应 schema: packages/database/src/schema/developer.ts developerSubscriptions
-- 用途: 记录用户购买开发者套餐的订阅状态(周期/起止时间/关联订单)

CREATE TABLE IF NOT EXISTS "developer_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "pricing_id" uuid REFERENCES "developer_pricing"("id") ON DELETE SET NULL,
  "period" varchar(50),
  "start_time" timestamptz DEFAULT now() NOT NULL,
  "end_time" timestamptz NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "auto_renew" integer DEFAULT 0 NOT NULL,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_developer_subscriptions_user" ON "developer_subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_developer_subscriptions_status" ON "developer_subscriptions" ("status");
