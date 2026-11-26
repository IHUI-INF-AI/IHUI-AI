-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 2026-11-26 全收费收口:32 个缺价聊天模型永久拉黑,未定价行不再入库。
--
-- 事故:481 已把这 32 个模型清掉,但后续同步又把其中 11 个以
-- enabled=true / is_relay_public=false / 双价 0 的形态插回库内。根因是
-- 482 的 INSERT 触发器只拦 enabled=false 且 public=false 的登记行,
-- enabled=true 的未定价行可以绕过闸门。
--
-- 本迁移:
-- 1) 建 ai_model_blocklist,固化 2026-11-26 点名的 32 个缺价聊天模型;
-- 2) 物理删除库内残留的这 32 个模型;
-- 3) 重写 INSERT 闸门:黑名单模型直接 RETURN NULL;其余模型必须已有正零售价
--    (config input/output 双正价,或 metadata 明确 outputNotApplicable,或
--    ai_pricing 有 token 双正价 / 媒体正单位价 / dynamic_cost),否则不入库。
--    不再区分 enabled/public —— enabled=true 也不能带零价进库。

CREATE TABLE IF NOT EXISTS ai_model_blocklist (
  model_id   varchar(128) PRIMARY KEY,
  reason     text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO ai_model_blocklist (model_id, reason) VALUES
  ('@cf/cloudflare/clairic', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('@cf/cloudflare/clef', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('@cf/cloudflare/clef-flash', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('@cf/cloudflare/clef-omni', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('@cf/mistral/mistral-7b-instruct-v0.2-lora', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('agnes-2.5-pro-theta', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('agnes-3.0-pro', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('agnes-sys1-1.0', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('allam-2-7b', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('big-pickle', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('composer-2.5', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('cyankiwi/qwen3.5-9b-awq-4bit', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('deepseek-v3-2-volc', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('deepseek-v41-flash-1017', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('glm-5.2-sft-harmony', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('gpt-6-astra-pro', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('hunyuan-2.0-thinking', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('hunyuan-chat', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('hy4-preview-x', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('kev-4b', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('LiquidAI/lfm3-1.7b', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('MiniMax-M2.1-highspeed', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('nvidia/cosmos-reason2-8b', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('nvidia/ising-calibration-1.5-31b', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('nvidia/nemotron-3.5-bolt-e4b', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('nvidia/nemotron-3.5-super-vl-120b-a12b', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('openpangu-2.1-pro', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('phi-3.5-mini-instruct', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('poolside/laguna-xs-2.1', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('seed-lite-7b', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('semif', '2026-11-26 缺价聊天模型,永久禁止入库'),
  ('spark-x2.6', '2026-11-26 缺价聊天模型,永久禁止入库')
ON CONFLICT (model_id) DO NOTHING;

DELETE FROM ai_model_config_models m
USING ai_model_blocklist b
WHERE lower(m.model_id) = b.model_id;

CREATE OR REPLACE FUNCTION ihui_block_unpriced_registry_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM ai_model_blocklist b
    WHERE b.model_id = lower(NEW.model_id)
  ) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM ai_pricing p
    WHERE lower(p.model_id) = lower(NEW.model_id)
      AND (
        (p.billing_mode = 'token' AND p.input_token_price > 0 AND p.output_token_price > 0)
        OR (
          p.billing_mode IN ('per_image', 'per_video', 'per_call')
          AND (
            coalesce(p.per_unit_price, 0) > 0
            OR p.tiered_call_prices IS NOT NULL
          )
        )
        OR p.billing_mode = 'dynamic_cost'
      )
  ) THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.input_price_per_1k, 0) > 0
     AND (
       coalesce(NEW.output_price_per_1k, 0) > 0
       OR coalesce(NEW.metadata->'priceSource'->>'outputNotApplicable', '') = 'true'
     ) THEN
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION ihui_block_unpriced_registry_insert() IS
  '2026-11-26 全收费:黑名单模型禁止入库;其余未定价行(含 enabled=true)一律拒绝,不再产生缺价行。';
