-- 0040: orders 表增加 order_type / product_id 列，统一佣金订单类型映射
-- order_type: 1=membership 2=token 3=activity 4=identity（0=未分类）

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_type" integer NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "product_id" varchar(64);

CREATE INDEX IF NOT EXISTS "idx_orders_order_type" ON "orders" ("order_type");
