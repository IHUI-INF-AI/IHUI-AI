-- 阶梯计价规则表(2026-08-01 立,用得越多越便宜)
-- 月度用量达阈值自动降价,模型级独立累计
-- model_id = '*' 表示全局规则(对所有模型生效),精确 model_id 优先于 '*'
-- to_tokens = NULL 表示无上限
-- multiplier: 0.80 = 8折, 1.00 = 原价
CREATE TABLE IF NOT EXISTS tiered_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  model_id VARCHAR(128) NOT NULL,
  from_tokens INTEGER NOT NULL,
  to_tokens INTEGER,
  multiplier NUMERIC(5,2) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tiered_pricing_rules_model_idx ON tiered_pricing_rules(model_id);
CREATE INDEX IF NOT EXISTS tiered_pricing_rules_enabled_idx ON tiered_pricing_rules(enabled);
