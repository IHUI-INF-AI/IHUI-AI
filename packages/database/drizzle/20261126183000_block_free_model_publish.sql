-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 2026-11-26 全收费补丁:免费模型永远不得进入公开售卖面。
--
-- 事故:官方目录把 openrouter/free 标成 official-free,定价管线 applyOfficialEntry
-- 在上游目录刷新时会执行 `is_relay_public = case when enabled then true ...`,
-- 把 0 成本/0 售价的免费模型重新公开;现有 insert 触发器只拦 INSERT,拦不住 UPDATE。
--
-- 本迁移做两件事:
-- 1) 把当前所有「免费变体 / official-free 且 token 双价为 0」的公开行关停;
-- 2) 建立 BEFORE INSERT OR UPDATE 触发器,后续任何腿(定价管线/同步/后台)想把
--    这类零价免费模型重新公开时,数据库直接强制 enabled=false / is_relay_public=false。
--
-- 例外:动态成本与已有正单位价的媒体模型仍按真实成本/单位价收费,不属于免费;
-- 有本地采购成本的 official-free(cost guard)会有正售价,不会被本触发器拦截。

UPDATE ai_model_config_models m
SET enabled = false,
    is_relay_public = false,
    updated_at = now()
WHERE m.is_relay_public = true
  AND coalesce(m.input_price_per_1k, 0) <= 0
  AND coalesce(m.output_price_per_1k, 0) <= 0
  AND (
    m.model_id ~* '(^|[-_/:])free($|[-_/:])'
    OR coalesce(m.metadata->'priceSource'->>'tier', '') = 'official-free'
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

CREATE OR REPLACE FUNCTION ihui_block_free_model_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_relay_public
     AND coalesce(NEW.input_price_per_1k, 0) <= 0
     AND coalesce(NEW.output_price_per_1k, 0) <= 0
     AND (
       NEW.model_id ~* '(^|[-_/:])free($|[-_/:])'
       OR coalesce(NEW.metadata->'priceSource'->>'tier', '') = 'official-free'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM ai_pricing p
       WHERE lower(p.model_id) = lower(NEW.model_id)
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
     )
  THEN
    NEW.enabled := false;
    NEW.is_relay_public := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_free_model_publish ON ai_model_config_models;
CREATE TRIGGER trg_block_free_model_publish
BEFORE INSERT OR UPDATE ON ai_model_config_models
FOR EACH ROW
EXECUTE FUNCTION ihui_block_free_model_publish();
