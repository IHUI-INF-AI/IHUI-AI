-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 2026-11-26 LLM token 零售价不得低于公开配置成本的 3 倍。
--
-- 背景:公开目录按 ai_model_config_models.input/output_price_per_1k 展示,
-- 计费却按 ai_pricing 最新生效 token 价结算。同步腿会写入更低的 ai_pricing 行,
-- 造成「公示价 0.648、实际结算 0.200139、上游成本 0.216」的倒挂;同名多配置
-- 里只要有一条高成本配置被路由命中,就按最低价卖高成本货。
--
-- 本迁移用 BEFORE INSERT/UPDATE 触发器把 token 价抬到
-- max(公开且启用配置成本) × 3,与「成本加成、未定价不卖」口径一致。
-- 只约束 billing_mode='token'; dynamic_cost / per_image / per_video / per_call
-- 的零单价是合法占位,不在此处改价。

CREATE OR REPLACE FUNCTION ihui_guard_token_price_floor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  max_cost_in numeric;
  max_cost_out numeric;
  floor_in numeric;
  floor_out numeric;
BEGIN
  IF new.billing_mode <> 'token' THEN
    RETURN new;
  END IF;

  SELECT max(coalesce(m.cost_input_price_per_1k, 0)),
         max(coalesce(m.cost_output_price_per_1k, 0))
    INTO max_cost_in, max_cost_out
    FROM ai_model_config_models m
   WHERE lower(m.model_id) = lower(new.model_id)
     AND m.enabled = true
     AND m.is_relay_public = true;

  IF coalesce(max_cost_in, 0) > 0 THEN
    floor_in := round(max_cost_in * 3, 6);
    IF coalesce(new.input_token_price, 0) < floor_in THEN
      new.input_token_price := floor_in;
    END IF;
  END IF;

  IF coalesce(max_cost_out, 0) > 0 THEN
    floor_out := round(max_cost_out * 3, 6);
    IF coalesce(new.output_token_price, 0) < floor_out THEN
      new.output_token_price := floor_out;
    END IF;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_token_price_floor ON ai_pricing;
CREATE TRIGGER trg_guard_token_price_floor
BEFORE INSERT OR UPDATE OF input_token_price, output_token_price, billing_mode, model_id
ON ai_pricing
FOR EACH ROW EXECUTE FUNCTION ihui_guard_token_price_floor();

-- 回填当前生效行:触发器只拦新写入,存量倒挂行要显式 UPDATE 才会重算。
UPDATE ai_pricing
   SET input_token_price = input_token_price,
       output_token_price = output_token_price
 WHERE billing_mode = 'token'
   AND effective_at <= now()
   AND (expires_at IS NULL OR expires_at > now());
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
