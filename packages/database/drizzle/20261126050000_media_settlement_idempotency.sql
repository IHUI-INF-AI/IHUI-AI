-- 媒体生成积分结算的并发幂等:同一用户 + ai_media + reference_id 只允许一条 spend 流水。
-- 与 20261126030000_ai_points_settlement_idempotency 的 LLM 索引分开,避免不同 source 共用谓词。
CREATE UNIQUE INDEX IF NOT EXISTS ux_point_transactions_media_settlement_ref
  ON point_transactions (user_id, source, reference_id)
  WHERE type = 'spend' AND source = 'ai_media' AND reference_id IS NOT NULL;
