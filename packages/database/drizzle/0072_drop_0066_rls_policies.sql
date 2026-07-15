-- ============================================================================
-- 0072: 清理 0066 旧 RLS 策略(由 0068 完整替代)
--
-- 背景:
--   0066_rls_tenant_isolation.sql 引入了基于 app.tenant_id 的 RLS 策略。
--   0068_rls_policies.sql 引入了基于 app.current_user_id + app.current_user_role
--   的更精细 RLS 策略(支持管理员/普通用户区分 + 间接关联表过滤)。
--   两套策略共存时,0066 的 USING 表达式 cast(''::uuid) 会与 0068 冲突
--   且 test 4 期望的"硬拒绝"行为被 0068 的"软拒绝(0 行)"覆盖,导致测试失败。
--
-- 解决方案:
--   1. 保留 0068 策略(更精细、更现代)
--   2. 删除 0066 留下的旧 _tenant_iso_* 策略
--   3. 保留 tenant_id 列(数据兼容,前端仍可读,但不再用于 RLS 强制)
--   4. 保留 FORCE ROW LEVEL SECURITY(若开启)
--
-- 幂等可重复执行
-- ============================================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['users', 'orders', 'payments', 'chat_messages', 'chat_favorites', 'comment_likes'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- 删除 0066 的 4 类策略
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_iso_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_iso_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_iso_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_iso_delete', t);
  END LOOP;
END$$;
