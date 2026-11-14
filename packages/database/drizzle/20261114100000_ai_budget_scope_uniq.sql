-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- F-588:ai_budgets 的定位键是 (scope, scope_key, model),但 model 可空 ⇒ 普通索引 /
-- 普通唯一索引都对 NULL 不去重。并发激活(同一用户两笔套餐回调、续费 + 人工补发)下
-- plan-entitlement-service 的「select limit(1) → insert」会各插一行,读取方
-- (plugins/ai-cost.ts)用 .limit(1) 无 ORDER BY 随机取一条,限额时宽时紧。
--
-- 修法:按「有模型 / 无模型」拆两条部分唯一索引,让 upsert 能用
-- `ON CONFLICT (...) WHERE ... DO UPDATE` 在 SQL 侧原子收敛。
--
-- 存量去重(不可逆删除,执行前先备份):
--   CREATE TABLE ai_budgets_bak_20261114 AS SELECT * FROM ai_budgets;
-- 同组保留 updated_at 最新的一行;updated_at 相同保留物理顺序最后一行(ctid 最大)。
-- 回滚:
--   DROP INDEX IF EXISTS "ai_budget_scope_no_model_uniq";
--   DROP INDEX IF EXISTS "ai_budget_scope_model_uniq";
--   被删行需从备份恢复(本迁移不提供自动还原)。
DELETE FROM "ai_budgets" a
USING "ai_budgets" b
WHERE a."scope" = b."scope"
  AND a."scope_key" = b."scope_key"
  AND coalesce(a."model", '') = coalesce(b."model", '')
  AND a."id" <> b."id"
  AND (a."updated_at" < b."updated_at"
       OR (a."updated_at" = b."updated_at" AND a."ctid" > b."ctid"));

-- 无模型维度:user / tenant 预算(同一 scope + scope_key 只允许一行)
CREATE UNIQUE INDEX IF NOT EXISTS "ai_budget_scope_no_model_uniq"
  ON "ai_budgets" USING btree ("scope", "scope_key")
  WHERE "model" IS NULL;

-- 有模型维度:model 预算(同一 scope + scope_key + model 只允许一行)
CREATE UNIQUE INDEX IF NOT EXISTS "ai_budget_scope_model_uniq"
  ON "ai_budgets" USING btree ("scope", "scope_key", "model")
  WHERE "model" IS NOT NULL;
