-- BYOK 平台模式计费(2026-07-30 立)
-- 1) ai_model_config 加 byok_commission_rate 字段(NUMERIC(5,4),默认 0.1000=10%)
--    含义:BYOK 调用时平台服务费抽成率(用户用自己的 key,平台只收抽成,不碰大厂成本)
--    仅 owner_uuid IS NULL 的全局配置行生效(admin 配置的平台默认抽成率)
-- 2) 幂等:ALTER 前检查字段是否存在

-- =============================================================================
-- ai_model_config 加 BYOK 抽成率字段
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'ai_model_config' AND column_name = 'byok_commission_rate') THEN
    ALTER TABLE ai_model_config ADD COLUMN byok_commission_rate numeric(5,4) DEFAULT 0.1000;
  END IF;
END $$;

COMMENT ON COLUMN ai_model_config.byok_commission_rate IS 'BYOK 平台服务费抽成率(0.10=10%),仅全局配置(owner_uuid IS NULL)生效';
