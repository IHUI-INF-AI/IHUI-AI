-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- F-355:coze_variables 的逻辑主键是 (bot_id, variable_name),但表上无唯一约束、create 是纯
-- INSERT ⇒ 同一个 bot 的同名变量连点两次 create 就落两行;而 retrieve 用 `.limit(1)` 且没有
-- ORDER BY ⇒ 读到哪一行由物理顺序决定(变量值含密钥时等于随机给出旧值)。
-- 本迁移:先去重,再补唯一索引。应用侧 createCozeVariable 已改为
--   INSERT ... ON CONFLICT (bot_id, variable_name) DO UPDATE ...
-- retrieve 查询已补 ORDER BY updated_at DESC, id DESC。
--
-- 去重保留规则:updated_at 最新 → created_at 最新 → 物理位置最后一行。
-- 上线运维动作:
-- 1) 去重是不可逆删除,执行前先备份:
--      CREATE TABLE coze_variables_bak_20261114 AS SELECT * FROM coze_variables;
-- 2) 建索引非 CONCURRENTLY,会短暂持表锁(表量级很小)。
-- 3) 回滚:DROP INDEX IF EXISTS "coze_variables_bot_name_uniq";被删行需从备份恢复。
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY bot_id, variable_name
           ORDER BY updated_at DESC, created_at DESC, ctid DESC
         ) AS rn
  FROM "coze_variables"
)
DELETE FROM "coze_variables" c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "coze_variables_bot_name_uniq"
  ON "coze_variables" USING btree ("bot_id", "variable_name");
