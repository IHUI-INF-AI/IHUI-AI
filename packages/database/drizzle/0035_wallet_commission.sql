-- 0035: Wallet + Commission + Distribution module
-- 用户 Token 钱包余额表
CREATE TABLE IF NOT EXISTS "user_margins" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "token_quantity" integer DEFAULT 0 NOT NULL,
  "frozen_quantity" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE "user_margins" DROP CONSTRAINT IF EXISTS "user_margins_user_id_users_id_fk";
ALTER TABLE "user_margins" ADD CONSTRAINT "user_margins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Token 流水表
CREATE TABLE IF NOT EXISTS "token_flows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "op_type" integer NOT NULL,
  "quantity" integer NOT NULL,
  "balance_after" integer DEFAULT 0 NOT NULL,
  "remark" varchar(255),
  "operator_id" uuid,
  "related_order_no" varchar(64),
  "created_at" timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE "token_flows" DROP CONSTRAINT IF EXISTS "token_flows_user_id_users_id_fk";
ALTER TABLE "token_flows" ADD CONSTRAINT "token_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX IF NOT EXISTS "token_flows_user_idx" ON "token_flows" ("user_id");

-- 佣金流水表（语义澄清：beneficiary_id=获佣人，invited_user_id=下单人）
CREATE TABLE IF NOT EXISTS "commission_flows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "beneficiary_id" uuid NOT NULL,
  "invited_user_id" uuid,
  "order_id" uuid,
  "amount" integer DEFAULT 0 NOT NULL,
  "token" integer DEFAULT 0 NOT NULL,
  "type" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "remark" varchar(255),
  "created_at" timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE "commission_flows" DROP CONSTRAINT IF EXISTS "commission_flows_beneficiary_id_users_id_fk";
ALTER TABLE "commission_flows" ADD CONSTRAINT "commission_flows_beneficiary_id_users_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "commission_flows" DROP CONSTRAINT IF EXISTS "commission_flows_invited_user_id_users_id_fk";
ALTER TABLE "commission_flows" ADD CONSTRAINT "commission_flows_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "commission_flows" DROP CONSTRAINT IF EXISTS "commission_flows_order_id_orders_id_fk";
ALTER TABLE "commission_flows" ADD CONSTRAINT "commission_flows_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX IF NOT EXISTS "commission_flows_beneficiary_idx" ON "commission_flows" ("beneficiary_id");
CREATE INDEX IF NOT EXISTS "commission_flows_invited_idx" ON "commission_flows" ("invited_user_id");
CREATE INDEX IF NOT EXISTS "commission_flows_status_idx" ON "commission_flows" ("status");

-- 提现流水表
CREATE TABLE IF NOT EXISTS "withdrawal_flows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "amount" integer NOT NULL,
  "fee" integer DEFAULT 0 NOT NULL,
  "original_amount" integer NOT NULL,
  "status" integer DEFAULT 0 NOT NULL,
  "method" varchar(16) NOT NULL,
  "account_info" jsonb,
  "partner_trade_no" varchar(64),
  "payment_no" varchar(64),
  "reject_reason" varchar(500),
  "processed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE "withdrawal_flows" DROP CONSTRAINT IF EXISTS "withdrawal_flows_user_id_users_id_fk";
ALTER TABLE "withdrawal_flows" ADD CONSTRAINT "withdrawal_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX IF NOT EXISTS "withdrawal_flows_user_idx" ON "withdrawal_flows" ("user_id");
CREATE INDEX IF NOT EXISTS "withdrawal_flows_status_idx" ON "withdrawal_flows" ("status");

-- 分销比例配置表
CREATE TABLE IF NOT EXISTS "identity_proportions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "begin_time" timestamptz,
  "end_time" timestamptz,
  "status" integer DEFAULT 0 NOT NULL,
  "gift" integer DEFAULT 0 NOT NULL,
  "token_proportion" integer DEFAULT 0 NOT NULL,
  "vip_gift" integer DEFAULT 0 NOT NULL,
  "routine_proportion" integer DEFAULT 0 NOT NULL,
  "vip_proportion" integer DEFAULT 0 NOT NULL,
  "trader_proportion" integer DEFAULT 0 NOT NULL,
  "trader_gift" integer DEFAULT 0 NOT NULL,
  "trader_routine_proportion" integer DEFAULT 0 NOT NULL,
  "trader_vip_proportion" integer DEFAULT 0 NOT NULL,
  "trader_trader_proportion" integer DEFAULT 0 NOT NULL,
  "grand_routine_proportion" integer DEFAULT 0 NOT NULL,
  "grand_vip_proportion" integer DEFAULT 0 NOT NULL,
  "grand_trader_proportion" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- 扩展 users 表：分销关系链 + 会员状态 + 用户名登录
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" varchar(64);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birthday" date;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_vip" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_code" varchar(32);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parent_id" uuid;

-- 放宽 phone 长度（旧架构 20，原 schema 11）
ALTER TABLE "users" ALTER COLUMN "phone" TYPE varchar(20);

CREATE UNIQUE INDEX IF NOT EXISTS "users_invite_code_unique" ON "users" ("invite_code") WHERE "invite_code" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username") WHERE "username" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "users_parent_id_idx" ON "users" ("parent_id");
