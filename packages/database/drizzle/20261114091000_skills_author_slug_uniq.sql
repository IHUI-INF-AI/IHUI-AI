-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- F-175:skills 的 (author_id, slug) 是 CLI push / db-sync 的逻辑主键,但库里一直没有唯一约束,
-- 而 upsertSkillBySlug 是"先查后写"。两台设备并发 push 同一 slug 时两边都查到"不存在"
-- ⇒ 各插一行;之后所有 limit(1) 读随机命中其中一条,内容与软删语义长期漂移。
-- 本迁移:先清存量重复,再补唯一索引。应用侧已改为
--   INSERT INTO skills ... ON CONFLICT (author_id, slug) DO UPDATE ...
--
-- 去重保留规则:活行(deleted_at IS NULL)优先 → updated_at 最新 → 物理位置最后一行;
-- 被删的是同 (author_id, slug) 的重复副本,内容由保留下来的那行代表。
-- author_id / slug 为 NULL 的行不参与去重(唯一索引里 NULL 互不相等,不会冲突)。
--
-- 上线运维动作:
-- 1) 去重是不可逆删除,执行前先备份:
--      CREATE TABLE skills_bak_20261114 AS SELECT * FROM skills;
-- 2) 建索引非 CONCURRENTLY,持 SHARE 锁、阻塞该表写入;skills 量级小,建议低峰执行。
-- 3) 回滚:DROP INDEX IF EXISTS "skills_author_slug_uniq";被删行需从备份恢复。
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY author_id, slug
           ORDER BY (deleted_at IS NULL) DESC, updated_at DESC, ctid DESC
         ) AS rn
  FROM "skills"
  WHERE author_id IS NOT NULL AND slug IS NOT NULL
)
DELETE FROM "skills" s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "skills_author_slug_uniq"
  ON "skills" USING btree ("author_id", "slug");
