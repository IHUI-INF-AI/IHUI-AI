-- 给 developer_api_keys 表添加 tenant_id 字段,支持多租户 API Key 关联
-- 触发:对标 New API 多租户能力,API Key 可关联到 organization/tenant,实现组织级配额池
-- 幂等:全部使用 IF NOT EXISTS / DO $$ EXCEPTION 兜底,可重复执行
-- 关联:tenants 表(若存在)ON DELETE SET NULL,已有 Key 不强制关联(nullable 向后兼容)

-- 1. 添加字段(nullable,向后兼容,已有 Key 不关联 tenant)
ALTER TABLE "developer_api_keys"
  ADD COLUMN IF NOT EXISTS "tenant_id" uuid;

-- 2. 添加外键(关联 tenants 表,如不存在则跳过;已存在则跳过)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'tenants'
  ) THEN
    ALTER TABLE "developer_api_keys"
      ADD CONSTRAINT "developer_api_keys_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- 外键已存在,跳过
  NULL;
END $$;

-- 3. 添加索引(按 tenant 查询 API Key,部分索引仅覆盖有关联的行)
CREATE INDEX IF NOT EXISTS "developer_api_keys_tenant_id_idx"
  ON "developer_api_keys" ("tenant_id")
  WHERE "tenant_id" IS NOT NULL;

-- 4. 注释
COMMENT ON COLUMN "developer_api_keys"."tenant_id" IS '关联的租户 ID(nullable,不关联则为个人 Key)';
