-- Wave 17: Order module (edu_platform 订单/支付/退款/发票)

CREATE TABLE IF NOT EXISTS "edu_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_no" varchar(64) NOT NULL UNIQUE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "order_type" varchar(32) NOT NULL,
  "target_id" varchar(64),
  "target_title" varchar(200),
  "quantity" integer DEFAULT 1 NOT NULL,
  "original_price" numeric(10,2) DEFAULT '0' NOT NULL,
  "discount_amount" numeric(10,2) DEFAULT '0' NOT NULL,
  "pay_amount" numeric(10,2) DEFAULT '0' NOT NULL,
  "pay_type" varchar(50),
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "pay_time" timestamptz,
  "cancel_time" timestamptz,
  "refund_time" timestamptz,
  "remark" varchar(500),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_orders_user_idx" ON "edu_orders"("user_id");
CREATE INDEX IF NOT EXISTS "edu_orders_status_idx" ON "edu_orders"("status");
CREATE INDEX IF NOT EXISTS "edu_orders_type_idx" ON "edu_orders"("order_type");

CREATE TABLE IF NOT EXISTS "edu_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_no" varchar(64) NOT NULL UNIQUE,
  "order_id" uuid NOT NULL REFERENCES "edu_orders"("id") ON DELETE CASCADE,
  "order_type" varchar(32) NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "pay_type" varchar(50) NOT NULL,
  "pay_amount" numeric(10,2) DEFAULT '0' NOT NULL,
  "pay_url" varchar(500),
  "status" varchar(16) DEFAULT 'created' NOT NULL,
  "pay_time" timestamptz,
  "third_party_no" varchar(128),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_payments_user_idx" ON "edu_payments"("user_id");
CREATE INDEX IF NOT EXISTS "edu_payments_order_idx" ON "edu_payments"("order_id");

CREATE TABLE IF NOT EXISTS "edu_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "edu_orders"("id") ON DELETE CASCADE,
  "order_type" varchar(32) NOT NULL,
  "order_no" varchar(64) NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reason" varchar(500),
  "refund_amount" numeric(10,2) DEFAULT '0' NOT NULL,
  "refund_type" varchar(32) DEFAULT 'original' NOT NULL,
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "apply_time" timestamptz,
  "process_time" timestamptz,
  "complete_time" timestamptz,
  "process_message" varchar(500),
  "handle_message" varchar(500),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_refunds_user_idx" ON "edu_refunds"("user_id");
CREATE INDEX IF NOT EXISTS "edu_refunds_order_idx" ON "edu_refunds"("order_id");

CREATE TABLE IF NOT EXISTS "edu_invoice_titles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title_type" varchar(16) DEFAULT 'personal' NOT NULL,
  "title" varchar(200) NOT NULL,
  "tax_no" varchar(50),
  "bank" varchar(200),
  "bank_account" varchar(50),
  "address" varchar(500),
  "phone" varchar(20),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_invoice_titles_user_idx" ON "edu_invoice_titles"("user_id");

CREATE TABLE IF NOT EXISTS "edu_invoice_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid REFERENCES "edu_orders"("id") ON DELETE SET NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "invoice_type" varchar(16) DEFAULT 'normal' NOT NULL,
  "title_id" uuid REFERENCES "edu_invoice_titles"("id") ON DELETE SET NULL,
  "amount" numeric(10,2) DEFAULT '0' NOT NULL,
  "email" varchar(100),
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "remark" varchar(500),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "edu_invoice_applications_user_idx" ON "edu_invoice_applications"("user_id");
CREATE INDEX IF NOT EXISTS "edu_invoice_applications_status_idx" ON "edu_invoice_applications"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "edu_invoice_applications_order_unique" ON "edu_invoice_applications"("order_id");
