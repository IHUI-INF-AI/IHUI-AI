-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- =============================================================================
-- 灾难恢复第 0 步:先建角色,再还原 dump(2026-09-27 实测逼出来的一个空档)
--
-- 为什么需要这个文件(不是"文档补一句",是"少跑一步就还原失败"):
--   每日备份是 **单库** `pg_dump -Fc`。单库 dump 的结构上不含任何**集群级**对象:
--   角色本身、角色成员关系、表空间、每库 GUC。实测本机 2026-09-27 的 dump 全文
--   362 MB / 968,424 行里 `CREATE ROLE` **0 条** —— 而它的 TOC 里有
--   **723 条 `ALTER TABLE … OWNER TO ihui`** 和 235 条 `ALTER SEQUENCE … OWNER TO ihui`。
--   ⇒ 在一个干净集群上直接 `pg_restore` 这 958 条会逐条报
--     `ERROR: role "ihui" does not exist`,对象虽然建得出来,
--     **属主全部落空**,而 pg_restore 默认非单事务时仍会打"完成"。
--   同理 `GRANT … TO ihui_app` 的 5 条(见下)也必须有角色在位才落得下去。
--
-- 实测对照(2026-09-27,演练库 ihui_restore_drill_20260927,超管单事务还原):
--   还原后 720/720 张表属主 = ihui、RLS 策略 79 条与生产 md5 逐字相同
--   (02624eaba30a294f5fd69a89d98b6151)、`ihui_app` 的表级授权 11 项复现、
--   `ihui_app` 查 `users` 得到 `permission denied for table users`(即权限收窄面也复原了)。
--   那次之所以能成功,是因为这台机上角色**本来就在**;干净集群上不会。
--
-- 这个文件只含 CREATE ROLE / ALTER ROLE / GRANT 语句,**口令一律是占位符**
-- ⇒ 本身不含机密,可以入库。真实口令按 AGENTS.md §5d 放在网盘凭据目录的
--   按用途分子目录里(路径用 `node scripts/secret-path.mjs <子目录> <文件>` 取,
--   该出口只打印路径、绝不打印内容),不入仓、不入日志、不入聊天记录。
--
-- 执行(超管会话;psql 在 D:\DevEnv\runtimes\pgsql\bin):
--   psql.exe -h localhost -p 8810 -U postgres -d postgres `
--     -v ON_ERROR_STOP=1 -f deploy\win\ihui-pg-restore-prereq.sql
--   然后再:pg_restore -D <目标库> --single-transaction <dump 文件>
--   注:库本身要先建(`CREATE DATABASE`),dump 里没有建库语句(实测 0 条)。
--
-- 与 deploy/win/ihui-pg-backup-role.sql 的分工:那份只造**只读备份角色** beifen
--   (含 pg_read_all_data 成员关系与 BYPASSRLS),本份造**应用侧**两个角色。
--   两份合起来才是"角色面复原";任何一份单独执行都不完整。
-- =============================================================================

-- 角色属性一律按 2026-09-27 从生产 pg_roles 现量抄录(不是推测):
--   ihui      rolcreatedb=t  rolbypassrls=t  rolsuper=f  rolcreaterole=f  connlimit=-1
--   ihui_app  全 f(仅 LOGIN),它的可见面只由下面 5 条 GRANT 决定
-- 已存在时报 `role already exists` 即视为该步已完成(本文件用于"新机/重建集群",
-- 在既有集群上重跑只应该看到这一条报错,其余语句幂等)。

-- ── 1) 应用属主角色:723 张表 + 235 个序列的 OWNER TO 都指向它 ──
CREATE ROLE ihui;
ALTER ROLE ihui WITH
    LOGIN
    NOSUPERUSER
    CREATEDB          -- 实测在位;迁移流程需要,去掉会让 drizzle-kit migrate 失败
    NOCREATEROLE
    NOREPLICATION
    BYPASSRLS         -- 实测在位;去掉后应用会看不见被 RLS 遮蔽的行(症状是"数据莫名少一半")
    CONNECTION LIMIT -1;
-- 口令:执行时替换成 §5d 凭据目录里那把,不在本文件出现
-- ALTER ROLE ihui WITH PASSWORD '<REPLACE_ME>';

-- ── 2) 收窄权限的应用角色:apps/api 的 DATABASE_APP_URL 与 packages/database 的
--        read-replica 路径用它;它**不是**属主,所以一切访问都来自 GRANT ──
CREATE ROLE ihui_app;
ALTER ROLE ihui_app WITH
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION
    NOBYPASSRLS
    CONNECTION LIMIT -1;
-- ALTER ROLE ihui_app WITH PASSWORD '<REPLACE_ME>';

-- ── 3) ihui_app 的实际授权面(2026-09-27 从生产现量,共 5 条语句 / 11 项表级权限)──
--     这一组就是"备份里曾经没有、现在才有"的那一层:自 2026-09-27 起 dump 才带 ACL
--     (deploy/win/ihui-pg-backup.ps1 去掉了 pg_dump 的 --no-privileges)。
--     所以本段的作用是**双保险**:即使拿到的是去掉该旗标之前产出的旧 dump,
--     恢复出来的库也照这份清单重建权限。
GRANT USAGE ON SCHEMA public TO ihui_app;
GRANT SELECT, INSERT ON TABLE public.content_generation_tasks TO ihui_app;
GRANT SELECT ON TABLE public.messages TO ihui_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.webhook_subscriptions TO ihui_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.zhs_ai_user_model_chat_config TO ihui_app;

-- ── 4) 验收(还原后跑,四个数必须同时对上)──
-- SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--   WHERE n.nspname='public' AND c.relkind='r' AND relowner='ihui'::regrole;   -- 应= 表总数(本次 720)
-- SELECT count(*) FROM pg_policies WHERE schemaname='public';                  -- 应= 79
-- SELECT count(*) FROM information_schema.role_table_grants
--   WHERE grantee='ihui_app' AND table_schema='public';                        -- 应= 11
-- SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--   WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity;           -- 应= 14

-- =============================================================================
-- 仍未被任何备份覆盖的集群级对象(如实登记,别读成"角色面已全盖住"):
--   · 角色成员关系里 beifen -> pg_read_all_data:由 ihui-pg-backup-role.sql 重建 ✅
--   · 表空间:本机实测 dump 内 0 条 TABLESPACE 引用,生产未用自定义表空间 ⇒ 无需求
--   · 每库/每角色 GUC(pg_db_role_setting):实测 0 行 ⇒ 无需求
--   · 其它数据库(keycloak / ihui_ci_test / ihui_e2e):**各自需要单独 dump**,
--     现在的每日备份只覆盖 ihui_dev 一个库 —— 这一格是已知未覆盖范围,不在本文件能力内。
-- 若将来引入 pg_hba 之外的连接限制、或给 ihui_app 再加授权,**必须同一枚提交里
-- 更新本文件第 3 段**,否则干净集群恢复出来的权限面会比线上窄(症状:某功能"恢复后 403")。
-- =============================================================================
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
