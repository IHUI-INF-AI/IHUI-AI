-- 启用行级安全(RLS) - 6 个用户/业务核心表
-- 目标表:users / orders / payments / chat_messages / chat_favorites / comment_likes
-- 设计:
--   1. 每个表加 tenant_id 列(uuid,默认全零 UUID = 默认租户)
--   2. 启用 RLS,默认拒绝所有访问
--   3. 策略:USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
--      - current_setting 第二参数 true 表示缺失时返回 NULL(不抛错)
--      - 后端服务必须在每次事务开头执行 SET LOCAL app.tenant_id = '<uuid>'
--      - 迁移脚本(SEED)使用 BYPASSRLS 角色或 SET LOCAL app.bypass_rls = 'true' 绕过
--   4. 后续 RLS 严格化:multi-tenant 模式下必须每个请求设置 tenant_id
-- 幂等可重复执行

-- 1) 添加 tenant_id 列 + 索引
DO $$
BEGIN
  -- users
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
    CREATE INDEX "users_tenant_id_idx" ON "users" ("tenant_id");
  END IF;

  -- orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE "orders" ADD COLUMN "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
    CREATE INDEX "orders_tenant_id_idx" ON "orders" ("tenant_id");
  END IF;

  -- payments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE "payments" ADD COLUMN "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
    CREATE INDEX "payments_tenant_id_idx" ON "payments" ("tenant_id");
  END IF;

  -- chat_messages
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE "chat_messages" ADD COLUMN "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
    CREATE INDEX "chat_messages_tenant_id_idx" ON "chat_messages" ("tenant_id");
  END IF;

  -- chat_favorites
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_favorites' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE "chat_favorites" ADD COLUMN "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
    CREATE INDEX "chat_favorites_tenant_id_idx" ON "chat_favorites" ("tenant_id");
  END IF;

  -- comment_likes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comment_likes' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE "comment_likes" ADD COLUMN "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
    CREATE INDEX "comment_likes_tenant_id_idx" ON "comment_likes" ("tenant_id");
  END IF;
END$$;

-- 2) 启用 RLS(对所有角色生效,包括表 owner)
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_favorites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comment_likes" ENABLE ROW LEVEL SECURITY;

-- 3) 强制 RLS(对表 owner 也强制;否则 owner 角色仍可绕过)
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;
ALTER TABLE "chat_favorites" FORCE ROW LEVEL SECURITY;
ALTER TABLE "comment_likes" FORCE ROW LEVEL SECURITY;

-- 4) 创建策略:每表 4 个(SELECT/INSERT/UPDATE/DELETE)
-- 策略表达式:USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
--  - WHEN app.bypass_rls = 'true' 时全部放行(用于迁移/系统任务)
--  - WHEN app.tenant_id 未设置(返回 NULL)时 = 拒绝(因为 NULL != uuid)

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['users', 'orders', 'payments', 'chat_messages', 'chat_favorites', 'comment_likes'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- SELECT
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_iso_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR tenant_id = current_setting(''app.tenant_id'', true)::uuid
      )',
      t || '_tenant_iso_select', t
    );
    -- INSERT
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_iso_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR tenant_id = current_setting(''app.tenant_id'', true)::uuid
      )',
      t || '_tenant_iso_insert', t
    );
    -- UPDATE
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_iso_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR tenant_id = current_setting(''app.tenant_id'', true)::uuid
      ) WITH CHECK (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR tenant_id = current_setting(''app.tenant_id'', true)::uuid
      )',
      t || '_tenant_iso_update', t
    );
    -- DELETE
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_iso_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR tenant_id = current_setting(''app.tenant_id'', true)::uuid
      )',
      t || '_tenant_iso_delete', t
    );
  END LOOP;
END$$;

-- 5) 后端使用说明:
--  - 业务事务开头(每个请求):
--      SET LOCAL app.tenant_id = '<从 JWT 解析的租户 UUID>';
--  - 系统/迁移任务:
--      SET LOCAL app.bypass_rls = 'true';
--  - 默认租户 UUID(单租户模式):00000000-0000-0000-0000-000000000000
