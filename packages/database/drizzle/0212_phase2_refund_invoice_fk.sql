-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Phase 2: 退款/发票 FK 迁移 — edu_refunds & edu_invoice_applications 的 FK 从 edu_orders 迁移到 orders
-- edu_refunds.order_type: varchar(32) → integer（course→7, card→8, 数字字符串保持原值）

-- 1. edu_refunds: 删除旧 FK（→ edu_orders），改为新 FK（→ orders）
ALTER TABLE "edu_refunds" DROP CONSTRAINT IF EXISTS "edu_refunds_order_id_edu_orders_id_fk";--> statement-breakpoint

-- 2. edu_refunds.order_type: varchar(32) → integer（USING 子句转换存量数据）
-- 自适应:仅当列仍为字符类型时执行转换(integer 列重复执行会 42883 CASE 类型错误)
DO $ot_conv$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'edu_refunds' AND column_name = 'order_type'
      AND data_type IN ('character varying', 'character', 'text')
  ) THEN
    ALTER TABLE "edu_refunds" ALTER COLUMN "order_type" SET DATA TYPE integer USING
      -- 必须用 searched CASE(CASE WHEN 条件):简单 CASE(CASE 列 WHEN 表达式)会把
      -- `列 ~ 正则` 改写成 `列 = (boolean)`,规划期即 42883
      -- "operator does not exist: character varying = boolean",整条迁移链中断。
      -- 只有纯数字串能安全转 integer;空串/非数字枚举(gift、recharge 等)会让
      -- CAST 直接抛 22P02,COALESCE 捕获不到异常,故先用正则判形再转换。
      CASE
        WHEN "order_type" = 'course' THEN 7
        WHEN "order_type" = 'card' THEN 8
        WHEN "order_type" ~ '^[0-9]+$' THEN "order_type"::integer
        ELSE 0
      END;
  END IF;
END $ot_conv$;--> statement-breakpoint
ALTER TABLE "edu_refunds" ALTER COLUMN "order_type" SET DEFAULT 0;--> statement-breakpoint

-- 3. edu_refunds: 添加新 FK（→ orders, ON DELETE cascade）
ALTER TABLE "edu_refunds" ADD CONSTRAINT "edu_refunds_order_id_orders_id_fk"
  FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- 4. edu_invoice_applications: 删除旧 FK（→ edu_orders），改为新 FK（→ orders）
ALTER TABLE "edu_invoice_applications" DROP CONSTRAINT IF EXISTS "edu_invoice_applications_order_id_edu_orders_id_fk";--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'edu_invoice_applications_order_id_orders_id_fk') THEN
    ALTER TABLE "edu_invoice_applications" ADD CONSTRAINT "edu_invoice_applications_order_id_orders_id_fk"
      FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
