-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 中转站企业合规闭环(2026-09-17 立,补强 61,差异化:竞品为个人订阅分发,此块完全缺)。
-- 四张表:企业认证 / 发票申请(绑已支付订单)/ 企业合同 / 对公打款凭证。
-- 幂等:IF NOT EXISTS。userId 软引用 users.id(不建外键,同 relay_user_attributes 先例)。
-- 金额一律整数分(与 orders.amount 口径一致)。

-- 1. 企业认证:同一用户仅一条认证档案(重复提交覆盖并回到 pending)。
CREATE TABLE IF NOT EXISTS "relay_enterprise_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "company_name" varchar(200) NOT NULL,
  "credit_code" varchar(64) NOT NULL,
  "legal_person" varchar(100),
  "contact_name" varchar(100) NOT NULL,
  "contact_phone" varchar(32) NOT NULL,
  "license_url" varchar(500),
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "reject_reason" varchar(500),
  "reviewed_by" varchar(64),
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "relay_enterprise_profiles_user_uniq_idx" ON "relay_enterprise_profiles" ("user_id");
CREATE INDEX IF NOT EXISTS "relay_enterprise_profiles_status_idx" ON "relay_enterprise_profiles" ("status");

-- 2. 发票申请:必须绑定本人已支付订单;同一订单同时只允许一条非被拒发票。
CREATE TABLE IF NOT EXISTS "relay_invoice_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "order_id" uuid NOT NULL,
  "order_no" varchar(64) NOT NULL,
  "invoice_type" varchar(16) DEFAULT 'plain' NOT NULL,
  "title" varchar(200) NOT NULL,
  "tax_id" varchar(64) NOT NULL,
  "email" varchar(200) NOT NULL,
  "amount_cents" integer DEFAULT 0 NOT NULL,
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "invoice_no" varchar(64),
  "invoice_url" varchar(500),
  "reject_reason" varchar(500),
  "issued_by" varchar(64),
  "issued_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "relay_invoice_requests_order_active_uniq_idx" ON "relay_invoice_requests" ("order_id") WHERE "status" <> 'rejected';
CREATE INDEX IF NOT EXISTS "relay_invoice_requests_user_idx" ON "relay_invoice_requests" ("user_id");
CREATE INDEX IF NOT EXISTS "relay_invoice_requests_status_idx" ON "relay_invoice_requests" ("status");

-- 3. 企业合同:admin 建档 -> 用户确认签署 -> active;合同号唯一。
CREATE TABLE IF NOT EXISTS "relay_contracts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "contract_no" varchar(64) NOT NULL,
  "title" varchar(200) NOT NULL,
  "contract_type" varchar(32) DEFAULT 'api_subscription' NOT NULL,
  "amount_cents" integer DEFAULT 0 NOT NULL,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "file_url" varchar(500),
  "status" varchar(16) DEFAULT 'pending_sign' NOT NULL,
  "signed_at" timestamp with time zone,
  "remark" varchar(500),
  "created_by" varchar(64),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "relay_contracts_no_uniq_idx" ON "relay_contracts" ("contract_no");
CREATE INDEX IF NOT EXISTS "relay_contracts_user_idx" ON "relay_contracts" ("user_id");
CREATE INDEX IF NOT EXISTS "relay_contracts_status_idx" ON "relay_contracts" ("status");

-- 4. 对公打款凭证:用户登记 -> admin 确认(确认即走 completeOrder + activateOrderSubscription 既有闭环)。
CREATE TABLE IF NOT EXISTS "relay_corporate_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "order_id" uuid NOT NULL,
  "order_no" varchar(64) NOT NULL,
  "amount_cents" integer DEFAULT 0 NOT NULL,
  "payer_company" varchar(200) NOT NULL,
  "voucher_url" varchar(500),
  "remark" varchar(500),
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "reject_reason" varchar(500),
  "confirmed_by" varchar(64),
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "relay_corporate_payments_user_idx" ON "relay_corporate_payments" ("user_id");
CREATE INDEX IF NOT EXISTS "relay_corporate_payments_order_idx" ON "relay_corporate_payments" ("order_no");
CREATE INDEX IF NOT EXISTS "relay_corporate_payments_status_idx" ON "relay_corporate_payments" ("status");
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
