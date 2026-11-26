-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 2026-11-26 全收费:补 7 个可核实的 LLM 成本价(只补价,不自动上架)。
--
-- 数据源:LiteLLM model_prices_and_context_window.json(2026-11-26 拉取)。
-- 换算:USD/token × 720000 = 分/千 token(USD→CNY=7.2,1 USD=720 分)。
-- 零售价 = 成本 × 3(PROFIT_FACTOR);不足 0.1 分的按代码侧 min 0.1 处理,
-- 本批最低 0.1512 分,已高于下限。
--
-- 为什么只补这 7 个:其余 30 多个聊天候选在公开价表里没有同名/同族可核实条目,
-- 或只有 evaluation/extraction/0 输出价;按「未定价一律不卖」继续停售,
-- 不硬编价格。尤其 @cf/cloudflare/clef* / clairic / mistral-lora / kev-4b
-- 属于评测/抽取/零输出,不应作为聊天模型售卖。
--
-- 注意:只写成本/售价,不动 is_relay_public;补价不等于上架,
-- 上架仍需走上架接口的价格闸门与上游实测。
-- ai_pricing 的 token 单价是对客零售价(与 sweepUnpricedModels 写入口径一致);
-- 成本放在 ai_model_config_models 的 cost_* 列,不要混用。

WITH v(model_id, cost_in, cost_out, retail_in, retail_out, ref_model) AS (
  VALUES
    ('deepseek-v4-flash-1017',      0.216000::numeric, 0.864000::numeric,  0.648000::numeric,  2.592000::numeric,  'deepseek-v4-flash'),
    ('deepseek-v4-pro-official',    0.950400::numeric, 2.851200::numeric,  2.851200::numeric,  8.553600::numeric,  'deepseek-v4-pro'),
    ('kimi-k3-1',                   1.440000::numeric, 7.200000::numeric,  4.320000::numeric, 21.600000::numeric,  'moonshot/kimi-k3.1-pro'),
    ('claude-opus-4.1',            10.800000::numeric,54.000000::numeric, 32.400000::numeric,162.000000::numeric,  'anthropic/claude-opus-4.1'),
    ('glm-5.0',                     0.720000::numeric, 2.304000::numeric,  2.160000::numeric,  6.912000::numeric,  'zai/glm-5'),
    ('hy4std',                      0.300240::numeric, 0.900360::numeric,  0.900720::numeric,  2.701080::numeric,  'tencent/hy4'),
    ('hy4flash',                    0.050400::numeric, 0.202320::numeric,  0.151200::numeric,  0.606960::numeric,  'fireworks_ai/hy4-flash')
)
UPDATE ai_model_config_models m
SET cost_input_price_per_1k = v.cost_in,
    cost_output_price_per_1k = v.cost_out,
    input_price_per_1k = v.retail_in,
    output_price_per_1k = v.retail_out,
    metadata = COALESCE(m.metadata, '{}'::jsonb) || jsonb_build_object(
      'priceSource', jsonb_build_object(
        'tier', 'public_list',
        'source', 'litellm_public_list_2026-11-26',
        'refModel', v.ref_model,
        'profitFactor', 3,
        'resolvedAt', '2026-11-26T12:00:00+08:00'
      )
    ),
    updated_at = now()
FROM v
WHERE lower(m.model_id) = v.model_id;

-- ai_pricing 的 token 单价口径是「对客零售价」,不是采购成本;
-- 这里必须写 retail_in/retail_out。先更新已有最新 token 行(尤其是历史 1/2 分
-- 占位价或 1/7 分倒挂价),只有在完全没有 token 行时才插入,避免重复行。
WITH v(model_id, retail_in, retail_out) AS (
  VALUES
    ('deepseek-v4-flash-1017',      0.648000::numeric,  2.592000::numeric),
    ('deepseek-v4-pro-official',    2.851200::numeric,  8.553600::numeric),
    ('kimi-k3-1',                   4.320000::numeric, 21.600000::numeric),
    ('claude-opus-4.1',            32.400000::numeric,162.000000::numeric),
    ('glm-5.0',                     2.160000::numeric,  6.912000::numeric),
    ('hy4std',                      0.900720::numeric,  2.701080::numeric),
    ('hy4flash',                    0.151200::numeric,  0.606960::numeric)
)
UPDATE ai_pricing p
SET input_token_price = v.retail_in,
    output_token_price = v.retail_out,
    currency = 'CNY'
FROM v
WHERE lower(p.model_id) = v.model_id
  AND p.billing_mode = 'token'
  AND p.id = (
    SELECT p2.id
    FROM ai_pricing p2
    WHERE lower(p2.model_id) = v.model_id
      AND p2.billing_mode = 'token'
    ORDER BY p2.effective_at DESC NULLS LAST, p2.id DESC
    LIMIT 1
  );

WITH v(model_id, retail_in, retail_out) AS (
  VALUES
    ('deepseek-v4-flash-1017',      0.648000::numeric,  2.592000::numeric),
    ('deepseek-v4-pro-official',    2.851200::numeric,  8.553600::numeric),
    ('kimi-k3-1',                   4.320000::numeric, 21.600000::numeric),
    ('claude-opus-4.1',            32.400000::numeric,162.000000::numeric),
    ('glm-5.0',                     2.160000::numeric,  6.912000::numeric),
    ('hy4std',                      0.900720::numeric,  2.701080::numeric),
    ('hy4flash',                    0.151200::numeric,  0.606960::numeric)
)
INSERT INTO ai_pricing (model_id, billing_mode, input_token_price, output_token_price, currency, effective_at)
SELECT v.model_id, 'token', v.retail_in, v.retail_out, 'CNY', now()
FROM v
WHERE NOT EXISTS (
  SELECT 1 FROM ai_pricing p
  WHERE lower(p.model_id) = v.model_id
    AND p.billing_mode = 'token'
);
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
