-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- =============================================================================
-- IHUI-AI 数据库备份专用角色建制(一次性,需一次超管会话)
-- =============================================================================
-- 为什么要有这个文件:
--   pg_hba.conf 在 2026-09-24 04:47 收紧为 local/host 一律 scram-sha-256 之后,
--   deploy\win\ihui-pg-backup.ps1 原先"用 postgres + 显式空口令"的写法失效,
--   备份链自当日 04:39 那份之后再没成功过(09-25 实测:调度日志仍打"备份完成",
--   而目录里 04:47 以后一份 dump 都没有 —— 静默失败的形态见该脚本头部注释)。
--   修法不是把 postgres 口令塞回脚本,而是给备份单独一个低权角色。
--
-- 权限依据(2026-09-25 在 18.6 / ihui_dev 上实测,不是照抄文档):
--   · public 有 949 个关系(表/分区/序列)、drizzle 有 3 个,两者 relowner 全是 ihui;
--   · ihui 自身 rolsuper=f 而 rolbypassrls=t,以它做的 dump 与超管 dump 的 TOC
--     同为 TABLE DATA 716 条(对象 5226 vs 超管基线 5221)⇒ 非超管不会少行;
--   · 库里有 6 张表带 FORCE ROW LEVEL SECURITY,策略键在 session GUC 上,
--     所以备份角色**必须** BYPASSRLS,否则这些表会被策略过滤成空而 pg_dump 完全不报错;
--   · pg_read_all_data 是动态授权(以后新建的表自动覆盖),优于
--     GRANT SELECT ON ALL TABLES IN SCHEMA —— 后者不覆盖之后的迁移新增表,
--     等于给每个 migration 埋一个"备份少一张表"的雷;
--   · ihui_dev 的 datacl 为 NULL(= PUBLIC 默认有 CONNECT/TEMP),所以下面的
--     GRANT CONNECT 是前瞻性的(若日后收紧 ACL,本角色不受影响),当前非必需;
--   · 本机 psql / pg_dump 均为 18.6,与服务端同版本。
--
-- 怎么跑(本机没有任何可达的超管凭据:密钥目录里查过没有,postgres 空口令已被
-- scram 拒,ihui 角色 rolcreaterole=f —— 所以这一步只能由持有超管口令的人做一次):
--   1. 把下面的 '<REPLACE_ME>' 换成一把随机长口令(32 位以上即可,无需记忆);
--   2. 用超管会话执行本文件(psql 在 D:\DevEnv\runtimes\pgsql\bin):
--        psql.exe -h localhost -p 8810 -U postgres -d ihui_dev -f deploy\win\ihui-pg-backup-role.sql
--   3. 把口令写成**一行裸文本**存进 §5d 的凭据权威目录(盘符由 scripts/lib/key-dir.mjs
--      探测;先跑 `node scripts/secret-path.mjs db-backup ihui-backup.txt` 取确切路径,
--      它只打印路径、绝不打印内容)。子目录名用 ASCII `db-backup`:实测本机中文 argv
--      其实无损(该 .ps1 无 BOM UTF-8,经服务实际用的 powershell.exe —— 在 Windows 11
--      26200 上产品版本已是 7.6.2 —— 传给 node 后 hex 逐字节一致),选 ASCII 只为让
--      "解释器版本/控制台代码页"这类未证差异不可能影响一条功能参数。
--      该文件不得入库、不得贴进聊天记录、不得进任何 .log;
--   4. 跑第 5 段的验收(两个计数须与超管对照一致);
--   5. 通过后 `nssm restart IHUI-PG-BACKUP`,再确认 D:\DevEnv\backups\pg 有今天的 dump。
--   口令也可以完全不走文件,改由服务环境块给 IHUI_DB_BACKUP_USER / IHUI_DB_BACKUP_PASSWORD
--   (注意 `nssm set AppEnvironmentExtra` 是**整块覆盖**语义,事务式改法见 AGENTS.md §5e)。
--
-- 本文件只含 CREATE/GRANT 语句,口令是占位符 ⇒ 本身不含机密,可以入库。
-- =============================================================================

BEGIN;

-- 一次性建制,故不用 DO/EXECUTE 包一层幂等。若本角色已存在,第一条语句会报
-- `ERROR: role "ihui_backup" already exists` —— psql 默认 ON_ERROR_STOP=off,
-- 后续 ALTER/GRANT 照样执行,这句报错无害;想干净重跑就只删掉 CREATE ROLE 那一行。
CREATE ROLE ihui_backup;

ALTER ROLE ihui_backup WITH
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION
    INHERIT                     -- 必须 INHERIT:NOINHERIT 成员拿不到 pg_read_all_data 的权限,
                                -- 表现为"角色能连上却读不到任何表",是最难查的一种配错
    CONNECTION LIMIT 2          -- 备份是单线程任务,2 已足够;限制失控连接
    PASSWORD '<REPLACE_ME>';    -- ← 第 1 步替换成真实随机口令

-- 读权限:schema USAGE + 全部表/视图/序列 SELECT,且自动覆盖以后新增的对象
GRANT pg_read_all_data TO ihui_backup;

-- 关键:绕过 RLS。缺这一条时 6 张 FORCE RLS 表会 dump 成空数据,而不报任何错。
ALTER ROLE ihui_backup BYPASSRLS;

-- 前瞻性加固(当前 ihui_dev.datacl=NULL,本条非必需;日后收紧 ACL 时才起作用)
GRANT CONNECT ON DATABASE ihui_dev TO ihui_backup;

COMMIT;

-- 自查:角色属性应为 f|f|f|t|f|t(rolsuper|createdb|createrole|canlogin|replication|bypassrls)
-- SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin, rolreplication, rolbypassrls
--   FROM pg_roles WHERE rolname = 'ihui_backup';

-- =============================================================================
-- 第 5 段 · 验收(整段贴进 pwsh 跑;两条 TABLE DATA 计数必须相等,
-- 明显变小 = 有表被 RLS 吃掉;报 0 = 角色没连上或权限不足)
-- 实测基线:超管 04:39 那份 = 对象 5221 / TABLE DATA 716。
-- 落点用项目内 .ihui-agent\tmp,不用 $env:TEMP(§15b;服务身份的 TEMP 还在 C 盘)。
-- =============================================================================
-- $pg  = 'D:\DevEnv\runtimes\pgsql\bin'
-- $scr = 'D:\IHUI-AI\.ihui-agent\tmp\role-probe.dump'
-- function Get-TocStat($f) {
--     $t = & "$pg\pg_restore.exe" -l $f 2>$null
--     '{0}  对象={1}  TABLE DATA={2}' -f (Split-Path $f -Leaf),
--         (@($t | Where-Object { $_ -notmatch '^;' }).Count),
--         (@($t | Where-Object { $_ -match '\bTABLE DATA\b' }).Count)
-- }
-- $env:PGPASSWORD = '<刚设的口令>'
-- & "$pg\pg_dump.exe" -w -Fc -h localhost -p 8810 -U ihui_backup -d ihui_dev `
--     --no-owner --no-privileges -f $scr
-- Get-TocStat $scr                                                  # 新角色
-- Get-TocStat (Get-ChildItem 'D:\DevEnv\backups\pg\ihui_dev_*.dump' |
--     Sort-Object LastWriteTime -Descending | Select-Object -First 1)  # 超管对照
-- Remove-Item $scr -Force
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
