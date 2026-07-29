-- P0-5 模型 API 中转站(2026-07-29 立)
-- 1) developer_api_keys 加计费字段(tokenBalance/costBalanceCents/tokenUsedTotal/costUsedTotalCents)
-- 2) ai_model_config_models 加中转站字段(isRelayPublic/relayPriceMultiplier/relaySortOrder/relayDisplayName)
-- 3) 新表 ai_relay_key_pool(同 provider 多 key 负载均衡/故障转移)
-- 4) 新表 ai_relay_discovery(动态发现待审批)
-- 幂等:每条 ALTER 前检查字段是否存在;CREATE TABLE IF NOT EXISTS

-- =============================================================================
-- 1. developer_api_keys 加计费字段
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'developer_api_keys' AND column_name = 'token_balance') THEN
    ALTER TABLE developer_api_keys ADD COLUMN token_balance bigint NOT NULL DEFAULT -1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'developer_api_keys' AND column_name = 'cost_balance_cents') THEN
    ALTER TABLE developer_api_keys ADD COLUMN cost_balance_cents integer NOT NULL DEFAULT -1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'developer_api_keys' AND column_name = 'token_used_total') THEN
    ALTER TABLE developer_api_keys ADD COLUMN token_used_total bigint NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'developer_api_keys' AND column_name = 'cost_used_total_cents') THEN
    ALTER TABLE developer_api_keys ADD COLUMN cost_used_total_cents integer NOT NULL DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN developer_api_keys.token_balance IS 'P0-5 中转站 Token 余额(-1=无限,0=耗尽,>0=可用)';
COMMENT ON COLUMN developer_api_keys.cost_balance_cents IS 'P0-5 中转站成本余额(分,-1=无限,0=耗尽,>0=可用)';
COMMENT ON COLUMN developer_api_keys.token_used_total IS 'P0-5 中转站已用 token 累计(统计用,不回退)';
COMMENT ON COLUMN developer_api_keys.cost_used_total_cents IS 'P0-5 中转站已用成本累计(分,统计用,不回退)';

-- =============================================================================
-- 2. ai_model_config_models 加中转站字段
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'ai_model_config_models' AND column_name = 'is_relay_public') THEN
    ALTER TABLE ai_model_config_models ADD COLUMN is_relay_public boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'ai_model_config_models' AND column_name = 'relay_price_multiplier') THEN
    ALTER TABLE ai_model_config_models ADD COLUMN relay_price_multiplier varchar(20) DEFAULT '1.0000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'ai_model_config_models' AND column_name = 'relay_sort_order') THEN
    ALTER TABLE ai_model_config_models ADD COLUMN relay_sort_order integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'ai_model_config_models' AND column_name = 'relay_display_name') THEN
    ALTER TABLE ai_model_config_models ADD COLUMN relay_display_name varchar(256);
  END IF;
END $$;

COMMENT ON COLUMN ai_model_config_models.is_relay_public IS 'P0-5 中转站是否公开上架(/v1/models 返回此模型)';
COMMENT ON COLUMN ai_model_config_models.relay_price_multiplier IS 'P0-5 中转站定价倍率(1.0=原价,1.2=加价20%),numeric(10,4)';
COMMENT ON COLUMN ai_model_config_models.relay_sort_order IS 'P0-5 中转站展示排序(越小越靠前)';
COMMENT ON COLUMN ai_model_config_models.relay_display_name IS 'P0-5 中转站展示名(为空时用 display_name/model_id)';

-- 索引(幂等)
CREATE INDEX IF NOT EXISTS ai_model_config_models_relay_public_idx ON ai_model_config_models (is_relay_public);

-- =============================================================================
-- 3. 新表 ai_relay_key_pool(中转站 Key 池)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "ai_relay_key_pool" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code varchar(64) NOT NULL,
  name varchar(128) NOT NULL,
  api_key_enc text NOT NULL,
  key_prefix varchar(32),
  priority integer NOT NULL DEFAULT 0,
  weight integer NOT NULL DEFAULT 1,
  is_enabled boolean NOT NULL DEFAULT true,
  health_status varchar(16) NOT NULL DEFAULT 'unknown',
  health_checked_at timestamptz,
  last_error_message text,
  balance_cents integer DEFAULT -1,
  remark text,
  extra_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_relay_key_pool_provider_idx ON ai_relay_key_pool (provider_code);
CREATE INDEX IF NOT EXISTS ai_relay_key_pool_enabled_idx ON ai_relay_key_pool (is_enabled);
CREATE INDEX IF NOT EXISTS ai_relay_key_pool_priority_idx ON ai_relay_key_pool (priority);

COMMENT ON TABLE ai_relay_key_pool IS 'P0-5 中转站 Key 池(同 provider 多 key 负载均衡/故障转移)';
COMMENT ON COLUMN ai_relay_key_pool.provider_code IS '关联 ai_model_config.provider_code(同 provider 的多 key 池)';
COMMENT ON COLUMN ai_relay_key_pool.api_key_enc IS '加密的上游 API Key(同 aiModelConfig.apiKeyEnc 模式)';
COMMENT ON COLUMN ai_relay_key_pool.priority IS '优先级(越小越优先,0=最高)';
COMMENT ON COLUMN ai_relay_key_pool.weight IS '权重(同优先级内加权随机,默认 1)';
COMMENT ON COLUMN ai_relay_key_pool.health_status IS '健康状态:unknown/healthy/degraded/down';

-- =============================================================================
-- 4. 新表 ai_relay_discovery(中转站动态发现待审批)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "ai_relay_discovery" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code varchar(64) NOT NULL,
  model_id varchar(128) NOT NULL,
  model_name varchar(256),
  context_length integer,
  upstream_price jsonb,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text,
  status varchar(16) NOT NULL DEFAULT 'discovered',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  approved_model_row_id bigint,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_relay_discovery_provider_model_unique UNIQUE (provider_code, model_id)
);

CREATE INDEX IF NOT EXISTS ai_relay_discovery_provider_idx ON ai_relay_discovery (provider_code);
CREATE INDEX IF NOT EXISTS ai_relay_discovery_status_idx ON ai_relay_discovery (status);

COMMENT ON TABLE ai_relay_discovery IS 'P0-5 中转站动态发现待审批(从上游拉取新模型→待审批→入库上架)';
COMMENT ON COLUMN ai_relay_discovery.status IS 'discovered/pending/approved/rejected';
COMMENT ON COLUMN ai_relay_discovery.upstream_price IS '上游定价快照(JSON,如 {input:0.5,output:1.5,currency:CNY})';
COMMENT ON COLUMN ai_relay_discovery.approved_model_row_id IS '审批通过后写入 ai_model_config_models 的 id(关联追溯)';
