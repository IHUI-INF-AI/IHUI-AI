-- 模型价格历史 + 限时折扣调度表(2026-08-01 立,价格趋势曲线 + 预设折扣 + 动态调价建议)
-- model_price_history: 每次调价(改倍率/改单价)插入一条快照,只增不改(审计追溯)
--   - effective_at 为本次调价生效时间,前端用此字段升序绘制趋势曲线
--   - relay_multiplier 中转站倍率(1.00=原价,0.80=8 折,1.20=加价 20%)
-- price_discount_schedules: 预设限时折扣,到点(starts_at)自动生效,过期(ends_at)自动失效
--   - model_id = NULL 表示全部模型
--   - discount_multiplier 0.80 = 8 折,叠加在 relay_multiplier 之上
CREATE TABLE IF NOT EXISTS model_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id VARCHAR(128) NOT NULL,
  input_token_price_cents INTEGER NOT NULL,
  output_token_price_cents INTEGER NOT NULL,
  relay_multiplier NUMERIC(5, 2) NOT NULL DEFAULT '1.00',
  effective_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(256),
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS model_price_history_model_idx ON model_price_history(model_id);
CREATE INDEX IF NOT EXISTS model_price_history_effective_idx ON model_price_history(effective_at);

CREATE TABLE IF NOT EXISTS price_discount_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  model_id VARCHAR(128),
  discount_multiplier NUMERIC(5, 2) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS price_discount_schedules_model_idx ON price_discount_schedules(model_id);
CREATE INDEX IF NOT EXISTS price_discount_schedules_starts_at_idx ON price_discount_schedules(starts_at);
CREATE INDEX IF NOT EXISTS price_discount_schedules_enabled_idx ON price_discount_schedules(enabled);
