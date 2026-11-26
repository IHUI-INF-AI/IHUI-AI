-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 2026-11-26 全收费:上架已补价的 7 个聊天模型。
--
-- 前置:20261126120000 已写成本/售价与 ai_pricing token 行;本迁移只翻
-- enabled/is_relay_public,不改价格。上架前仍可在后台用 toggle 下架。
-- 7 个模型均按 LiteLLM 公开价表成本 × 3 定价,公开面不再有缺价行。

UPDATE ai_model_config_models m
SET enabled = true,
    is_relay_public = true,
    updated_at = now()
WHERE lower(m.model_id) IN (
  'deepseek-v4-flash-1017',
  'deepseek-v4-pro-official',
  'kimi-k3-1',
  'claude-opus-4.1',
  'glm-5.0',
  'hy4std',
  'hy4flash'
)
AND coalesce(m.cost_input_price_per_1k, 0) > 0
AND coalesce(m.cost_output_price_per_1k, 0) > 0
AND coalesce(m.input_price_per_1k, 0) > 0
AND coalesce(m.output_price_per_1k, 0) > 0;

-- 公开面安全兜底:清掉任何仍然公开但成本缺失或为 0 的历史行(正常应为 0)。
-- 例外:动态成本模型和已有正单位价的媒体模型,本来就没有 token 成本列,
-- 不能按 token 成本缺失把它们误下架;它们仍按真实成本/单位价收费。
UPDATE ai_model_config_models m
SET is_relay_public = false,
    updated_at = now()
WHERE m.is_relay_public = true
  AND (
    coalesce(m.cost_input_price_per_1k, 0) <= 0
    OR coalesce(m.cost_output_price_per_1k, 0) <= 0
  )
  AND NOT EXISTS (
    SELECT 1
    FROM ai_pricing p
    WHERE lower(p.model_id) = lower(m.model_id)
      AND p.expires_at IS NULL
      AND (
        p.billing_mode = 'dynamic_cost'
        OR (
          p.billing_mode IN ('per_image', 'per_video', 'per_call')
          AND (
            coalesce(p.per_unit_price, 0) > 0
            OR p.tiered_call_prices IS NOT NULL
          )
        )
      )
  );
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
