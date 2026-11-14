-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- F-358:orders 只有 user_id / status / order_type 三枚单列索引,而财务与 BI 聚合的口径是
--   WHERE status = 'paid' AND paid_at >= now() - interval ...   GROUP BY 天   (bi-dashboard 营收趋势)
--   WHERE status = 'paid' AND created_at >= ...                                (admin/stats 本月/今日营收)
-- paid_at / created_at 都没有索引 ⇒ 看板与财报接口随订单表增长线性变慢。
-- 补两枚复合索引(前导列 = 等值条件列,次列 = 范围/tie 列):
--   orders_status_paid_at_idx   (status, paid_at)     —— 营收按天聚合
--   orders_user_created_at_idx  (user_id, created_at) —— 用户维度按时间范围查单
-- 不单独建 (paid_at) / (created_at):单列范围扫描缺 status / user_id 谓词,选择性更差。
--
-- 上线运维动作:
-- 1) 非 CONCURRENTLY 建索引,期间持 SHARE 锁、阻塞写入。orders 已很大时请改用
--    packages/database/scripts/manual-sql/ 下的 CONCURRENTLY 版本手工建。
-- 2) 回滚:DROP INDEX IF EXISTS "orders_status_paid_at_idx";
--         DROP INDEX IF EXISTS "orders_user_created_at_idx";
CREATE INDEX IF NOT EXISTS "orders_status_paid_at_idx"
  ON "orders" USING btree ("status", "paid_at");

CREATE INDEX IF NOT EXISTS "orders_user_created_at_idx"
  ON "orders" USING btree ("user_id", "created_at");
