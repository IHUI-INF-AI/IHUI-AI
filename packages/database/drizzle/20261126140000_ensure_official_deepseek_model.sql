-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 2026-11-26 全收费:确保第 7 个已补价模型 DeepSeek-V4-Pro-Official 在生产目录存在。
--
-- 背景:本地库有这行,生产库的 Trae 账号池只有 DeepSeek-V4-Pro,没有 Official 别名;
-- 20261126120000 已写入它的 ai_pricing 零售价,但 20261126135000 只能上架已存在的
-- 目录行。本迁移在 trae 配置下补一行,并把成本/售价和公开状态一起写齐。
-- 如果该行已存在(本地库),只更新价格与公开状态,不重复插入。

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ai_model_config WHERE provider_code = 'trae' AND enabled = true
  ) THEN
    RAISE EXCEPTION '缺少启用的 trae 账号池配置,无法补 DeepSeek-V4-Pro-Official';
  END IF;
END $$;

WITH cfg AS (
  SELECT id
  FROM ai_model_config
  WHERE provider_code = 'trae' AND enabled = true
  ORDER BY id
  LIMIT 1
)
INSERT INTO ai_model_config_models (
  config_id, model_id, display_name, enabled, is_relay_public,
  relay_price_multiplier, context_length, supports_streaming, tags,
  cost_input_price_per_1k, cost_output_price_per_1k,
  input_price_per_1k, output_price_per_1k, metadata, updated_at
)
SELECT
  cfg.id, 'DeepSeek-V4-Pro-Official', 'DeepSeek-V4-Pro-Official', false, false,
  '1.0000', 32000, true, ARRAY[]::text[],
  0.950400, 2.851200, 2.851200, 8.553600,
  jsonb_build_object(
    'priceSource', jsonb_build_object(
      'tier', 'public_list',
      'source', 'litellm_public_list_2026-11-26',
      'refModel', 'deepseek-v4-pro',
      'profitFactor', 3,
      'resolvedAt', '2026-11-26T12:00:00+08:00'
    ),
    'placeholderDelisted', true
  ),
  now()
FROM cfg
WHERE NOT EXISTS (
  SELECT 1 FROM ai_model_config_models m
  WHERE lower(m.model_id) = 'deepseek-v4-pro-official'
);

UPDATE ai_model_config_models m
SET enabled = true,
    is_relay_public = true,
    cost_input_price_per_1k = 0.950400,
    cost_output_price_per_1k = 2.851200,
    input_price_per_1k = 2.851200,
    output_price_per_1k = 8.553600,
    updated_at = now()
WHERE lower(m.model_id) = 'deepseek-v4-pro-official';
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
