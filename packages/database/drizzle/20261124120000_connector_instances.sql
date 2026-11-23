-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 连接器实例(2026-11-24)
--
-- 迁移自 ai-service 的 JSON 单文件 data/connector_store.json;按租户 + 属主双轴隔离。
-- app_secret 在应用层以 enc:v1 AES-256-GCM 密文写入,本表不存明文。
--
-- 唯一键选型(PG 中 NULL 不参与普通唯一索引):
--   1) 普通唯一索引 (tenant_id, owner_user_id, key):个人作用域行同租户同属主同 key 唯一;
--      owner_user_id IS NULL 的租户共享行不参与该索引(NULL 互不相等)。
--   2) 部分唯一索引 (tenant_id, key) WHERE owner_user_id IS NULL:同租户同 key 只能有
--      一条共享记录。
-- 选型理由:若改用生成列 COALESCE(owner_user_id, '') 并入普通唯一索引,共享行的空串会
-- 把"无属主"与"个人属主空串"两种语义混进同一键族;部分唯一索引语义更直白,且不改变
-- 列可空性。

CREATE TABLE IF NOT EXISTS "connector_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "owner_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "key" text NOT NULL,
  "conn_type" varchar(32) NOT NULL,
  "name" text DEFAULT '' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "app_id" varchar(255) DEFAULT '' NOT NULL,
  "app_secret" text DEFAULT '' NOT NULL,
  "extra" jsonb DEFAULT '{}' NOT NULL,
  "mode" varchar(16) DEFAULT 'preset' NOT NULL,
  "spec" jsonb DEFAULT '{}' NOT NULL,
  "operations" jsonb DEFAULT '[]' NOT NULL,
  "managed" boolean DEFAULT false NOT NULL,
  "credential_source" text DEFAULT '' NOT NULL,
  "installed_at" text DEFAULT '' NOT NULL,
  "last_sync_at" text DEFAULT '' NOT NULL,
  "last_error" text DEFAULT '' NOT NULL,
  "sync_items" jsonb DEFAULT '[]' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 个人作用域行唯一;共享行(owner_user_id IS NULL)不参与本索引
CREATE UNIQUE INDEX IF NOT EXISTS "connector_instances_owner_key_uidx"
  ON "connector_instances" ("tenant_id", "owner_user_id", "key");

-- 租户共享行唯一:同租户同 key 仅一条共享记录
CREATE UNIQUE INDEX IF NOT EXISTS "connector_instances_tenant_key_shared_uidx"
  ON "connector_instances" ("tenant_id", "key")
  WHERE "owner_user_id" IS NULL;

CREATE INDEX IF NOT EXISTS "connector_instances_tenant_owner_idx"
  ON "connector_instances" ("tenant_id", "owner_user_id");

COMMENT ON TABLE "connector_instances" IS '连接器实例;按租户+属主隔离;app_secret 为 enc:v1 密文';
COMMENT ON COLUMN "connector_instances"."owner_user_id" IS 'NULL=租户共享;非 NULL=个人作用域属主';
COMMENT ON COLUMN "connector_instances"."conn_type" IS 'yuque | feishu | wecom | dingtalk | wechat_mp | custom';
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
