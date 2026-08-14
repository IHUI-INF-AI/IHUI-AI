-- Phase 5: 存量订单双向补全（幂等 backfill）
-- 目标：双写策略上线前的存量数据对齐 —— orders 与 edu_orders 互为镜像。
-- 方向 1: edu_orders → orders（元→分 / orderType 字符串→整数 / pay_time→paid_at）
-- 方向 2: orders → edu_orders（分→元 / orderType 整数→字符串 / paid_at→pay_time）
-- 全部使用 ON CONFLICT (id) DO NOTHING，可安全重复执行；每批语句后可重复运行。

-- 1. edu_orders → orders（补写教育订单到统一订单表）
INSERT INTO "orders" (
  "id", "order_no", "user_id", "amount", "currency", "status",
  "payment_method", "order_type", "target_id", "target_title",
  "quantity", "original_price", "discount_amount",
  "paid_at", "cancel_time", "refund_time", "remark",
  "created_at", "updated_at"
)
SELECT
  "id",
  "order_no",
  "user_id",
  ROUND("pay_amount"::numeric * 100)::integer,
  'CNY',
  "status",
  "pay_type",
  CASE "order_type"
    WHEN 'course' THEN 7
    WHEN 'card' THEN 8
    ELSE COALESCE(CAST("order_type" AS integer), 0)
  END,
  "target_id",
  "target_title",
  "quantity",
  ROUND(COALESCE("original_price", '0')::numeric * 100)::integer,
  ROUND(COALESCE("discount_amount", '0')::numeric * 100)::integer,
  "pay_time",
  "cancel_time",
  "refund_time",
  "remark",
  "created_at",
  "updated_at"
FROM "edu_orders"
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

-- 2. orders → edu_orders（补写统一订单到教育订单表；user_id 为空的行无法写入 NOT NULL 约束，跳过）
INSERT INTO "edu_orders" (
  "id", "order_no", "user_id", "order_type",
  "target_id", "target_title", "quantity",
  "original_price", "discount_amount", "pay_amount",
  "pay_type", "status", "pay_time", "cancel_time", "refund_time",
  "remark", "created_at", "updated_at"
)
SELECT
  "id",
  "order_no",
  "user_id",
  CASE "order_type"
    WHEN 7 THEN 'course'
    WHEN 8 THEN 'card'
    ELSE "order_type"::text
  END,
  COALESCE("target_id", "product_id"),
  "target_title",
  "quantity",
  (COALESCE("original_price", 0) / 100.0)::numeric(10,2),
  (COALESCE("discount_amount", 0) / 100.0)::numeric(10,2),
  ("amount" / 100.0)::numeric(10,2),
  "payment_method",
  "status",
  "paid_at",
  "cancel_time",
  "refund_time",
  "remark",
  "created_at",
  "updated_at"
FROM "orders"
WHERE "user_id" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
