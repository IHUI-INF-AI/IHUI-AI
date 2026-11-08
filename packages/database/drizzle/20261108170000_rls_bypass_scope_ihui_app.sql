-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- ============================================================================
-- DB-39: 把 `_bypass_rls` 策略从 PUBLIC 收窄到应用角色 ihui_app
--
-- 背景:
--   0214_cleanup_legacy_tenant_rls.sql 给 users/orders/payments/chat_messages/
--   chat_favorites/comment_likes 补了 `<表>_bypass_rls` 策略;
--   20260927100000_tenant_rls_policies_batch1.sql 又给 team_knowledge_* / zhs_knowledge_* /
--   user_memories / image_gen_favorites / notes 补了同名策略。两者都是 `FOR ALL TO PUBLIC`
--   + `current_setting('app.bypass_rls', true) = 'true'`。
--   `app.bypass_rls` 是自定义 GUC,任何会话都能 `SET app.bypass_rls='true'` ——
--   策略的 TO 不限定就等于把「关掉这 14 张表 RLS」的开关交给了所有库内角色。
--
-- 本迁移:
--   1. 逐表 DROP + CREATE 同名策略,唯一差别是 `TO ihui_app`
--      (ihui_app 由 20260921160000_scoped_app_role_owner_rls.sql 创建:
--       LOGIN / NOSUPERUSER / NOBYPASSRLS / NOINHERIT,是唯一被授了业务表权限的应用角色);
--   2. 应用角色缺失时 **RAISE**(fail-closed):绝不静默保留 PUBLIC 形态。
--
-- 为什么不是删掉策略:
--   withBypassRls(packages/database/src/rls.ts)仍需要一条受控旁路(迁移/seed/
--   cleanup/background);删掉会让这些通道在 RLS 开启后直接 0 行/写入被拒。
--   收窄到 ihui_app 后,其它角色即使 SET 该 GUC 也不生效。
--
-- 幂等:DO 块内逐条 DROP POLICY IF EXISTS + CREATE POLICY;重复执行结果一致。
-- 锁表评估:DROP/CREATE POLICY 只取对应表的表级 DDL 锁(ShareRowExclusive),不扫数据、不改行;
--   14 张表串行重建策略,合计毫秒级(与表体积无关),期间对目标表的写入会短暂排队。
-- 回滚(恢复原 PUBLIC 形态,即回退到本迁移前):
--   DO $$
--   DECLARE t text;
--     tables text[] := ARRAY['users','orders','payments','chat_messages','chat_favorites',
--                            'comment_likes','team_knowledge_spaces','team_knowledge_items',
--                            'team_knowledge_revisions','zhs_knowledge_doc','zhs_knowledge_chunk',
--                            'user_memories','image_gen_favorites','notes'];
--   BEGIN
--     FOREACH t IN ARRAY tables LOOP
--       IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
--       EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_bypass_rls', t);
--       EXECUTE format(
--         'CREATE POLICY %I ON public.%I FOR ALL TO PUBLIC USING (current_setting(''app.bypass_rls'', true) = ''true'') WITH CHECK (current_setting(''app.bypass_rls'', true) = ''true'')',
--         t || '_bypass_rls', t);
--     END LOOP;
--   END $$;
-- ============================================================================

DO $db39$
DECLARE
  app_role constant text := 'ihui_app';
  t        text;
  tables   constant text[] := ARRAY[
    'users', 'orders', 'payments', 'chat_messages', 'chat_favorites', 'comment_likes',
    'team_knowledge_spaces', 'team_knowledge_items', 'team_knowledge_revisions',
    'zhs_knowledge_doc', 'zhs_knowledge_chunk', 'user_memories', 'image_gen_favorites', 'notes'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    RAISE EXCEPTION
      '[db39] 应用角色 % 不存在:拒绝把 _bypass_rls 策略留在 PUBLIC 上。先跑 20260921160000_scoped_app_role_owner_rls.sql',
      app_role;
  END IF;

  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE '[db39] 表 public.% 不存在,跳过(策略随表不存在)', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_bypass_rls', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %I USING (current_setting(''app.bypass_rls'', true) = ''true'') WITH CHECK (current_setting(''app.bypass_rls'', true) = ''true'')',
      t || '_bypass_rls', t, app_role
    );
    RAISE NOTICE '[db39] public.%:_bypass_rls 已收窄到角色 %', t, app_role;
  END LOOP;
END
$db39$;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
