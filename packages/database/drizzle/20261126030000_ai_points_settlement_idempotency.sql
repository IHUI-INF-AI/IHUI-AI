-- AI 用量积分结算的并发幂等索引。
-- 应用层 `settlePointsUsage` 已在事务内 SELECT 查重;本索引是数据库兜底,
-- 防止异步回调/重复投递在并发窗口内对同一 referenceId 双扣。
CREATE UNIQUE INDEX IF NOT EXISTS "ux_point_transactions_ai_settlement_ref"
  ON "point_transactions" ("user_id", "source", "reference_id")
  WHERE "type" = 'spend'
    AND "source" IN ('llm_chat', 'crew_llm', 'stock_analysis', 'ai_career_advice', 'coze_workflow_chat')
    AND "reference_id" IS NOT NULL;
