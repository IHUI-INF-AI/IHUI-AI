-- ============================================================================
-- 0070: 修复 RLS 策略的 bypass 短路 bug
--
-- 背景:
--   0066_rls_tenant_isolation.sql 的策略表达式为:
--     current_setting('app.bypass_rls', true) = 'true'
--     OR tenant_id = current_setting('app.tenant_id', true)::uuid
--
--   PostgreSQL OR 表达式对两侧都会求值(不短路),即使左侧 bypass=true,
--   仍会执行右侧的 uuid 转换。当 app.tenant_id 未设置时,current_setting
--   返回空字符串 '',空字符串转 uuid 抛 "无效的类型 uuid 输入语法: ''"。
--
-- 解决方案:
--   创建一个 PL/pgSQL 函数 safe_tenant_id() 返回 NULL-safe 的 tenant_id,
--   当 app.tenant_id 未设置或为空时返回 NULL,避免 uuid 转换错误。
--   策略改为:
--     current_setting('app.bypass_rls', true) = 'true'
--     OR (safe_tenant_id() IS NOT NULL AND tenant_id = safe_tenant_id())
-- ============================================================================

-- 1) 安全 tenant_id 函数(避免空字符串转 uuid 抛错)
CREATE OR REPLACE FUNCTION "safe_tenant_id"()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_setting text;
BEGIN
  v_setting := current_setting('app.tenant_id', true);
  IF v_setting IS NULL OR v_setting = '' THEN
    RETURN NULL;
  END IF;
  RETURN v_setting::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- 2) 删除旧策略
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['users', 'orders', 'payments', 'chat_messages', 'chat_favorites', 'comment_likes'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_iso_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_iso_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_iso_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_iso_delete', t);
  END LOOP;
END$$;

-- 3) 重建策略(使用 safe_tenant_id() 函数)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['users', 'orders', 'payments', 'chat_messages', 'chat_favorites', 'comment_likes'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- SELECT
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT USING (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR (safe_tenant_id() IS NOT NULL AND tenant_id = safe_tenant_id())
      )',
      t || '_tenant_iso_select', t
    );
    -- INSERT
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR (safe_tenant_id() IS NOT NULL AND tenant_id = safe_tenant_id())
      )',
      t || '_tenant_iso_insert', t
    );
    -- UPDATE
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR (safe_tenant_id() IS NOT NULL AND tenant_id = safe_tenant_id())
      ) WITH CHECK (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR (safe_tenant_id() IS NOT NULL AND tenant_id = safe_tenant_id())
      )',
      t || '_tenant_iso_update', t
    );
    -- DELETE
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR (safe_tenant_id() IS NOT NULL AND tenant_id = safe_tenant_id())
      )',
      t || '_tenant_iso_delete', t
    );
  END LOOP;
END$$;
