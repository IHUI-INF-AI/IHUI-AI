-- 阶梯计价示例规则(2026-08-01 立,用得越多越便宜)
-- 幂等插入:重复执行不会报错(ON CONFLICT DO NOTHING)
-- gpt-4o 阶梯:0-100万原价 / 100万-500万9折 / 500万+8折
-- claude-3-5-sonnet 阶梯:0-50万原价 / 50万+85折
INSERT INTO tiered_pricing_rules (name, model_id, from_tokens, to_tokens, multiplier, enabled)
VALUES
  ('gpt-4o 原价', 'gpt-4o', 0, 1000000, 1.00, true),
  ('gpt-4o 9折', 'gpt-4o', 1000001, 5000000, 0.90, true),
  ('gpt-4o 8折', 'gpt-4o', 5000001, NULL, 0.80, true),
  ('claude-3-5-sonnet 原价', 'claude-3-5-sonnet', 0, 500000, 1.00, true),
  ('claude-3-5-sonnet 85折', 'claude-3-5-sonnet', 500001, NULL, 0.85, true)
ON CONFLICT DO NOTHING;
