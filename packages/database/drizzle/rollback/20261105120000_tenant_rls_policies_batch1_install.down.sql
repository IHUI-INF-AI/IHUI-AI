-- ============================================================================
-- 回滚:20261105120000_tenant_rls_policies_batch1_install.sql(同一份契约的装车件)
--
-- 执行前提:确认下一步「ALTER ROLE ihui NOBYPASSRLS」**尚未获批/尚未执行**。
--   本迁移只改表与策略,从未 ALTER ROLE;回滚同样不碰角色属性 ——
--   「关掉 bypassrls」是要单独授权的 DDL,不在本回滚的可逆范围内。
--
-- 反向顺序:先拆策略(否则 DROP FUNCTION 会被策略依赖挡住),再关 FORCE/ENABLE,
-- 最后删函数。全部 IF EXISTS ⇒ 重复执行不报错;对「没装过」的环境执行也是空操作。
-- 执行:psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <本文件>
-- ============================================================================
BEGIN;

DROP POLICY IF EXISTS "team_knowledge_spaces_tenant_select" ON public."team_knowledge_spaces";
DROP POLICY IF EXISTS "team_knowledge_spaces_tenant_insert" ON public."team_knowledge_spaces";
DROP POLICY IF EXISTS "team_knowledge_spaces_tenant_update" ON public."team_knowledge_spaces";
DROP POLICY IF EXISTS "team_knowledge_spaces_tenant_delete" ON public."team_knowledge_spaces";
DROP POLICY IF EXISTS "team_knowledge_spaces_bypass_rls" ON public."team_knowledge_spaces";
DROP POLICY IF EXISTS "team_knowledge_items_tenant_select" ON public."team_knowledge_items";
DROP POLICY IF EXISTS "team_knowledge_items_tenant_insert" ON public."team_knowledge_items";
DROP POLICY IF EXISTS "team_knowledge_items_tenant_update" ON public."team_knowledge_items";
DROP POLICY IF EXISTS "team_knowledge_items_tenant_delete" ON public."team_knowledge_items";
DROP POLICY IF EXISTS "team_knowledge_items_bypass_rls" ON public."team_knowledge_items";
DROP POLICY IF EXISTS "team_knowledge_revisions_tenant_select" ON public."team_knowledge_revisions";
DROP POLICY IF EXISTS "team_knowledge_revisions_tenant_insert" ON public."team_knowledge_revisions";
DROP POLICY IF EXISTS "team_knowledge_revisions_tenant_update" ON public."team_knowledge_revisions";
DROP POLICY IF EXISTS "team_knowledge_revisions_tenant_delete" ON public."team_knowledge_revisions";
DROP POLICY IF EXISTS "team_knowledge_revisions_bypass_rls" ON public."team_knowledge_revisions";
DROP POLICY IF EXISTS "zhs_knowledge_doc_tenant_select" ON public."zhs_knowledge_doc";
DROP POLICY IF EXISTS "zhs_knowledge_doc_tenant_insert" ON public."zhs_knowledge_doc";
DROP POLICY IF EXISTS "zhs_knowledge_doc_tenant_update" ON public."zhs_knowledge_doc";
DROP POLICY IF EXISTS "zhs_knowledge_doc_tenant_delete" ON public."zhs_knowledge_doc";
DROP POLICY IF EXISTS "zhs_knowledge_doc_bypass_rls" ON public."zhs_knowledge_doc";
DROP POLICY IF EXISTS "zhs_knowledge_chunk_tenant_select" ON public."zhs_knowledge_chunk";
DROP POLICY IF EXISTS "zhs_knowledge_chunk_tenant_insert" ON public."zhs_knowledge_chunk";
DROP POLICY IF EXISTS "zhs_knowledge_chunk_tenant_update" ON public."zhs_knowledge_chunk";
DROP POLICY IF EXISTS "zhs_knowledge_chunk_tenant_delete" ON public."zhs_knowledge_chunk";
DROP POLICY IF EXISTS "zhs_knowledge_chunk_bypass_rls" ON public."zhs_knowledge_chunk";
DROP POLICY IF EXISTS "user_memories_tenant_select" ON public."user_memories";
DROP POLICY IF EXISTS "user_memories_tenant_insert" ON public."user_memories";
DROP POLICY IF EXISTS "user_memories_tenant_update" ON public."user_memories";
DROP POLICY IF EXISTS "user_memories_tenant_delete" ON public."user_memories";
DROP POLICY IF EXISTS "user_memories_bypass_rls" ON public."user_memories";
DROP POLICY IF EXISTS "image_gen_favorites_tenant_select" ON public."image_gen_favorites";
DROP POLICY IF EXISTS "image_gen_favorites_tenant_insert" ON public."image_gen_favorites";
DROP POLICY IF EXISTS "image_gen_favorites_tenant_update" ON public."image_gen_favorites";
DROP POLICY IF EXISTS "image_gen_favorites_tenant_delete" ON public."image_gen_favorites";
DROP POLICY IF EXISTS "image_gen_favorites_bypass_rls" ON public."image_gen_favorites";
DROP POLICY IF EXISTS "notes_tenant_select" ON public."notes";
DROP POLICY IF EXISTS "notes_tenant_insert" ON public."notes";
DROP POLICY IF EXISTS "notes_tenant_update" ON public."notes";
DROP POLICY IF EXISTS "notes_tenant_delete" ON public."notes";
DROP POLICY IF EXISTS "notes_bypass_rls" ON public."notes";

ALTER TABLE public."team_knowledge_spaces" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."team_knowledge_spaces" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."team_knowledge_items" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."team_knowledge_items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."team_knowledge_revisions" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."team_knowledge_revisions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."zhs_knowledge_doc" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."zhs_knowledge_doc" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."zhs_knowledge_chunk" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."zhs_knowledge_chunk" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_memories" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."user_memories" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."image_gen_favorites" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."image_gen_favorites" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."notes" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."notes" DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public."team_knowledge_space_member_visible";
DROP FUNCTION IF EXISTS public."team_knowledge_space_team_visible";
DROP FUNCTION IF EXISTS public."team_knowledge_space_visible";
DROP FUNCTION IF EXISTS public."team_knowledge_space_visible_by_id";

COMMIT;
