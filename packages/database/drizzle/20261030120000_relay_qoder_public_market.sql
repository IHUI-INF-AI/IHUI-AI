-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- RP-38 定档(2026-10-30):qoder 账号池只把两个可对照既有公开价位的档进市场
--   qoder/kmodel        = Kimi-K2.7-Code(Qoder),价 = 既有 ai_pricing.kimi-k2.7-code
--   qoder/qmodel_38max  = Qwen3.8-Max(Qoder), 价 = 既有 ai_pricing.qwen3.8-max
-- qoder/auto 是上游路由器(实际模型由上游决定),不定价、不公开。
-- trae 档暂不公开:可调度号仅 2 枚,且无同型号公开价位可对照。
--
-- 价格单位 = 分/千 token(CNY),唯一价源 = ai_pricing;模型行价/倍率只用于市场展示
-- (relay-public.ts 的 official*/relay* 直接读 ai_model_config_models),两处写同值。
-- 可见性权威仍是 scripts/data/relay-upstream-models.jsonl + 登记器(is_relay_public),
-- 本迁移 bootstrap 出的行与该登记表当轮读数一致,登记器下一轮 --check 应为 matched。
--
-- 幂等:配置行按 (provider_code, base_url, owner_uuid IS NULL) 判缺;模型行 on conflict
-- 只改价格/展示字段,不动 enabled;ai_pricing 仅在无当前生效行时补一条。

-- 1. 价格:ai_pricing(唯一价源)—— 无生效行才补,历史行一律不动
INSERT INTO ai_pricing (model_id, input_token_price, output_token_price, billing_mode, currency)
SELECT v.model_id, v.inp, v.outp, 'token', 'CNY'
FROM (
    VALUES
        ('qoder/kmodel', 0.065000::numeric, 0.270000::numeric),
        ('qoder/qmodel_38max', 0.375000::numeric, 0.375000::numeric)
) AS v(model_id, inp, outp)
WHERE NOT EXISTS (
    SELECT 1 FROM ai_pricing p
    WHERE p.model_id = v.model_id
      AND p.effective_at <= now()
      AND (p.expires_at IS NULL OR p.expires_at > now())
);

-- 2. 配置行(仅当缺 qoder 全局行;已存在则复用其 id,不覆盖 name/description)
INSERT INTO ai_model_config (name, provider_code, base_url, api_format, enabled, description)
SELECT 'Qoder 账号池(反代)', 'qoder', 'https://openapi.qoder.com.cn', 'openai_chat', true,
       '号池上游登记 · 由 scripts/relay-upstream-models-sync.mjs 落库(RP-38 公开档位 bootstrap)'
WHERE NOT EXISTS (
    SELECT 1 FROM ai_model_config
    WHERE provider_code = 'qoder'
      AND COALESCE(base_url, '') = 'https://openapi.qoder.com.cn'
      AND owner_uuid IS NULL
);

-- 3. 模型行:公开 + 市场展示价/倍率/排序(排序排在既有同名档之后,不改既有目录顺序)
INSERT INTO ai_model_config_models (
    config_id, model_id, display_name, enabled, is_relay_public,
    input_price_per_1k, output_price_per_1k, relay_price_multiplier, relay_sort_order
)
SELECT c.id, v.model_id, v.display_name, true, true, v.inp, v.outp, '1.2000', v.sort
FROM ai_model_config c
CROSS JOIN (
    VALUES
        ('qoder/kmodel', 'Kimi-K2.7-Code (Qoder)', 0.065000::numeric, 0.270000::numeric, 240),
        ('qoder/qmodel_38max', 'Qwen3.8-Max (Qoder)', 0.375000::numeric, 0.375000::numeric, 241)
) AS v(model_id, display_name, inp, outp, sort)
WHERE c.provider_code = 'qoder'
  AND c.base_url = 'https://openapi.qoder.com.cn'
  AND c.owner_uuid IS NULL
ON CONFLICT (config_id, model_id) DO UPDATE
SET is_relay_public = true,
    input_price_per_1k = EXCLUDED.input_price_per_1k,
    output_price_per_1k = EXCLUDED.output_price_per_1k,
    relay_price_multiplier = EXCLUDED.relay_price_multiplier,
    relay_sort_order = EXCLUDED.relay_sort_order,
    updated_at = now();
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
