-- ============================================================================
-- 0074: 重新启用 0066 租户级 RLS 策略(与 0068 user/role 级 RLS 共存)
--
-- 背景:
--   0072_drop_0066_rls_policies.sql 删除了 0066 引入的 _tenant_iso_* 策略,
--   理由是"两套策略共存时 0066 的 USING 表达式 cast(''::uuid) 与 0068 冲突"。
--   但 0070_rls_safe_tenant_id.sql 已通过 safe_tenant_id() 函数解决了
--   空字符串 cast 抛错的问题,0066 现在可以与 0068 安全共存。
--
--   0066 提供"租户级"隔离(多租户 SaaS),0068 提供"用户级"权限隔离
--   (普通用户看自己,管理员看全部)。两者职责不同,应当共存:
--     - 0066: tenant_id = safe_tenant_id()  ← 多租户边界
--     - 0068: id/role 匹配                  ← 单租户内的权限边界
--
-- 解决冲突:
--   0066 策略用 (safe_tenant_id() IS NULL OR bypass_rls OR tenant_id = safe_tenant_id())
--   0068 策略保持不变
--   两者用 AND 组合(不可见的策略会直接拒绝),用 OR 时 PG 会按"任一允许即允许"
--
--   PostgreSQL RLS 多策略语义:同一表的多策略对 SELECT 是 OR(任一通过即可见)
--   对 INSERT/UPDATE/DELETE 的 WITH CHECK 是 OR(任一通过即可)
--   USING 表达式的多个策略也是 OR(任一通过即可)
--
-- 修复:
--   重新创建 0066 的 _tenant_iso_* 策略(使用 safe_tenant_id())
-- ============================================================================

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
        OR current_setting(''app.current_user_role'', true) IN (''1'', ''2'', ''3'')
      )',
      t || '_tenant_iso_select', t
    );
    -- INSERT WITH CHECK
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR (safe_tenant_id() IS NOT NULL AND tenant_id = safe_tenant_id())
        OR current_setting(''app.current_user_role'', true) IN (''1'', ''2'', ''3'')
      )',
      t || '_tenant_iso_insert', t
    );
    -- UPDATE
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR (safe_tenant_id() IS NOT NULL AND tenant_id = safe_tenant_id())
        OR current_setting(''app.current_user_role'', true) IN (''1'', ''2'', ''3'')
      ) WITH CHECK (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR (safe_tenant_id() IS NOT NULL AND tenant_id = safe_tenant_id())
        OR current_setting(''app.current_user_role'', true) IN (''1'', ''2'', ''3'')
      )',
      t || '_tenant_iso_update', t
    );
    -- DELETE
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (
        current_setting(''app.bypass_rls'', true) = ''true''
        OR (safe_tenant_id() IS NOT NULL AND tenant_id = safe_tenant_id())
        OR current_setting(''app.current_user_role'', true) IN (''1'', ''2'', ''3'')
      )',
      t || '_tenant_iso_delete', t
    );
  END LOOP;
END$$;
