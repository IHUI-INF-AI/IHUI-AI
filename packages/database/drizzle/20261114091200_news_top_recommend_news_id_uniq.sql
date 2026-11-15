-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- F-354:news_tops / news_recommends 的 news_id 只有 NOT NULL、没有唯一约束,而路由是
-- 「findNewsTopByNewsId 为空 → createNewsTop」的 check-then-act ⇒ 管理员并发两次
-- PUT /news/articles/:id/top(或 /recommend)会落两行同一 news_id:公开列表重复展示、
-- 取消置顶删多行、改 sort 只回写第一行。按 newsId 批量 delete/update 的写法本来就假定唯一。
-- 本迁移:先去重,再补 UNIQUE(news_id)。应用侧 createNewsTop/createNewsRecommend 已改为
--   INSERT ... ON CONFLICT (news_id) DO UPDATE ...
-- 列表查询(findNewsTopList/findNewsRecommendList)另按 newsId 去重,兼容「代码先发、
-- 迁移后跑」的窗口期。
--
-- 去重保留规则:sort 更小(展示更靠前)优先 → created_at 更晚 → 物理位置最后一行。
-- 上线运维动作:
-- 1) 去重是不可逆删除,执行前先备份:
--      CREATE TABLE news_tops_bak_20261114 AS SELECT * FROM news_tops;
--      CREATE TABLE news_recommends_bak_20261114 AS SELECT * FROM news_recommends;
-- 2) 建索引非 CONCURRENTLY,会短暂持表锁(两张表量级很小)。
-- 3) 回滚:DROP INDEX IF EXISTS "news_tops_news_id_uniq";
--         DROP INDEX IF EXISTS "news_recommends_news_id_uniq";
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY news_id
           ORDER BY sort ASC, created_at DESC, ctid DESC
         ) AS rn
  FROM "news_tops"
)
DELETE FROM "news_tops" t
USING ranked r
WHERE t.id = r.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY news_id
           ORDER BY sort ASC, created_at DESC, ctid DESC
         ) AS rn
  FROM "news_recommends"
)
DELETE FROM "news_recommends" n
USING ranked r
WHERE n.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "news_tops_news_id_uniq"
  ON "news_tops" USING btree ("news_id");

CREATE UNIQUE INDEX IF NOT EXISTS "news_recommends_news_id_uniq"
  ON "news_recommends" USING btree ("news_id");
