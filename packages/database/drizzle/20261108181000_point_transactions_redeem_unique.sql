-- F-334:旧积分兑换端点并发兜底。
-- 同一用户、同一兑换商品(source='redeem', reference_id='redeem:<itemId>')
-- 只允许一条 spend 流水;唯一索引让并发双扣的第二笔在事务内失败并整体回滚。
--
-- 存量转换:历史数据可能已因旧"最近 20 条"判重缺陷产生同一商品的重复流水。
-- 直接建唯一索引会失败。这里把重复组中 created_at 最晚的行 reference_id 置 NULL:
--   * 保留原始流水(金额/时间/描述不动),不销毁审计证据;
--   * 只解除其对商品兑换归属的占用,使唯一索引可建立;
--   * 副作用不可逆:被置 NULL 的历史行无法从本迁移反推原 reference_id。
-- 回滚:DROP INDEX IF EXISTS "ux_point_transactions_redeem_user_ref";
--       被置 NULL 的 reference_id 需从备份恢复(本迁移不提供自动还原)。
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, reference_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM "point_transactions"
  WHERE "source" = 'redeem' AND "reference_id" IS NOT NULL
)
UPDATE "point_transactions" AS p
SET "reference_id" = NULL
FROM ranked AS r
WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_point_transactions_redeem_user_ref"
  ON "point_transactions" ("user_id", "reference_id")
  WHERE "source" = 'redeem' AND "reference_id" IS NOT NULL;
