-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- ============================================================================
-- 20261108093500_analytics_events_created_at_CONCURRENTLY  (DB-22)
--
-- ⚠ 不是 drizzle 迁移,不要登记进 journal;CONCURRENTLY 必须在 psql 手工执行。
--
-- 缺陷:analytics_events 列表(/api/admin/analytics/events/list)按 created_at DESC
--       分页、可按 event 过滤;schema 里只有 user_id 索引,时间序分页退化为
--       全表扫描 + Sort,offset 越深越慢;按事件筛选后同样要全表扫。
-- 补两个索引:
--   analytics_events_created_at_idx           (created_at)               —— 纯时间序分页
--   analytics_events_event_created_at_idx     (event, created_at)        —— 事件筛选 + 时间序
--
-- 锁影响:analytics_events 为高写入埋点表,普通 CREATE INDEX 建索引期间
--         持 SHARE 锁阻塞 INSERT(即阻塞埋点写入);CONCURRENTLY 不阻塞读写。
--         代价 = 多一轮全表扫描;失败残留 INVALID 索引需按步骤 1 重跑清理。
-- ============================================================================

-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/scripts/manual-sql/20261108093500_analytics_events_created_at_CONCURRENTLY.sql

-- 步骤 1) 幂等清理:只删 INVALID 索引(上次中断遗留),正常索引不动
SELECT format('DROP INDEX CONCURRENTLY IF EXISTS %I;', c.relname)
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relname IN (
  'analytics_events_created_at_idx',
  'analytics_events_event_created_at_idx'
)
AND NOT i.indisvalid
\gexec

-- 步骤 2) 建时间序索引
SELECT 'CREATE INDEX CONCURRENTLY "analytics_events_created_at_idx" ON "analytics_events" ("created_at");'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes WHERE indexname = 'analytics_events_created_at_idx'
)
\gexec

-- 步骤 3) 建事件+时间序索引
SELECT 'CREATE INDEX CONCURRENTLY "analytics_events_event_created_at_idx" ON "analytics_events" ("event", "created_at");'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes WHERE indexname = 'analytics_events_event_created_at_idx'
)
\gexec

-- 步骤 4) 校验:两行 indisvalid / indisready 都应为 t
SELECT c.relname AS index_name, i.indisvalid, i.indisready,
       pg_size_pretty(pg_relation_size(c.oid)) AS size
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relname IN (
  'analytics_events_created_at_idx',
  'analytics_events_event_created_at_idx'
);

-- 回滚:DROP INDEX CONCURRENTLY IF EXISTS "analytics_events_created_at_idx";
--       DROP INDEX CONCURRENTLY IF EXISTS "analytics_events_event_created_at_idx";
-- ============================================================================
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
