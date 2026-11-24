-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 20260921200000: vip_levels 去重 + level_name 唯一约束
-- 背景: 0037 种子 INSERT ... ON CONFLICT DO NOTHING 依赖唯一约束防重,但 vip_levels 表
-- 没有任何唯一约束 → 迁移文件被重放时(实锤 2026-09-06 两次)每个套餐重复插入 2 份,
-- /vip 页面订阅卡片成倍重复。本迁移: ①归并引用 ②删除重复行(每组保留最早创建)
-- ③加 level_name 唯一约束,此后任何重放(含 0037 种子)都会被约束真正挡住。

-- 1. user_vips 引用归并到保留行(物理外键 ON DELETE SET NULL,须先迁移引用)
WITH kept AS (
  SELECT DISTINCT ON (level_name) id AS kept_id, level_name
  FROM "vip_levels"
  ORDER BY level_name, created_at ASC, id ASC
), doomed AS (
  SELECT v.id AS doomed_id, k.kept_id
  FROM "vip_levels" v
  JOIN kept k ON k.level_name = v.level_name AND k.kept_id <> v.id
)
UPDATE "user_vips" uv
SET vip_level_id = d.kept_id, updated_at = now()
FROM doomed d
WHERE uv.vip_level_id = d.doomed_id;

--> statement-breakpoint

-- 2. orders.product_id 逻辑引用归并(varchar, 无物理外键)
WITH kept AS (
  SELECT DISTINCT ON (level_name) id AS kept_id, level_name
  FROM "vip_levels"
  ORDER BY level_name, created_at ASC, id ASC
), doomed AS (
  SELECT v.id AS doomed_id, k.kept_id
  FROM "vip_levels" v
  JOIN kept k ON k.level_name = v.level_name AND k.kept_id <> v.id
)
UPDATE "orders" o
SET product_id = d.kept_id::text
FROM doomed d
WHERE o.product_id = d.doomed_id::text;

--> statement-breakpoint

-- 3. 删除重复行
WITH kept AS (
  SELECT DISTINCT ON (level_name) id AS kept_id, level_name
  FROM "vip_levels"
  ORDER BY level_name, created_at ASC, id ASC
), doomed AS (
  SELECT v.id AS doomed_id
  FROM "vip_levels" v
  JOIN kept k ON k.level_name = v.level_name AND k.kept_id <> v.id
)
DELETE FROM "vip_levels" v USING doomed d WHERE v.id = d.doomed_id;

--> statement-breakpoint

-- 4. level_name 唯一约束(幂等)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vip_levels_level_name_unique') THEN
    ALTER TABLE "vip_levels" ADD CONSTRAINT "vip_levels_level_name_unique" UNIQUE ("level_name");
  END IF;
END $$;
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
