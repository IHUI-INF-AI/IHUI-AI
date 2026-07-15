-- ============================================================================
-- 0068 RLS 行级安全 — 6 个核心表(users/orders/payments/chatMessages/
-- chatFavorites/commentLikes)
--
-- 设计原则:
-- 1. 渐进式启用 — 不破坏现有功能(应用当前以 postgres 超级用户连接,RLS
--    默认不作用于超级用户,仅当未来切换到 app_user 非超级用户角色时自动生效)
-- 2. 策略完整 — 为每个表创建 SELECT/INSERT/UPDATE/DELETE 4 类策略
-- 3. 双维度过滤 — 普通用户只能访问自己的数据;管理员(role_id >= 1)可访问全部
-- 4. 会话变量 — 通过 current_setting('app.current_user_id') 传递当前用户,
--    通过 current_setting('app.current_user_role') 传递角色
-- 5. 部署路径 — 下游部署时改用 app_user 角色连接,RLS 自动生效
--
-- 应用 RLS 启用步骤(部署侧):
--   1. CREATE ROLE app_user WITH LOGIN PASSWORD '...'
--   2. GRANT USAGE ON SCHEMA public TO app_user
--   3. GRANT SELECT/INSERT/UPDATE/DELETE ON <table> TO app_user
--   4. 不授予 BYPASSRLS
--   5. 切换 DATABASE_URL 到 app_user
-- ============================================================================

-- ============================================================================
-- 1) users 表 RLS
-- ============================================================================

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_or_admin" ON "users";
DROP POLICY IF EXISTS "users_insert_self_or_admin" ON "users";
DROP POLICY IF EXISTS "users_update_own_or_admin" ON "users";
DROP POLICY IF EXISTS "users_delete_admin" ON "users";

-- SELECT: 普通用户可读自己的;管理员(role_id>=1)可读全部
CREATE POLICY "users_select_own_or_admin" ON "users"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR id::text = current_setting('app.current_user_id', true)
  );

-- INSERT: 注册场景,任何已认证用户可创建自己的账号
CREATE POLICY "users_insert_self_or_admin" ON "users"
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR id::text = current_setting('app.current_user_id', true)
  );

-- UPDATE: 普通用户可改自己的;管理员可改全部(系统管理员 is_system_admin=true 仍受 DB 触发器保护)
CREATE POLICY "users_update_own_or_admin" ON "users"
  FOR UPDATE
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR id::text = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR id::text = current_setting('app.current_user_id', true)
  );

-- DELETE: 仅管理员可删(系统管理员 is_system_admin=true 仍受 DB 触发器保护)
CREATE POLICY "users_delete_admin" ON "users"
  FOR DELETE
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
  );

-- ============================================================================
-- 2) orders 表 RLS
-- ============================================================================

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own_or_admin" ON "orders";
DROP POLICY IF EXISTS "orders_insert_self_or_admin" ON "orders";
DROP POLICY IF EXISTS "orders_update_admin" ON "orders";
DROP POLICY IF EXISTS "orders_delete_admin" ON "orders";

CREATE POLICY "orders_select_own_or_admin" ON "orders"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR "user_id"::text = current_setting('app.current_user_id', true)
  );

CREATE POLICY "orders_insert_self_or_admin" ON "orders"
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR "user_id"::text = current_setting('app.current_user_id', true)
  );

CREATE POLICY "orders_update_admin" ON "orders"
  FOR UPDATE
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
  );

CREATE POLICY "orders_delete_admin" ON "orders"
  FOR DELETE
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
  );

-- ============================================================================
-- 3) payments 表 RLS(通过 order_id → orders.user_id 间接过滤)
-- ============================================================================

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_via_order" ON "payments";
DROP POLICY IF EXISTS "payments_insert_via_order" ON "payments";
DROP POLICY IF EXISTS "payments_update_admin" ON "payments";
DROP POLICY IF EXISTS "payments_delete_admin" ON "payments";

CREATE POLICY "payments_select_via_order" ON "payments"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = payments.order_id
        AND o.user_id::text = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "payments_insert_via_order" ON "payments"
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = payments.order_id
        AND o.user_id::text = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "payments_update_admin" ON "payments"
  FOR UPDATE
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
  );

CREATE POLICY "payments_delete_admin" ON "payments"
  FOR DELETE
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
  );

-- ============================================================================
-- 4) chat_messages 表 RLS(通过 conversation_id → chat_conversations.user_id)
-- ============================================================================

ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages_select_via_conversation" ON "chat_messages";
DROP POLICY IF EXISTS "chat_messages_insert_via_conversation" ON "chat_messages";
DROP POLICY IF EXISTS "chat_messages_update_via_conversation" ON "chat_messages";
DROP POLICY IF EXISTS "chat_messages_delete_via_conversation" ON "chat_messages";

CREATE POLICY "chat_messages_select_via_conversation" ON "chat_messages"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.user_id::text = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "chat_messages_insert_via_conversation" ON "chat_messages"
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.user_id::text = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "chat_messages_update_via_conversation" ON "chat_messages"
  FOR UPDATE
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.user_id::text = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "chat_messages_delete_via_conversation" ON "chat_messages"
  FOR DELETE
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.user_id::text = current_setting('app.current_user_id', true)
    )
  );

-- ============================================================================
-- 5) chat_favorites 表 RLS
-- ============================================================================

ALTER TABLE "chat_favorites" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_favorites_select_own_or_admin" ON "chat_favorites";
DROP POLICY IF EXISTS "chat_favorites_insert_self_or_admin" ON "chat_favorites";
DROP POLICY IF EXISTS "chat_favorites_delete_own_or_admin" ON "chat_favorites";

CREATE POLICY "chat_favorites_select_own_or_admin" ON "chat_favorites"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR "user_id"::text = current_setting('app.current_user_id', true)
  );

CREATE POLICY "chat_favorites_insert_self_or_admin" ON "chat_favorites"
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR "user_id"::text = current_setting('app.current_user_id', true)
  );

CREATE POLICY "chat_favorites_delete_own_or_admin" ON "chat_favorites"
  FOR DELETE
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR "user_id"::text = current_setting('app.current_user_id', true)
  );

-- ============================================================================
-- 6) comment_likes 表 RLS
-- ============================================================================

ALTER TABLE "comment_likes" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_likes_select_own_or_admin" ON "comment_likes";
DROP POLICY IF EXISTS "comment_likes_insert_self_or_admin" ON "comment_likes";
DROP POLICY IF EXISTS "comment_likes_delete_own_or_admin" ON "comment_likes";

CREATE POLICY "comment_likes_select_own_or_admin" ON "comment_likes"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR "user_id"::text = current_setting('app.current_user_id', true)
  );

CREATE POLICY "comment_likes_insert_self_or_admin" ON "comment_likes"
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR "user_id"::text = current_setting('app.current_user_id', true)
  );

CREATE POLICY "comment_likes_delete_own_or_admin" ON "comment_likes"
  FOR DELETE
  USING (
    current_setting('app.current_user_role', true) IN ('1', '2', '3')
    OR "user_id"::text = current_setting('app.current_user_id', true)
  );

-- ============================================================================
-- 验证 RLS 状态
-- ============================================================================

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('users', 'orders', 'payments', 'chat_messages', 'chat_favorites', 'comment_likes')
    AND rowsecurity = true;

  IF v_count <> 6 THEN
    RAISE EXCEPTION 'RLS not enabled on all 6 tables: only % have RLS', v_count;
  END IF;

  RAISE NOTICE 'RLS 验证:6 个核心表全部启用 RLS';
END$$;
