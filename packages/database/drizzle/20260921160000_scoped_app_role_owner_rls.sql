-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- ============================================================================
-- O13(2026-09-21):给「受控出口」一条**非超级用户**的连接 + owner 维度行级策略
--
-- 为什么这是上线阻塞项而不是优化:
--   apps/api 的 `dbScoped()` / `dbReadScoped()` 对 scoped-*(read-owned /
--   write-owned)能力有一条 fail-closed 断言
--   (`apps/api/src/utils/scoped-guard.ts` assertNonSuperuserForScopedMode):
--   连接被证实是超级用户 ⇒ RLS 必然不生效 ⇒ 503 DATA_ISOLATION_UNAVAILABLE。
--   而迁移之前 `dbScoped()` 与 `db` 同池,该池以超级用户连接 ⇒ 已接线的读路径
--   (客服 messages / webhook 订阅 / 内容生成历史 / `/v1/user/models` 族)在生产**恒 503**。
--
-- 本迁移只做两件**不依赖运行时代码**的事:
--   1) 建最小权限的应用角色 `ihui_app`,并按「真实调用点」逐表逐 DML 授权;
--      `db/index.ts` 配了 `DATABASE_APP_URL` 时,受控出口就走它 ⇒ 探针回 false
--      ⇒ 闸门该干的活(403 DATA_ACCESS_DENIED / DATA_SCOPE_DENIED)才终于干得成。
--   2) 给这些表写下 owner 维度的 RLS 策略(可审、可测、可回滚)。
--
-- ⚠️ 本迁移**不执行** `ENABLE ROW LEVEL SECURITY` —— 不是忘了,是现在开了必然把端点打死:
--   前置 P1:策略读的是 `app.user_id` 会话变量,而它目前只写在**主(superuser)池**
--           (`apps/api/src/plugins/rls-context.ts` applyContextValues → `db`)。
--           受控出口一旦切到独立的应用池,那个池的连接**从来没被 SET 过** ⇒
--           `current_setting('app.user_id', true)` 恒 NULL ⇒ 策略恒假 ⇒ 全量 0 行 / 写入被拒。
--   前置 P2:就算把 SET 也发一份到应用池,**池化的 session 变量与后续语句不保证落在
--           同一条物理连接**上(该文件 :128-132 已自述这一固有限制),要做到钉死必须
--           事务级 `SET LOCAL` ⇒ 需要改调用点(`apps/api/src/routes/**`)。
--   ⇒ 策略先落地,`ENABLE` 由 `packages/database/scripts/owner-rls.mjs enable` 在
--     P1+P2 就位后带**真实负向读断言**(陌生主体必须 0 行,只 SELECT、事务必回滚)去开,
--     断言不过就当场 DISABLE 回退 —— 不会"开了再说"。
--   失败方向顺带说清楚:策略与语句自带的 WHERE / 写入值取**交集**,所以上下文串了/丢了
--   只会「更窄」(误拒、0 行),**不会**把别人的行放行 —— 最坏是可用性事故,不是越权事故。
--
-- 归属列不是猜的(表 → 调用点 → 实际用到的 DML):
--   content_generation_tasks       user_id        SELECT,INSERT
--     ← apps/api/src/db/content-generation-queries.ts(createGenerationTask / findGenerationHistory)
--   webhook_subscriptions          user_id        SELECT,INSERT,UPDATE,DELETE
--     ← apps/api/src/routes/developer/webhooks.ts(订阅 CRUD + 归属反查)
--   zhs_ai_user_model_chat_config  user_id        SELECT,INSERT,UPDATE,DELETE
--     ← apps/api/src/routes/v1-ai-core.ts(/v1/user/models 族)
--   messages                       sender_id|receiver_id   **仅 SELECT**
--     ← apps/api/src/routes/other/v1-customer-service-routes.ts(两个只读端点)
--     该表没有 user_id 列,归属由会话双方表达 ⇒ 策略用两列的 OR,不硬造 user_id。
--
-- 刻意**不**授权、也刻意**不**给策略的表(列出来,别让下一个人靠猜):
--   * 无 owner 列的全站共享面:`content_generation_templates`、`zhs_faq`
--     —— 调用点压根不走受控出口(见 content-generation-queries.ts / v1-customer-service-routes.ts
--     的注释:走受控出口等于在 scoped 模式下把这个只读端点打死)。给它们授权等于又把
--     "读全库"的口子开回给应用角色,给策略更没有归属列可依据。
--   * compute 自有运行记录白名单:`llm_call_logs`、`agent_runs`、`agent_checkpoints`、
--     `api_key_usage_windows`、`webhook_delivery_logs`、`audit_logs`、`security_logs`
--     —— 当前这些表的写入走 `db`(relay-billing-service 等),不经 `dbScoped()`,
--     所以按最小权限**一张都不给**;哪天把 compute 写路径接到受控出口,必须连同
--     GRANT 一起做(否则那条路会在应用层放行、在 DB 层 permission denied)。
--   * `users` 及一切其余表:一张都不授。`content_generation_tasks.user_id` 与
--     `messages.sender_id/receiver_id` 都 FK 到 `users`,但 PostgreSQL 的外键约束检查
--     走被引用表的属主上下文,不做表级 ACL、也不套 RLS —— 所以**授权给 `users` 既不必要、
--     也绝不该有**(那等于把"读全用户表"重新交回应用角色)。
--
-- 关于 FORCE:只 ENABLE、不 FORCE。对 `ihui_app` 这种「被授权但非属主」的角色,
--   ENABLE 就够;FORCE 是给**表属主**上的(默认属主绕过 RLS)。反过来说,
--   若将来把某张表 owner 改成 `ihui_app`,那就必须补 `FORCE ROW LEVEL SECURITY`,
--   否则它会以属主身份静默绕过 —— 这也是激活脚本会先断言"角色不是这些表的 owner"的原因。
--
-- 关于 PUBLIC:PG14 及以前 `public` schema 的 CREATE 默认发给 PUBLIC,本迁移
--   **不擅自** `REVOKE ... FROM PUBLIC`(那是全库范围的行为变更,属运维决策)。
--   在 PG15+ 上 public 已无 PUBLIC CREATE;`ihui_app` 自身一条 DDL 权限都没有。
--
-- 幂等:整份只有**一个** dollar-quoted DO 块 —— 任何语句分割器看到的都是单条语句,
--   块内每条 EXECUTE 都带 IF EXISTS / 先 REVOKE 后 GRANT,重复执行结果一致。
-- 回滚:见文件尾「回滚」注释块,或 `node packages/database/scripts/owner-rls.mjs disable`。
-- ============================================================================

DO $o13$
DECLARE
  app_role constant text := 'ihui_app';
  spec     text[];
  t        text;
  privs    text;
  owner_sql text;
  pol_kind text;
  -- [表, 授权的 DML, owner 归属谓词 SQL 片段]
  specs constant text[][] := ARRAY[
    ['content_generation_tasks', 'SELECT,INSERT',
      $$user_id::text = current_setting('app.user_id', true)$$],
    ['webhook_subscriptions', 'SELECT,INSERT,UPDATE,DELETE',
      $$user_id::text = current_setting('app.user_id', true)$$],
    ['zhs_ai_user_model_chat_config', 'SELECT,INSERT,UPDATE,DELETE',
      $$user_id::text = current_setting('app.user_id', true)$$],
    ['messages', 'SELECT',
      $$sender_id::text = current_setting('app.user_id', true)
         OR receiver_id::text = current_setting('app.user_id', true)$$]
  ];
BEGIN
  -- --------------------------------------------------------------------------
  -- 1) 应用角色:能登录,但既不是超级用户,也不是任何人的爹,也绕过不了 RLS
  --    密码**不落仓**:建完角色后由运维在库上 `ALTER ROLE ihui_app PASSWORD '...'`
  --    (见 AGENTS.md §5d 的密钥口径 —— 口令同密钥,不进 git、不进聊天记录)。
  --    NOINHERIT:它只吃直接授给它的那点权限,哪天有人把它塞进某个大角色组,
  --    也不会顺带把组的权限捞走。
  -- --------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    EXECUTE format(
      'CREATE ROLE %I WITH LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS NOINHERIT NOREPLICATION',
      app_role
    );
    RAISE NOTICE '[o13] 已创建应用角色 %：非超级用户 / 无 BYPASSRLS / 不继承(密码需运维另行 ALTER ROLE 设置)', app_role;
  ELSE
    -- 已存在也**重刷属性**:防"手滑给它点了 SUPERUSER"悄悄漂回来越跑越松
    -- (2026-09-21 加 EXCEPTION 豁免:PG 对非超管连接连"撤销 SUPERUSER"都一律报
    --  insufficient_privilege,不豁免会让整条迁移在生产部署库上永远挂掉。
    --  无权时降级为 NOTICE 不阻塞 —— 属性防漂移交由运维以超管账号手动执行同款 ALTER)
    BEGIN
      EXECUTE format(
        'ALTER ROLE %I WITH NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS NOINHERIT NOREPLICATION LOGIN',
        app_role
      );
      RAISE NOTICE '[o13] 应用角色 % 已存在,已重刷为非超级用户 / 无 BYPASSRLS / 不继承', app_role;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE '[o13] 应用角色 % 已存在,当前连接非超管无权 ALTER ROLE,已跳过属性重刷(如需防漂移请以超管执行同款 ALTER)', app_role;
    END;
  END IF;

  -- --------------------------------------------------------------------------
  -- 2) 干净起点:先把这个角色的库内权限全清,再按调用点逐张发。
  --    为什么先全清:GRANT 是累加的,只补不减会让"上次多手给的 DELETE"永远洗不掉。
  --    明确不做的事:没有 GRANT ANY / 没有 GRANT ... ON SCHEMA 一把梭 / 不给任何
  --    sequence(这 4 张表主键都是 uuid defaultRandom(),一个序列都不需要) /
  --    不给 CREATE(结构变更永远是迁移的活儿,不是应用进程的活儿)。
  -- --------------------------------------------------------------------------
  EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', app_role);
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', app_role);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', app_role);
  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', app_role);
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_role);

  FOREACH spec SLICE 1 IN ARRAY specs LOOP
    t := spec[1];
    privs := spec[2];
    owner_sql := regexp_replace(spec[3], '\s+', ' ', 'g');

    IF to_regclass('public.' || t) IS NULL THEN
      -- 表不在 = schema 已经和这份清单漂移了。这里**炸**给运维看,绝不 NOTICE 一声跳过 ——
      -- 跳过会让应用在运行时才发现 permission denied,那比部署期失败难查十倍。
      RAISE EXCEPTION '[o13] 开放面声明的表 public.% 不存在:schema 与 GRANT 清单已漂移,先对齐再跑', t;
    END IF;

    EXECUTE format(
      'GRANT %s ON TABLE public.%I TO %I', privs, t, app_role
    );

    -- ------------------------------------------------------------------------
    -- 3) owner 维度策略:**逐条对着刚发出去的 GRANT 建**,一条都不多、一条都不少。
    --    判据直接 string_to_array(privs) 派生,不另写一份清单 —— 于是"授权"与"策略"
    --    在结构上不可能漂移(没被授的 DML 不会有 policy 兜着,反之亦然)。
    --    USING / WITH CHECK 用同一个归属谓词:读只读自己的,写只能写自己的。
    -- ------------------------------------------------------------------------
    FOREACH pol_kind IN ARRAY string_to_array(lower(privs), ',') LOOP
      IF pol_kind NOT IN ('select', 'insert', 'update', 'delete') THEN
        RAISE EXCEPTION '[o13] 未知的 DML 关键字 %（表 %）—— 清单写错了,拒收', pol_kind, t;
      END IF;

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_' || pol_kind, t);
      IF pol_kind = 'insert' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s)',
          t || '_owner_' || pol_kind, t, owner_sql
        );
      ELSIF pol_kind = 'update' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)',
          t || '_owner_' || pol_kind, t, owner_sql, owner_sql
        );
      ELSIF pol_kind = 'delete' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR DELETE USING (%s)',
          t || '_owner_' || pol_kind, t, owner_sql
        );
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT USING (%s)',
          t || '_owner_' || pol_kind, t, owner_sql
        );
      END IF;
    END LOOP;

    RAISE NOTICE '[o13] public.%：GRANT % + owner 策略已就位(策略已建,行级强制尚未开启)', t, privs;
  END LOOP;
END
$o13$;

-- ============================================================================
-- 4) 开启行级强制 —— **故意留白,别在这儿手抖取消注释**。激活走:
--      node packages/database/scripts/owner-rls.mjs enable
--    它会先跑真实断言(角色非超级用户/非属主、SET 得钉在服务的连接上、
--    「自己的行读得到 / 别人的行读不到」双向都过)再执行下面这几句:
--      ALTER TABLE "content_generation_tasks"      ENABLE ROW LEVEL SECURITY;
--      ALTER TABLE "webhook_subscriptions"         ENABLE ROW LEVEL SECURITY;
--      ALTER TABLE "zhs_ai_user_model_chat_config" ENABLE ROW LEVEL SECURITY;
--      ALTER TABLE "messages"                      ENABLE ROW LEVEL SECURITY;
--    (不 FORCE —— 理由见文件头「关于 FORCE」。)
-- ============================================================================

-- ============================================================================
-- 回滚(整份迁移可逆;顺序 = 反着来)
--
--   -- a) 摘了行级强制(如果 enable 过),再删策略
--   ALTER TABLE "content_generation_tasks"      DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "webhook_subscriptions"         DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "zhs_ai_user_model_chat_config" DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "messages"                      DISABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS "content_generation_tasks_owner_select"  ON "content_generation_tasks";
--   DROP POLICY IF EXISTS "content_generation_tasks_owner_insert"   ON "content_generation_tasks";
--   DROP POLICY IF EXISTS "webhook_subscriptions_owner_select"      ON "webhook_subscriptions";
--   DROP POLICY IF EXISTS "webhook_subscriptions_owner_insert"      ON "webhook_subscriptions";
--   DROP POLICY IF EXISTS "webhook_subscriptions_owner_update"      ON "webhook_subscriptions";
--   DROP POLICY IF EXISTS "webhook_subscriptions_owner_delete"      ON "webhook_subscriptions";
--   DROP POLICY IF EXISTS "zhs_ai_user_model_chat_config_owner_select" ON "zhs_ai_user_model_chat_config";
--   DROP POLICY IF EXISTS "zhs_ai_user_model_chat_config_owner_insert" ON "zhs_ai_user_model_chat_config";
--   DROP POLICY IF EXISTS "zhs_ai_user_model_chat_config_owner_update" ON "zhs_ai_user_model_chat_config";
--   DROP POLICY IF EXISTS "zhs_ai_user_model_chat_config_owner_delete" ON "zhs_ai_user_model_chat_config";
--   DROP POLICY IF EXISTS "messages_owner_select"                   ON "messages";
--
--   -- b) 收回应用角色的全部权限并删角色(先确认没人还在用 DATABASE_APP_URL 连它)
--   REVOKE ALL ON SCHEMA public FROM ihui_app;
--   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ihui_app;
--   DROP ROLE IF EXISTS ihui_app;
--
--   -- c) 应用侧:把 DATABASE_APP_URL 从环境里去掉即可 —— db/index.ts 会退回
--   --    「受控出口与 db 同池 + 探针打在超级用户上 = scoped 能力 503」的老行为。
--
--   一条命令等价(生成/执行上面 SQL,含 dry-run):
--     node packages/database/scripts/owner-rls.mjs disable [--apply]
-- ============================================================================
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
