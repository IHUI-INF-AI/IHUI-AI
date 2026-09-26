-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- ============================================================================
-- O13 第一格(2026-09-26):租户面核心表的行级策略补齐 —— 让「关掉 bypassrls」成为
-- 一件可以做的事。本文件只做三件事:① 建两个共享判定函数;② 对 8 张表
-- ENABLE + FORCE ROW LEVEL SECURITY;③ 给这 8 张表各建 5 条策略(读/插/改/删 + 旁路)。
--
-- 生产实测前提(2026-09-26 只读探针,不是推测):
--   应用角色 `ihui`:rolsuper=f、rolcreaterole=f、**rolbypassrls=t**、rolcreatedb=t;
--   全库 721 张表里只有 6 张 relrowsecurity=true(chat_favorites / chat_messages /
--   comment_likes / orders / payments / users),39 条策略覆盖 10 张表。
--   ⇒ 今天 RLS 对应用连接**完全不生效**。因此本迁移落地当天在生产是**惰性的**
--     (既不会拦住任何查询,也不会让任何页面变空);它真正生效的时刻是第三格
--     执行 `ALTER ROLE ihui NOBYPASSRLS` 的那一刻 —— 所以「能不能安全关」的全部
--     重量都落在这一份文件与它 accompanying 的前置核对表上。
--
-- 为什么不重复造真相(读过的既有事实):
--   * 0214_cleanup_legacy_tenant_rls.sql 判定「tenant_id 列 + _tenant_iso_* 策略是功能性
--     死代码」并删列删策略,同时给那 6 张表补了 `<表>_bypass_rls` 策略保住 withBypassRls
--     通道 —— 于是 `app.tenant_id` 这个会话变量从此**没有任何策略读它**,而
--     packages/database/src/rls.ts 的 withTenant() 仍在设它。本迁移**不再使用**
--     `app.tenant_id`(用了就是给一个没人校验的名字续命),也**不删** withTenant,
--     那是另一个决定(它仍被用作调用方意图的自证)。
--   * 20260921160000_scoped_app_role_owner_rls.sql 已为 content_generation_tasks /
--     webhook_subscriptions / zhs_ai_user_model_chat_config / messages 建好 owner 策略,
--     并**刻意不 ENABLE**(等 P1/P2 前置)。本迁移不碰那 4 张表:激活它们属于
--     owner-rls.mjs enable 的职责,在这里重复建一遍就是第二套策略。
--   * 会话变量名一律沿用既有契约:`app.user_id`(apps/api/src/plugins/rls-context.ts
--     的「新契约(O4)」,也是 20260921 那份策略读的那一个)、`app.bypass_rls`
--     (packages/database/src/rls.ts withBypassRls 用 set_config(..., true) 写的这一个)。
--     本迁移**不新增任何会话变量名**。
--
-- 为什么策略里**不写**「管理员旁路」(与 0068 那份的有意分歧,不是漏了):
--   0068 用 `current_setting('app.current_user_role', true) IN ('1','2','3')` 当管理员放行。
--   会话变量在池化连接上是**会串**的(rls-context.ts 用 is_local=false 写,作用域是整条
--   物理连接而不是本次请求)。owner 谓词串了只会**变窄**(别人的行读不到 → 可用性事故);
--   而 role 谓词串了会**变宽**(一个 role='1' 的残值把全表开放给下一个借到这条连接的人)。
--   同一台机器上两种失效方向相反的判据混在一张表里,审的人只会看到「策略挺严」。
--   所以本迁移的判据只有两种,且**方向一致地偏窄**:① 归属/成员谓词(读 app.user_id);
--   ② 显式旁路(读 app.bypass_rls,由 withBypassRls 以 is_local=true 写 ⇒ 事务结束即失效,
--   且有 reason 白名单 + 调用栈留痕)。超级用户与 BYPASSRLS 角色天然走第三条路(不求值策略),
--   这正是第三格要收口的对象 —— 见本文件末「关 bypassrls 的前置」。
--
-- 为什么这次是 FORCE 而 20260921 那份刻意不 FORCE:
--   那份的前提是「连接角色是 ihui_app,不是表的属主」⇒ ENABLE 就够。
--   而生产实测:应用连接的是 `ihui`,而那 6 张已开启的表同时是 relforcerowsecurity=true
--   —— 这个组合只有在「连接角色就是属主」时才有意义。属主 + 不 FORCE ⇒ 策略永不求值,
--   即造好没装车。所以本批 8 张表按属主连接的现实同时打 ENABLE 与 FORCE。
--   代价如实写在下一段。
--
-- 本批**不覆盖**哪些表、为什么(第二批清单的完整版另见交付报告):
--   * team_members / team_knowledge_space_members / project_members / tenant_members
--     —— 「看得见同租户的别人」必须引用自己这张表 ⇒ PostgreSQL 直接
--     `ERROR: infinite recursion detected in policy`。解法是 SECURITY DEFINER 判定函数,
--     那是一个新的权限面决定,不该夹在第一格里顺手做。
--   * users / orders / payments / chat_messages / chat_favorites / comment_likes
--     —— 已有 0068 + 0214 的策略族,要动得先收口 role 谓词那一支,不与其他表同形。
--   * teams / projects / tenants / tenant_quotas / team_invitations / developer_api_keys
--     —— 各自都有一条**没有用户上下文**的正当读路径(teams.slug 唯一性校验、
--     projects 的后台统计与全站搜索、tenant 插件按 slug 解析子域、
--     team_invitations 按 token 接受邀请、api-key-auth 按 key 值反查鉴权)。
--     给它们套归属谓词 = 那些路径静默 0 行,现象是「功能坏了但没有报错」。
--   * knowledge_cards / repo_wiki_docs / upload_sessions —— 属主列**可空**:
--     一旦套上 `user_id = <主体>`,`user_id IS NULL` 的历史行对任何人都不可见,
--     包括运维(除非走旁路)。要么先做回填并加 NOT NULL 约束,要么不套 —— 不得
--     用「策略加个 IS NULL 放行」把洞留在读面。
--   * agent_memory_* / user_automations —— 由 ai-service 与调度器**跨用户全表扫描**,
--     且 ai-service 用自己的 asyncpg 池,从未设过 app.user_id ⇒ 直接归零。
--
-- 幂等:CREATE OR REPLACE FUNCTION;每条 CREATE POLICY 前配 DROP POLICY IF EXISTS;
--   ENABLE/FORCE 重复执行等价。整份按仓内多数迁移的写法用
--   `--> statement-breakpoint` 分段,可重复重放。
-- 回滚:见文件末「回滚」注释块。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) 共享判定函数(SECURITY INVOKER:它们不越权,只是把「同一件事写一遍」的需要
--    满足掉 —— 空间可见性被 spaces / items / revisions 三张表读,各写一遍必漂)。
--    两条纪律:① 引用一律 schema 限定,不靠调用方的 search_path;
--    ② 策略图上不许有回边:前三支只读 team_knowledge_space_members / team_members
--       (本批不受 RLS 管辖),第四支只向下读 team_knowledge_spaces 一层,
--       而 spaces 自己的策略不读任何受管辖表 ⇒ 链在 PostgreSQL 的
--       `infinite recursion detected in policy` 判据前是**终止**的。
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public."team_knowledge_space_member_visible"("p_space_id" uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog, public
AS $$
  -- 与 resolveEffectiveAccess() 的「space_member」候选同形:该空间的成员行,不分角色,
  -- 都表示"主体对这个空间有某种生效权限",因此是可见性的下界(权限**高低**仍由应用层判)。
  SELECT EXISTS (
    SELECT 1 FROM public."team_knowledge_space_members" AS "m"
     WHERE "m"."space_id" = "p_space_id"
       AND "m"."user_id"::text = current_setting('app.user_id', true)
  )
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public."team_knowledge_space_team_visible"("p_team_id" uuid, "p_visibility" varchar)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog, public
AS $$
  -- 与 resolveEffectiveAccess() 的团队分支逐字对齐:
  --   团队 owner/admin ⇒ 空间 owner,**不受 visibility 限制**;
  --   团队 member ⇒ 仅当 visibility = 'team' 时才是 viewer(restricted 空间不认团队默认档);
  --   其余角色值(既不是 owner/admin/member)不产生候选 ⇒ 不可见。
  SELECT EXISTS (
    SELECT 1 FROM public."team_members" AS "tm"
     WHERE "tm"."team_id" = "p_team_id"
       AND "tm"."user_id"::text = current_setting('app.user_id', true)
       AND (
            "tm"."role" IN ('owner', 'admin')
            OR ("p_visibility" = 'team' AND "tm"."role" = 'member')
          )
  )
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public."team_knowledge_space_visible"(
  "p_space_id" uuid,
  "p_team_id" uuid,
  "p_created_by" uuid,
  "p_visibility" varchar
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog, public
AS $$
  -- 生效角色 = max(空间成员档, 团队档, 创建者档);这里判的是「候选集非空」,
  -- 即 resolveEffectiveAccess() 返回非 null。刻意**不**在库上判高低:
  -- 库是应用层数据闸的第二道闸,只把行集收窄到"这个主体在应用层也拿不到 null"的那一批。
  SELECT "p_created_by"::text = current_setting('app.user_id', true)
      OR public."team_knowledge_space_member_visible"("p_space_id")
      OR public."team_knowledge_space_team_visible"("p_team_id", "p_visibility")
$$;--> statement-breakpoint

-- 由空间句柄推导可见性(items / revisions 只带 space_id,不带 team/created_by)。
-- 内层读 public."team_knowledge_spaces" 本身也要过该表的策略 —— 图上没有回边
-- (spaces 的策略只读 space_members 与 team_members 两张不受管辖的表),
-- 所以这条链在 PostgreSQL 的递归检测下是**终止**的;外层那记显式谓词是为了
-- "哪天有人把 spaces 的 RLS 关掉,这条推导也不会悄悄变成全可见"而写的双保险。
CREATE OR REPLACE FUNCTION public."team_knowledge_space_visible_by_id"("p_space_id" uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."team_knowledge_spaces" AS "s"
     WHERE "s"."id" = "p_space_id"
       AND public."team_knowledge_space_visible"(
             "s"."id", "s"."team_id", "s"."created_by", "s"."visibility"
           )
  )
$$;--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 2) team_knowledge_spaces —— D29 团队知识引擎的空间根
--    写入侧比读取侧严:建空间要求"创建者是我 ∧ 我是该团队 owner/admin",
--    逐字对应 knowledge-team-service.ts createSpace() 的守卫
--    ("只有团队管理员或拥有者可以创建知识空间")。读取侧放宽到"有任何生效角色"。
-- ----------------------------------------------------------------------------
ALTER TABLE public."team_knowledge_spaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public."team_knowledge_spaces" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_spaces_tenant_select" ON public."team_knowledge_spaces";--> statement-breakpoint
CREATE POLICY "team_knowledge_spaces_tenant_select" ON public."team_knowledge_spaces"
  FOR SELECT TO PUBLIC
  USING (public."team_knowledge_space_visible"("id", "team_id", "created_by", "visibility"));--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_spaces_tenant_insert" ON public."team_knowledge_spaces";--> statement-breakpoint
CREATE POLICY "team_knowledge_spaces_tenant_insert" ON public."team_knowledge_spaces"
  FOR INSERT TO PUBLIC
  WITH CHECK (
    "created_by"::text = current_setting('app.user_id', true)
    AND EXISTS (
      SELECT 1 FROM public."team_members" AS "tm"
       WHERE "tm"."team_id" = "team_knowledge_spaces"."team_id"
         AND "tm"."user_id"::text = current_setting('app.user_id', true)
         AND "tm"."role" IN ('owner', 'admin')
    )
  );--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_spaces_tenant_update" ON public."team_knowledge_spaces";--> statement-breakpoint
CREATE POLICY "team_knowledge_spaces_tenant_update" ON public."team_knowledge_spaces"
  FOR UPDATE TO PUBLIC
  USING (public."team_knowledge_space_visible"("id", "team_id", "created_by", "visibility"))
  WITH CHECK (public."team_knowledge_space_visible"("id", "team_id", "created_by", "visibility"));--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_spaces_tenant_delete" ON public."team_knowledge_spaces";--> statement-breakpoint
CREATE POLICY "team_knowledge_spaces_tenant_delete" ON public."team_knowledge_spaces"
  FOR DELETE TO PUBLIC
  USING ("created_by"::text = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_spaces_bypass_rls" ON public."team_knowledge_spaces";--> statement-breakpoint
CREATE POLICY "team_knowledge_spaces_bypass_rls" ON public."team_knowledge_spaces"
  FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = 'true')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'true');--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 3) team_knowledge_items —— 条目:可见性完全由所属空间推导(space_id 是 NOT NULL 外键)
-- ----------------------------------------------------------------------------
ALTER TABLE public."team_knowledge_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public."team_knowledge_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_items_tenant_select" ON public."team_knowledge_items";--> statement-breakpoint
CREATE POLICY "team_knowledge_items_tenant_select" ON public."team_knowledge_items"
  FOR SELECT TO PUBLIC
  USING (public."team_knowledge_space_visible_by_id"("space_id"));--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_items_tenant_insert" ON public."team_knowledge_items";--> statement-breakpoint
CREATE POLICY "team_knowledge_items_tenant_insert" ON public."team_knowledge_items"
  FOR INSERT TO PUBLIC
  WITH CHECK (public."team_knowledge_space_visible_by_id"("space_id"));--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_items_tenant_update" ON public."team_knowledge_items";--> statement-breakpoint
CREATE POLICY "team_knowledge_items_tenant_update" ON public."team_knowledge_items"
  FOR UPDATE TO PUBLIC
  USING (public."team_knowledge_space_visible_by_id"("space_id"))
  WITH CHECK (public."team_knowledge_space_visible_by_id"("space_id"));--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_items_tenant_delete" ON public."team_knowledge_items";--> statement-breakpoint
CREATE POLICY "team_knowledge_items_tenant_delete" ON public."team_knowledge_items"
  FOR DELETE TO PUBLIC
  USING (public."team_knowledge_space_visible_by_id"("space_id"));--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_items_bypass_rls" ON public."team_knowledge_items";--> statement-breakpoint
CREATE POLICY "team_knowledge_items_bypass_rls" ON public."team_knowledge_items"
  FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = 'true')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'true');--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 4) team_knowledge_revisions —— 过程审计:同一推导链(space_id 是 NOT NULL 冗余列)
--    审计流不得因为"看不见"而静默缺失 ⇒ 读面与条目读面同形;写面只允许写进可见空间。
-- ----------------------------------------------------------------------------
ALTER TABLE public."team_knowledge_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public."team_knowledge_revisions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_revisions_tenant_select" ON public."team_knowledge_revisions";--> statement-breakpoint
CREATE POLICY "team_knowledge_revisions_tenant_select" ON public."team_knowledge_revisions"
  FOR SELECT TO PUBLIC
  USING (public."team_knowledge_space_visible_by_id"("space_id"));--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_revisions_tenant_insert" ON public."team_knowledge_revisions";--> statement-breakpoint
CREATE POLICY "team_knowledge_revisions_tenant_insert" ON public."team_knowledge_revisions"
  FOR INSERT TO PUBLIC
  WITH CHECK (public."team_knowledge_space_visible_by_id"("space_id"));--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_revisions_tenant_update" ON public."team_knowledge_revisions";--> statement-breakpoint
CREATE POLICY "team_knowledge_revisions_tenant_update" ON public."team_knowledge_revisions"
  FOR UPDATE TO PUBLIC
  USING (public."team_knowledge_space_visible_by_id"("space_id"))
  WITH CHECK (public."team_knowledge_space_visible_by_id"("space_id"));--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_revisions_tenant_delete" ON public."team_knowledge_revisions";--> statement-breakpoint
CREATE POLICY "team_knowledge_revisions_tenant_delete" ON public."team_knowledge_revisions"
  FOR DELETE TO PUBLIC
  USING (public."team_knowledge_space_visible_by_id"("space_id"));--> statement-breakpoint

DROP POLICY IF EXISTS "team_knowledge_revisions_bypass_rls" ON public."team_knowledge_revisions";--> statement-breakpoint
CREATE POLICY "team_knowledge_revisions_bypass_rls" ON public."team_knowledge_revisions"
  FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = 'true')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'true');--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 5) zhs_knowledge_doc —— RAG 文档面。属主列是 varchar(64) `owner_uuid`(不是 uuid),
--    且有一个**实测存在**的共享档:knowledge-chat-context.ts 用 ownerUuid='' 表达
--    "全局知识"(userId 为 null 时匹配全局语料)。所以读侧必须带 `= ''` 那一支,
--    否则全站"全局知识"整族消失;写侧刻意**不带**那一支 —— 一个用户不该能造全局语料。
-- ----------------------------------------------------------------------------
ALTER TABLE public."zhs_knowledge_doc" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public."zhs_knowledge_doc" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "zhs_knowledge_doc_tenant_select" ON public."zhs_knowledge_doc";--> statement-breakpoint
CREATE POLICY "zhs_knowledge_doc_tenant_select" ON public."zhs_knowledge_doc"
  FOR SELECT TO PUBLIC
  USING ("owner_uuid" = current_setting('app.user_id', true) OR "owner_uuid" = '');--> statement-breakpoint

DROP POLICY IF EXISTS "zhs_knowledge_doc_tenant_insert" ON public."zhs_knowledge_doc";--> statement-breakpoint
CREATE POLICY "zhs_knowledge_doc_tenant_insert" ON public."zhs_knowledge_doc"
  FOR INSERT TO PUBLIC
  WITH CHECK ("owner_uuid" = current_setting('app.user_id', true) AND "owner_uuid" <> '');--> statement-breakpoint

DROP POLICY IF EXISTS "zhs_knowledge_doc_tenant_update" ON public."zhs_knowledge_doc";--> statement-breakpoint
CREATE POLICY "zhs_knowledge_doc_tenant_update" ON public."zhs_knowledge_doc"
  FOR UPDATE TO PUBLIC
  USING ("owner_uuid" = current_setting('app.user_id', true) OR "owner_uuid" = '')
  WITH CHECK ("owner_uuid" = current_setting('app.user_id', true) AND "owner_uuid" <> '');--> statement-breakpoint

DROP POLICY IF EXISTS "zhs_knowledge_doc_tenant_delete" ON public."zhs_knowledge_doc";--> statement-breakpoint
CREATE POLICY "zhs_knowledge_doc_tenant_delete" ON public."zhs_knowledge_doc"
  FOR DELETE TO PUBLIC
  USING ("owner_uuid" = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "zhs_knowledge_doc_bypass_rls" ON public."zhs_knowledge_doc";--> statement-breakpoint
CREATE POLICY "zhs_knowledge_doc_bypass_rls" ON public."zhs_knowledge_doc"
  FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = 'true')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'true');--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 6) zhs_knowledge_chunk —— 向量分片(与 doc 同一 owner_uuid 推导,列自带,不 join)
-- ----------------------------------------------------------------------------
ALTER TABLE public."zhs_knowledge_chunk" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public."zhs_knowledge_chunk" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "zhs_knowledge_chunk_tenant_select" ON public."zhs_knowledge_chunk";--> statement-breakpoint
CREATE POLICY "zhs_knowledge_chunk_tenant_select" ON public."zhs_knowledge_chunk"
  FOR SELECT TO PUBLIC
  USING ("owner_uuid" = current_setting('app.user_id', true) OR "owner_uuid" = '');--> statement-breakpoint

DROP POLICY IF EXISTS "zhs_knowledge_chunk_tenant_insert" ON public."zhs_knowledge_chunk";--> statement-breakpoint
CREATE POLICY "zhs_knowledge_chunk_tenant_insert" ON public."zhs_knowledge_chunk"
  FOR INSERT TO PUBLIC
  WITH CHECK ("owner_uuid" = current_setting('app.user_id', true) AND "owner_uuid" <> '');--> statement-breakpoint

DROP POLICY IF EXISTS "zhs_knowledge_chunk_tenant_update" ON public."zhs_knowledge_chunk";--> statement-breakpoint
CREATE POLICY "zhs_knowledge_chunk_tenant_update" ON public."zhs_knowledge_chunk"
  FOR UPDATE TO PUBLIC
  USING ("owner_uuid" = current_setting('app.user_id', true) OR "owner_uuid" = '')
  WITH CHECK ("owner_uuid" = current_setting('app.user_id', true) AND "owner_uuid" <> '');--> statement-breakpoint

DROP POLICY IF EXISTS "zhs_knowledge_chunk_tenant_delete" ON public."zhs_knowledge_chunk";--> statement-breakpoint
CREATE POLICY "zhs_knowledge_chunk_tenant_delete" ON public."zhs_knowledge_chunk"
  FOR DELETE TO PUBLIC
  USING ("owner_uuid" = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "zhs_knowledge_chunk_bypass_rls" ON public."zhs_knowledge_chunk";--> statement-breakpoint
CREATE POLICY "zhs_knowledge_chunk_bypass_rls" ON public."zhs_knowledge_chunk"
  FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = 'true')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'true');--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 7) user_memories —— 用户记忆(属主 NOT NULL 但无外键;purge-user-pii 与 clawdbot
--    的读写全部已带 userId 过滤 ⇒ 与策略同形)
-- ----------------------------------------------------------------------------
ALTER TABLE public."user_memories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public."user_memories" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "user_memories_tenant_select" ON public."user_memories";--> statement-breakpoint
CREATE POLICY "user_memories_tenant_select" ON public."user_memories"
  FOR SELECT TO PUBLIC
  USING ("user_id"::text = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "user_memories_tenant_insert" ON public."user_memories";--> statement-breakpoint
CREATE POLICY "user_memories_tenant_insert" ON public."user_memories"
  FOR INSERT TO PUBLIC
  WITH CHECK ("user_id"::text = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "user_memories_tenant_update" ON public."user_memories";--> statement-breakpoint
CREATE POLICY "user_memories_tenant_update" ON public."user_memories"
  FOR UPDATE TO PUBLIC
  USING ("user_id"::text = current_setting('app.user_id', true))
  WITH CHECK ("user_id"::text = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "user_memories_tenant_delete" ON public."user_memories";--> statement-breakpoint
CREATE POLICY "user_memories_tenant_delete" ON public."user_memories"
  FOR DELETE TO PUBLIC
  USING ("user_id"::text = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "user_memories_bypass_rls" ON public."user_memories";--> statement-breakpoint
CREATE POLICY "user_memories_bypass_rls" ON public."user_memories"
  FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = 'true')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'true');--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 8) image_gen_favorites —— 生成图收藏(prompt + imageUrl 快照,单一路由入口)
-- ----------------------------------------------------------------------------
ALTER TABLE public."image_gen_favorites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public."image_gen_favorites" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "image_gen_favorites_tenant_select" ON public."image_gen_favorites";--> statement-breakpoint
CREATE POLICY "image_gen_favorites_tenant_select" ON public."image_gen_favorites"
  FOR SELECT TO PUBLIC
  USING ("user_id"::text = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "image_gen_favorites_tenant_insert" ON public."image_gen_favorites";--> statement-breakpoint
CREATE POLICY "image_gen_favorites_tenant_insert" ON public."image_gen_favorites"
  FOR INSERT TO PUBLIC
  WITH CHECK ("user_id"::text = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "image_gen_favorites_tenant_update" ON public."image_gen_favorites";--> statement-breakpoint
CREATE POLICY "image_gen_favorites_tenant_update" ON public."image_gen_favorites"
  FOR UPDATE TO PUBLIC
  USING ("user_id"::text = current_setting('app.user_id', true))
  WITH CHECK ("user_id"::text = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "image_gen_favorites_tenant_delete" ON public."image_gen_favorites";--> statement-breakpoint
CREATE POLICY "image_gen_favorites_tenant_delete" ON public."image_gen_favorites"
  FOR DELETE TO PUBLIC
  USING ("user_id"::text = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "image_gen_favorites_bypass_rls" ON public."image_gen_favorites";--> statement-breakpoint
CREATE POLICY "image_gen_favorites_bypass_rls" ON public."image_gen_favorites"
  FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = 'true')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'true');--> statement-breakpoint

-- ----------------------------------------------------------------------------
-- 9) notes —— 个人笔记,但有一条**实测存在**的公开面:
--    GET /notes/public 用 where(is_public = true) 且不带任何用户条件;
--    GET /notes/:id 的判据是 `!isPublic && userId !== request.userId → 403`。
--    所以:读 = 自己的 ∪ 已公开的;写 = 只能写自己的那一行(把公开笔记"据为己有"
--    在库层就被拒)。PUT/DELETE 路由里"先查 existing.userId 再按 id 写"的形态
--    与本策略逐字同形,不引入第二个判断。
-- ----------------------------------------------------------------------------
ALTER TABLE public."notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public."notes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "notes_tenant_select" ON public."notes";--> statement-breakpoint
CREATE POLICY "notes_tenant_select" ON public."notes"
  FOR SELECT TO PUBLIC
  USING ("user_id"::text = current_setting('app.user_id', true) OR "is_public" = true);--> statement-breakpoint

DROP POLICY IF EXISTS "notes_tenant_insert" ON public."notes";--> statement-breakpoint
CREATE POLICY "notes_tenant_insert" ON public."notes"
  FOR INSERT TO PUBLIC
  WITH CHECK ("user_id"::text = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "notes_tenant_update" ON public."notes";--> statement-breakpoint
CREATE POLICY "notes_tenant_update" ON public."notes"
  FOR UPDATE TO PUBLIC
  USING ("user_id"::text = current_setting('app.user_id', true) OR "is_public" = true)
  WITH CHECK ("user_id"::text = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "notes_tenant_delete" ON public."notes";--> statement-breakpoint
CREATE POLICY "notes_tenant_delete" ON public."notes"
  FOR DELETE TO PUBLIC
  USING ("user_id"::text = current_setting('app.user_id', true));--> statement-breakpoint

DROP POLICY IF EXISTS "notes_bypass_rls" ON public."notes";--> statement-breakpoint
CREATE POLICY "notes_bypass_rls" ON public."notes"
  FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = 'true')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'true');--> statement-breakpoint

-- ============================================================================
-- 已知且如实登记的失效方向(不是"应该没事",是"出事会长这样"):
--  1. 上下文串了 / 没设:未鉴权请求 rls-context.ts 把 app.user_id 写成 **空串**,
--     `''::text` 不等于任何 uuid 文本 ⇒ 归属谓词整段为 false ⇒ **0 行**,不会报错。
--     即第三格之后,"某功能静默空列表"就是这一型的现象。
--  1b. ⚠️ 会话变量只写在**主池**:`applyContextValues` 走 `db`。今天这是够的,
--     因为 apps/api/src/db/index.ts 在没配 DATABASE_READ_REPLICA_URL 时让
--     `dbRead` 回退成 `db` 的 Proxy(同一批物理连接)。但本批 8 张表里
--     notes / zhs_knowledge_* 的读路径**已经在用 dbRead**(notes-routes.ts 的
--     GET /notes 与 GET /notes/public),一旦哪天真的接上副本连接池,那条池上的
--     app.user_id 恒为未设 ⇒ 这些读全部静默 0 行。第三格之前必须先把
--     "每一条请求可能读到的池"都覆盖上上下文,或在连接建立回调里注入。
--  2. 池化串到上一个请求的主体:同上只会"读到别人的空集或自己的子集",
--     不会因为串了而看到更多行 —— 前提是策略里**没有** role 型放行分支,
--     本迁移正是为此拒写它。
--  3. 外键级联不受影响:PostgreSQL 的 RI 内部查询以 row_security=off 执行,
--     所以 ON DELETE CASCADE 的滚存不会因为子表策略而半途卡住。
--  4. FORCE 之后表属主也受策略约束:任何"以属主身份跑全表"的运维脚本必须显式
--     走 withBypassRls(reason 白名单 migration/seed/cleanup)或超级用户连接。
--  5. 有三支**故意比应用层更严**(不是同形),今天都没有对应调用点,但必须写下
--     它们将来出事的样子,否则下一个接手的人会当成 bug:
--     * team_knowledge_spaces 的 DELETE 只认 created_by(全仓当前无物理删空间的调用点;
--       将来若加"团队管理员删空间",这一支要同步放宽,否则现象是 0 行 affected 无报错);
--     * zhs_knowledge_doc / zhs_knowledge_chunk 的 INSERT/UPDATE-WITH CHECK 与 DELETE
--       都不带 owner_uuid='' 那一支 ⇒ 普通主体既造不出也删不掉全局语料
--       (knowledge-rag-service.ts 删 chunk 走 by-doc_id,own doc 的 chunk 的
--        owner_uuid 就是该 owner,所以合法路径不受影响;只有"删全局 doc 的分片"会被拦,
--        那是有意的);
--     * notes 的 INSERT/UPDATE-WITH CHECK/DELETE 只认 user_id(公开面只读不写),
--       与 notes-routes.ts PUT/DELETE 里"先比 existing.userId 再按 id 写"完全同形。
--  6. 本迁移**不**给任何表补 GRANT:8 张表的现连接角色都是属主(见上「为什么 FORCE」),
--     属主天然有全部 DML;若第三格把连接角色换成一个非属主角色,必须连同逐表逐 DML
--     的 GRANT 一起做 —— 没有 GRANT,策略连被求值的机会都没有,直接 permission denied。
--
-- 关 bypassrls 的前置(第三格,本文件不做,一句都不做):见交付报告的核对表。
--
-- 回滚(逆序,整份可逆):
--   对下列 8 张表,各执行 DISABLE ROW LEVEL SECURITY + 5 条 DROP POLICY IF EXISTS
--   (`<表>_tenant_select` / `_tenant_insert` / `_tenant_update` / `_tenant_delete`
--    / `_bypass_rls`):
--     team_knowledge_spaces, team_knowledge_items, team_knowledge_revisions,
--     zhs_knowledge_doc, zhs_knowledge_chunk, user_memories, image_gen_favorites, notes
--   最后:
--     DROP FUNCTION IF EXISTS public."team_knowledge_space_visible"(uuid, uuid, uuid, varchar);
--     DROP FUNCTION IF EXISTS public."team_knowledge_space_visible_by_id"(uuid);
--     DROP FUNCTION IF EXISTS public."team_knowledge_space_member_visible"(uuid);
--     DROP FUNCTION IF EXISTS public."team_knowledge_space_team_visible"(uuid, varchar);
--   注意:回滚**不**撤销 0214 / 20260921 建立的任何策略,也不改任何角色属性。
-- ============================================================================
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
