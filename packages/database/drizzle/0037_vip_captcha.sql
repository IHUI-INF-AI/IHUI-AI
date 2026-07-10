-- 0037: VIP membership + Captcha module

-- VIP 等级表
CREATE TABLE IF NOT EXISTS "vip_levels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "level_name" varchar(100) NOT NULL,
  "level_value" integer DEFAULT 0 NOT NULL,
  "price" integer DEFAULT 0 NOT NULL,
  "duration_days" integer DEFAULT 30 NOT NULL,
  "benefits" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" integer DEFAULT 1 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "vip_levels_status_idx" ON "vip_levels" ("status");

-- 用户 VIP 订阅记录表
CREATE TABLE IF NOT EXISTS "user_vips" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "vip_level_id" uuid,
  "level_value" integer DEFAULT 0 NOT NULL,
  "start_time" timestamptz NOT NULL,
  "end_time" timestamptz NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "order_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE "user_vips" DROP CONSTRAINT IF EXISTS "user_vips_user_id_users_id_fk";
ALTER TABLE "user_vips" ADD CONSTRAINT "user_vips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "user_vips" DROP CONSTRAINT IF EXISTS "user_vips_vip_level_id_vip_levels_id_fk";
ALTER TABLE "user_vips" ADD CONSTRAINT "user_vips_vip_level_id_vip_levels_id_fk" FOREIGN KEY ("vip_level_id") REFERENCES "vip_levels"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "user_vips" DROP CONSTRAINT IF EXISTS "user_vips_order_id_orders_id_fk";
ALTER TABLE "user_vips" ADD CONSTRAINT "user_vips_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX IF NOT EXISTS "user_vips_user_idx" ON "user_vips" ("user_id");
CREATE INDEX IF NOT EXISTS "user_vips_status_idx" ON "user_vips" ("status");

-- 图形验证码表（Redis 为主，此表为 fallback）
CREATE TABLE IF NOT EXISTS "captchas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "captcha_key" varchar(64) NOT NULL,
  "code" varchar(8) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "captchas_key_idx" ON "captchas" ("captcha_key");

-- 初始化默认 VIP 等级
INSERT INTO "vip_levels" ("level_name", "level_value", "price", "duration_days", "benefits", "status", "sort_order")
VALUES
  ('月度会员', 1, 3990, 30, '["unlimitedChat","exclusiveModel","prioritySupport"]'::jsonb, 1, 1),
  ('年度会员', 1, 29900, 365, '["unlimitedChat","exclusiveModel","prioritySupport","referral"]'::jsonb, 1, 2),
  ('永久会员', 1, 99000, 36500, '["unlimitedChat","exclusiveModel","prioritySupport","referral","lifetime"]'::jsonb, 1, 3),
  ('操盘手', 2, 32400, 30, '["distributionQualification","aiCourses","founderQa","agentBeta","vipMaxDiscount","customAgentDiscount","allVipRights","verticalAccountIncubation","secondaryDistribution","offlineLearning"]'::jsonb, 1, 4)
ON CONFLICT DO NOTHING;
