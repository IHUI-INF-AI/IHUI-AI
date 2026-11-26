-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 2026-11-26 全收费自动筛选:未定价模型不允许以「登记但不售卖」形态入库。
--
-- 规则(BEFORE INSERT):
--   新行 enabled=false 且 is_relay_public=false,如果既没有 ai_pricing 正价,
--   也没有 config 正价,直接 RETURN NULL 跳过插入。同步腿拿不到可核实成本价,
--   因此所有自动同步新模型都会在这里被过滤掉,不再产生缺价行;
--   已补价模型(ai_pricing 有 token 正价)能正常入库;管理员手动登记未定价模型
--   也会被挡住,必须先定价。
--
-- 只拦 enabled=false / is_relay_public=false 的登记行,不拦:
--   - discovery 审批行(enabled=true / public=true,路由自己已校验价格);
--   - CLI 导入的 enabled=true 内部模型(不公开,仍可后续补价);
--   - 媒体按张/按秒/按次模型(ai_pricing.per_unit_price 正价即放行);
--   - dynamic_cost 模型(单价在调用时按真实成本换算)。
--
-- 代价:同步腿不再「先登记、后补价」,未定价模型连行都不会有;这是机主要的
-- 「不应该再加进来」,宁可少目录,也不让缺价模型污染售卖面。

CREATE OR REPLACE FUNCTION ihui_block_unpriced_registry_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.enabled = false AND NEW.is_relay_public = false THEN
    IF EXISTS (
      SELECT 1
      FROM ai_pricing p
      WHERE lower(p.model_id) = lower(NEW.model_id)
        AND (
          (p.billing_mode = 'token' AND p.input_token_price > 0 AND p.output_token_price > 0)
          OR (p.billing_mode IN ('per_image', 'per_video', 'per_call') AND p.per_unit_price > 0)
          OR (p.billing_mode = 'dynamic_cost')
        )
    ) THEN
      RETURN NEW;
    END IF;
    IF coalesce(NEW.input_price_per_1k, 0) > 0
       AND coalesce(NEW.output_price_per_1k, 0) > 0 THEN
      RETURN NEW;
    END IF;
    IF coalesce(NEW.cost_input_price_per_1k, 0) > 0
       AND coalesce(NEW.cost_output_price_per_1k, 0) > 0 THEN
      RETURN NEW;
    END IF;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_unpriced_registry_insert ON ai_model_config_models;
CREATE TRIGGER trg_block_unpriced_registry_insert
BEFORE INSERT ON ai_model_config_models
FOR EACH ROW
EXECUTE FUNCTION ihui_block_unpriced_registry_insert();

COMMENT ON FUNCTION ihui_block_unpriced_registry_insert() IS
  '2026-11-26 全收费:未定价的 enabled=false/public=false 模型行禁止入库;同步腿自动筛选。';
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
