-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- ============================================================================
-- 20261003103000_chat_messages_created_at_idx_CONCURRENTLY
--
-- ⚠⚠ 这份**不是 drizzle 迁移**,不要登记进 meta/_journal.json,
--    也不要用 `drizzle-kit migrate` 执行它。必须用 psql 手工跑(见下)。
--
--    原因:CREATE INDEX CONCURRENTLY 在 PostgreSQL 里**不可在事务/函数内执行**,
--    而 drizzle-kit 0.31 的 migrate 把整份文件包进单个事务(本仓 82 份迁移都在用
--    `-- statement-breakpoint` 分段,但分段≠独立事务)。登记进 journal 即等于
--    让 migrate 扫到它并把整条迁移链卡死在这一条。
--    仓内既有先例已把这条规矩写在头注里,本份照它办:
--      · 20260906210000_add_perf_indexes.sql:12「若在事务(drizzle-kit migrate)
--        内执行请去掉 CONCURRENTLY」
--      · 20260927170000_point_transactions_user_created_idx.sql:「drizzle-kit
--        migrate 走普通 CREATE INDEX」
--    换言之:**仓内先例是在迁移文件里写普通 CREATE INDEX**(把锁的取舍留给运维),
--    本份是机主要求走 CONCURRENTLY 的例外,所以做成手工脚本而非迁移。
--
-- ── 为什么需要这两个索引 ──────────────────────────────────────────────
-- `data-archive-daily`(每日 04:30)新增了两个删除分支,判据是**纯时间范围**:
--     chat_messages:                DELETE WHERE created_at < now() - 365 天
--     conversation_message_archives: DELETE WHERE created_at < now() - 365 天
-- 而这两张表原有的索引**首列都是 conversation_id**:
--     chat_messages: ix_chat_messages_conversation / idx_chat_messages_by_turn
--     conversation_message_archives: ix_conversation_message_archives_conversation
-- 没有 created_at 索引 ⇒ 每次归档都是全表扫描。chat_messages 是全仓写入量最大
-- 的留存面(每轮对话每条消息都写),全表扇会与在线读争 IO。
-- schema 侧已加(见 packages/database/src/schema/chat.ts 的 createdAtIdx),
-- 本脚本负责把索引真正落进库。
--
-- ── 为什么用 CONCURRENTLY(与仓内先例的差异,取舍记此)──────────────────
-- chat_messages 已有实际数据量,普通 CREATE INDEX 在建索引期间持 SHARE 锁,
-- **阻塞该表上的 INSERT**(即阻塞用户发消息)。CONCURRENTLY 不阻塞读写。
-- 代价:① 建索引期间多一轮全表扫描;② 中途失败会留下 INVALID 索引
--      (不参与查询但**持续拖慢写入**)。本脚本末尾的校验段专门查这个状态。
--
-- ── 实测记录(2026-10-03,本机 PostgreSQL 18.6)────────────────────────
-- 先写的 `DO $$ ... EXECUTE 'CREATE INDEX CONCURRENTLY ...' $$;` 形态
-- **实测不可用**,报错:
--     ERROR:  CREATE INDEX CONCURRENTLY cannot be executed from a function
--     CONTEXT: PL/pgSQL function inline_code_block line 13 at EXECUTE
-- (即 DO/函数体内一律不行,不只是事务问题。)
-- 改为下面的 **psql 元命令 \gexec** 形态后实测通过:两个索引均建出且
-- indisvalid=t / indisready=t;重复执行两次结果一致(幂等)。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 执行方式(整段复制执行,不要拆)
--
--   cd D:/IHUI-AI
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/drizzle/20261003103000_chat_messages_created_at_idx_CONCURRENTLY.sql
--
--   \gexec 是 **psql 元命令**,不是 SQL,只能经 psql 执行 —— 这正是本脚本
--   不能交给 drizzle-kit 的第二个原因(除了事务还有它不认 psql 元命令)。
--   绝对不要用 pgAdmin/某些 GUI 的"运行 SQL"按钮跑它:那些客户端不认 \gexec。
-- ---------------------------------------------------------------------------

-- 步骤 1) 清理:同名索引若存在(尤其是上次中断留下的 INVALID 索引)先 CONCURRENTLY 删掉。
--          用 pg_indexes 查而不是无条件 DROP,是为了让"索引已存在"这种正常情形
--          也能安全重复执行(本脚本幂等的前提)。
SELECT format('DROP INDEX CONCURRENTLY IF EXISTS %I;', indexname)
FROM pg_indexes
WHERE indexname IN (
  'ix_chat_messages_created_at',
  'ix_conversation_message_archives_created_at'
)
\gexec

-- 步骤 2) 建 chat_messages 索引(不存在才建)
SELECT 'CREATE INDEX CONCURRENTLY "ix_chat_messages_created_at" ON "chat_messages" ("created_at");'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes WHERE indexname = 'ix_chat_messages_created_at'
)
\gexec

-- 步骤 3) 建 conversation_message_archives 索引(不存在才建)
SELECT 'CREATE INDEX CONCURRENTLY "ix_conversation_message_archives_created_at" ON "conversation_message_archives" ("created_at");'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes WHERE indexname = 'ix_conversation_message_archives_created_at'
)
\gexec

-- 步骤 4) 校验(**必须看**):两行都该是 t | t
--        indisvalid=f ⇒ 该索引无效(不参与查询但持续拖慢写入)⇒ 重跑本脚本
--        (步骤 1 会先把它 DROP 掉再重建,脚本幂等,直接重跑全量即可)。
SELECT
    c.relname AS index_name,
    i.indisvalid,
    i.indisready,
    pg_size_pretty(pg_relation_size(c.oid)) AS size
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relname IN (
    'ix_chat_messages_created_at',
    'ix_conversation_message_archives_created_at'
);

-- 步骤 5) 确认归档清理真的走上了索引(可选但建议):EXPLAIN 一次清理语句,
--        期望看到 Index Scan / Bitmap Index Scan 而不是 Seq Scan。
-- EXPLAIN DELETE FROM chat_messages WHERE created_at < now() - interval '365 days';
-- 注:DELETE 的 EXPLAIN 不实际执行,只给计划;空表上可能仍显示 Seq Scan
--     (PG 小表本就如此,5000 行以内属正常),别据此判失败 —— 以步骤 4 为准。

-- ---------------------------------------------------------------------------
-- 回滚
--
--   DROP INDEX CONCURRENTLY IF EXISTS "ix_chat_messages_created_at";
--   DROP INDEX CONCURRENTLY IF EXISTS "ix_conversation_message_archives_created_at";
--
-- 回滚后 data-archive-daily 的两个删除分支退化为全表扫描(功能不受影响,只是慢)。
-- schema 侧(chat.ts)的 createdAtIdx 也要一并去掉,否则下次 db:generate 会把
-- 索引重新加回来。
--
-- 附:若你改主意想走仓内主流做法(登记进 journal + drizzle-kit migrate),
--   应把两个索引写成**普通 CREATE INDEX**(去掉 CONCURRENTLY)并登记 ——
--   那才是与本仓 82 份迁移一致的方式,代价是建索引期间锁 chat_messages 的写入。
--   两者取舍见文件头「为什么用 CONCURRENTLY」。
-- ============================================================================
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
