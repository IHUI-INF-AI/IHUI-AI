-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- ============================================================================
-- 20261108093000_chat_messages_conv_created_CONCURRENTLY  (DB-21)
--
-- ⚠ 这份不是 drizzle 迁移,不要登记进 meta/_journal.json,也不要交给
--   `drizzle-kit migrate` 执行(它会把整个文件包进一个事务,CONCURRENTLY 会直接报错)。
--   必须用 psql 手工执行(见文末命令)。
--
-- 缺陷:会话消息列表/双向游标翻页按 (created_at, id) 排序取数,而库里只有
--       conversation_id 单列索引(ix_chat_messages_conversation)与 turn 索引,
--       会话内仍需把整段会话回表排序;会话越长,单次翻页越慢。
-- 现状:复合索引 (conversation_id, created_at, id) 缺失 ⇒ 会话内排序走 Seq Scan/Sort。
--
-- 锁影响:chat_messages 有实际数据量,普通 CREATE INDEX 会持 SHARE 锁并阻塞
--         该表 INSERT(即阻塞用户发消息);CONCURRENTLY 不阻塞读写。
--         代价 = 多一轮全表扫描;中途失败会留下 INVALID 索引(不参与查询但拖慢写入)。
-- ============================================================================

-- 执行方式(psql 元命令 \gexec 只能经 psql 执行):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/scripts/manual-sql/20261108093000_chat_messages_conv_created_CONCURRENTLY.sql

-- 步骤 1) 清理:只 CONCURRENTLY 删掉 **INVALID** 索引(上次中断遗留)。
--          正常索引不动,否则每次幂等执行都会重建一遍全表索引。
SELECT format('DROP INDEX CONCURRENTLY IF EXISTS %I;', c.relname)
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relname IN ('ix_chat_messages_conv_created')
AND NOT i.indisvalid
\gexec

-- 步骤 2) 建索引(不存在才建)
SELECT 'CREATE INDEX CONCURRENTLY "ix_chat_messages_conv_created" ON "chat_messages" ("conversation_id", "created_at", "id");'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes WHERE indexname = 'ix_chat_messages_conv_created'
)
\gexec

-- 步骤 3) 校验:indisvalid / indisready 都应为 t
SELECT c.relname AS index_name, i.indisvalid, i.indisready,
       pg_size_pretty(pg_relation_size(c.oid)) AS size
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relname = 'ix_chat_messages_conv_created';

-- 回滚:DROP INDEX CONCURRENTLY IF EXISTS "ix_chat_messages_conv_created";
--       schema 侧(packages/database/src/schema/chat.ts 的 convCreatedIdx)一并去掉。
-- ============================================================================
