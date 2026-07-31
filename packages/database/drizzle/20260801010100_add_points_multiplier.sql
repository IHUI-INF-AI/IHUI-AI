-- 20260801010100_add_points_multiplier.sql
-- 模型积分消耗倍数字段(2026-07-31 立,用户规则:平台内置模型积分消耗倍数)
--
-- 计费公式:扣分 = (输入token + 输出token) / 1000 × points_multiplier × 1 积分基准
-- 倍数档位(见 packages/database/src/schema/ai-config.ts POINTS_MULTIPLIER_TIERS):
--   0   = 免费模型(本地/zero_cost:ollama/llm7/pollinations)
--   1   = 经济模型(mini/flash:gpt-4o-mini/step-3.7-flash)
--   3   = 标准模型(standard:gpt-4o/claude-sonnet)
--   10  = 高级模型(pro/max:claude-opus/gpt-4-turbo)
--   30  = 旗舰模型(opus/thinking:claude-opus-thinking/o1)
-- 兜底:积分不足时降级到 zero_cost 模型(类似 Cursor slow request)

ALTER TABLE ai_model_config_models
  ADD COLUMN IF NOT EXISTS points_multiplier numeric(5,2) DEFAULT 1.00 NOT NULL;

COMMENT ON COLUMN ai_model_config_models.points_multiplier IS
  '积分消耗倍数(1.00=基准,0=免费,10=高级,30=旗舰)。扣分=token/1000×倍数。见 POINTS_MULTIPLIER_TIERS';

-- 为现有模型批量设置默认倍数(按 model_id 模式匹配)
-- 免费模型(0x)
UPDATE ai_model_config_models SET points_multiplier = 0
  WHERE model_id ILIKE '%ollama%' OR model_id ILIKE '%llama%' OR model_id ILIKE '%qwen%';
UPDATE ai_model_config_models SET points_multiplier = 0
  WHERE model_id ILIKE '%pollinations%' OR model_id ILIKE '%llm7%' OR model_id ILIKE '%aihorde%';

-- 经济模型(1x):mini/flash/lite
UPDATE ai_model_config_models SET points_multiplier = 1
  WHERE model_id ILIKE '%mini%' OR model_id ILIKE '%flash%' OR model_id ILIKE '%lite%'
  OR model_id ILIKE '%nano%' OR model_id ILIKE '%haiku%';

-- 标准模型(3x):standard/plus/pro(非 max)
UPDATE ai_model_config_models SET points_multiplier = 3
  WHERE model_id ILIKE '%sonnet%' OR model_id ILIKE '%gpt-4o%' OR model_id ILIKE '%gpt-4.1%'
  OR model_id ILIKE '%deepseek%' OR model_id ILIKE '%qwen-max%' OR model_id ILIKE '%glm-4%';

-- 高级模型(10x):pro/max/turbo(非 opus)
UPDATE ai_model_config_models SET points_multiplier = 10
  WHERE model_id ILIKE '%gpt-4-turbo%' OR model_id ILIKE '%gpt-4.5%'
  OR model_id ILIKE '%claude-3-opus%' OR model_id ILIKE '%gemini-pro%'
  OR model_id ILIKE '%qwen-max-longcontext%' OR model_id ILIKE '%o1-mini%'
  OR model_id ILIKE '%o3-mini%';

-- 旗舰模型(30x):opus/thinking/o1/o3(完整版)
UPDATE ai_model_config_models SET points_multiplier = 30
  WHERE model_id ILIKE '%opus%' OR model_id ILIKE '%thinking%'
  OR model_id ILIKE '%o1-preview%' OR model_id ILIKE '%o1%'
  OR model_id ILIKE '%o3%' OR model_id ILIKE '%gpt-5%';

-- 验证:统计各档位数量
SELECT points_multiplier, COUNT(*) AS model_count
  FROM ai_model_config_models GROUP BY points_multiplier ORDER BY points_multiplier;
