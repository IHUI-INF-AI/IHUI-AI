-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- ============================================================================
-- 20261108094000_edu_orders_created_at_CONCURRENTLY  (DB-23)
--
-- ⚠ 不是 drizzle 迁移,不要登记进 journal;CONCURRENTLY 必须在 psql 手工执行。
--
-- 缺陷:订单列表按 created_at DESC, id DESC 排序分页(修复前是 uuid 主键倒序);
--       schema 现有索引只有 user_id / status / order_type 单列,时间序分页
--       在大表上是 Seq Scan + Sort。补:
--   edu_orders_user_created_at_idx  (user_id, created_at) —— 用户我的订单 + 时间序
--   edu_orders_created_at_idx       (created_at)          —— 管理端全量时间序
--
-- 锁影响:edu_orders 有实际数据,普通 CREATE INDEX 建索引期间持 SHARE 锁阻塞
--         下单写入;CONCURRENTLY 不阻塞读写。代价 = 多一轮全表扫描;
--         中途失败会留下 INVALID 索引,重跑步骤 1 会先清理。
-- ============================================================================

-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/scripts/manual-sql/20261108094000_edu_orders_created_at_CONCURRENTLY.sql

-- 步骤 1) 幂等清理:只删 INVALID 索引(上次中断遗留),正常索引不动
SELECT format('DROP INDEX CONCURRENTLY IF EXISTS %I;', c.relname)
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relname IN (
  'edu_orders_user_created_at_idx',
  'edu_orders_created_at_idx'
)
AND NOT i.indisvalid
\gexec

-- 步骤 2) 用户订单时间序索引
SELECT 'CREATE INDEX CONCURRENTLY "edu_orders_user_created_at_idx" ON "edu_orders" ("user_id", "created_at");'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes WHERE indexname = 'edu_orders_user_created_at_idx'
)
\gexec

-- 步骤 3) 全量时间序索引
SELECT 'CREATE INDEX CONCURRENTLY "edu_orders_created_at_idx" ON "edu_orders" ("created_at");'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes WHERE indexname = 'edu_orders_created_at_idx'
)
\gexec

-- 步骤 4) 校验:两行 indisvalid / indisready 都应为 t
SELECT c.relname AS index_name, i.indisvalid, i.indisready,
       pg_size_pretty(pg_relation_size(c.oid)) AS size
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relname IN (
  'edu_orders_user_created_at_idx',
  'edu_orders_created_at_idx'
);

-- 回滚:DROP INDEX CONCURRENTLY IF EXISTS "edu_orders_user_created_at_idx";
--       DROP INDEX CONCURRENTLY IF EXISTS "edu_orders_created_at_idx";
-- ============================================================================
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
