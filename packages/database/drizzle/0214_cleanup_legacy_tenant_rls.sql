-- ============================================================================
-- 0214: 清理废弃租户隔离（tenant_id + _tenant_iso 策略）—— 6 表整体
--
-- 背景:
--   schema 中 users/orders/payments/chat_messages/chat_favorites/comment_likes
--   已无 tenant_id 列（多租户隔离设计废弃），但 0066 添加的列与 0074 重建的
--   _tenant_iso_* 策略仍残留于 DB。apps/api 生产代码从不设置 app.tenant_id，
--   safe_tenant_id() 恒返回 NULL，这些策略是功能性死代码。
--
-- 本迁移:
--   1. 删除 6 张表共 24 个 _tenant_iso_* 策略
--   2. 删除 6 张表的 tenant_id 列 + 索引
--   3. 删除 safe_tenant_id() 函数
--   4. 保留 0068 用户级策略（orders_select_own_or_admin 等，基于 current_user_id/role）
--   5. 新增 6 张表 _bypass_rls 策略（FOR ALL），保持 withBypassRls 绕过能力
--      （0068 用户级策略不含 app.bypass_rls 分支，删除 _tenant_iso 后若不补，
--        非超级用户连接将失去 RLS 绕过通道）
-- ============================================================================

-- 1. 删除 6 张表的 _tenant_iso_* 策略（24 个）
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
END$$;--> statement-breakpoint

-- 2. 删除 6 张表的 tenant_id 索引 + 列（DROP COLUMN 级联删索引，显式 DROP 保证幂等）
DROP INDEX IF EXISTS "users_tenant_id_idx";
DROP INDEX IF EXISTS "orders_tenant_id_idx";
DROP INDEX IF EXISTS "payments_tenant_id_idx";
DROP INDEX IF EXISTS "chat_messages_tenant_id_idx";
DROP INDEX IF EXISTS "chat_favorites_tenant_id_idx";
DROP INDEX IF EXISTS "comment_likes_tenant_id_idx";--> statement-breakpoint

ALTER TABLE "users" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "chat_messages" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "chat_favorites" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "comment_likes" DROP COLUMN IF EXISTS "tenant_id";--> statement-breakpoint

-- 3. 删除 safe_tenant_id() 函数（须在策略删除之后）
DROP FUNCTION IF EXISTS safe_tenant_id();--> statement-breakpoint

-- 4. 新增 _bypass_rls 策略（FOR ALL，保持 withBypassRls 绕过能力）
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['users', 'orders', 'payments', 'chat_messages', 'chat_favorites', 'comment_likes'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (current_setting(''app.bypass_rls'', true) = ''true'') WITH CHECK (current_setting(''app.bypass_rls'', true) = ''true'')',
      t || '_bypass_rls', t
    );
  END LOOP;
END$$;
