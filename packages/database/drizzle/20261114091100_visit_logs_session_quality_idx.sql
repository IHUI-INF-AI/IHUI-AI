-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- F-305:会话质量统计(session-quality-stats-service)的 24h 窗口聚合按 created_at 过滤、
-- 按 session_id 分组、组内 array_agg 按 (created_at, id) 排序;而 visit_logs 上只有
-- (visit_date) 与 (ip, city) 两枚索引 ⇒ 大屏每 5s 三条腿各扫一次全表。
-- 补两枚索引:
--   visit_logs_created_at_idx       —— 覆盖 `created_at >= now() - interval ...` 的 range 过滤;
--   visit_logs_session_created_idx  —— 覆盖 GROUP BY session_id + 组内按 created_at 排序。
-- 不建 (created_at, session_id) 复合索引:过滤列在前、分组列在后时分组仍要重排,
-- 这两枚已分别覆盖「筛行」与「分组/组内排序」两个动作。
--
-- 上线运维动作:
-- 1) 本迁移内为非 CONCURRENTLY 建索引,期间持 SHARE 锁、阻塞该表写入。
--    visit_logs 是高频写入的大表,生产请放维护窗口执行,或改用
--    packages/database/scripts/manual-sql/ 下的 CONCURRENTLY 版本手工建。
-- 2) 回滚:DROP INDEX IF EXISTS "visit_logs_created_at_idx";
--          DROP INDEX IF EXISTS "visit_logs_session_created_idx";
CREATE INDEX IF NOT EXISTS "visit_logs_created_at_idx"
  ON "visit_logs" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "visit_logs_session_created_idx"
  ON "visit_logs" USING btree ("session_id", "created_at");
