-- Phase 2: 退款/发票 FK 迁移 — edu_refunds & edu_invoice_applications 的 FK 从 edu_orders 迁移到 orders
-- edu_refunds.order_type: varchar(32) → integer（course→7, card→8, 数字字符串保持原值）

-- 1. edu_refunds: 删除旧 FK（→ edu_orders），改为新 FK（→ orders）
ALTER TABLE "edu_refunds" DROP CONSTRAINT IF EXISTS "edu_refunds_order_id_edu_orders_id_fk";--> statement-breakpoint

-- 2. edu_refunds.order_type: varchar(32) → integer（USING 子句转换存量数据）
ALTER TABLE "edu_refunds" ALTER COLUMN "order_type" SET DATA TYPE integer USING
  CASE "order_type"
    WHEN 'course' THEN 7
    WHEN 'card' THEN 8
    ELSE COALESCE(CAST("order_type" AS integer), 0)
  END;--> statement-breakpoint
ALTER TABLE "edu_refunds" ALTER COLUMN "order_type" SET DEFAULT 0;--> statement-breakpoint

-- 3. edu_refunds: 添加新 FK（→ orders, ON DELETE cascade）
ALTER TABLE "edu_refunds" ADD CONSTRAINT "edu_refunds_order_id_orders_id_fk"
  FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- 4. edu_invoice_applications: 删除旧 FK（→ edu_orders），改为新 FK（→ orders）
ALTER TABLE "edu_invoice_applications" DROP CONSTRAINT IF EXISTS "edu_invoice_applications_order_id_edu_orders_id_fk";--> statement-breakpoint

ALTER TABLE "edu_invoice_applications" ADD CONSTRAINT "edu_invoice_applications_order_id_orders_id_fk"
  FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
