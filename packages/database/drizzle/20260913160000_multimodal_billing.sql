-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- ============================================================================
-- 20260913160000_multimodal_billing.sql
-- 多模态计费体系(2026-09-13 立):按次 / 生图按张 / 生视频 三套计费模式。
--   背景:平台此前仅支持按 token 计费;生图(/v1/images/generations)与生视频
--   (/v1/videos/generations)端点已存在但零计费,上游按次/按张模型(如
--   swiftapi 的 gpt-5.6/Auto-Model 按次、gpt-image-* 按张)无法精确扣费。
--   动作:
--     A. ai_pricing 增加 billing_mode / per_unit_price / tiered_call_prices /
--        video_unit 四列(默认 token 模式,存量行为完全不变);
--     B. llm_call_logs 增加 call_type 列(chat/image/video),多模态调用审计维度。
--   计价规则(与上游报价页 api.x5m5x.com/pricing 对齐):
--     per_call  三档:promptTokens ≤256K → le256k;≤512K → mid;>512K → gt512k
--               (256K=262144,512K=524288)
--     per_image 分/张 × 张数
--     per_video 分/次 或 分/秒(video_unit),按秒时 units=请求 duration
-- ============================================================================

-- A. ai_pricing 计费模式扩展
ALTER TABLE ai_pricing
  ADD COLUMN IF NOT EXISTS billing_mode varchar(16) NOT NULL DEFAULT 'token',
  ADD COLUMN IF NOT EXISTS per_unit_price numeric(18,6),
  ADD COLUMN IF NOT EXISTS tiered_call_prices jsonb,
  ADD COLUMN IF NOT EXISTS video_unit varchar(8);

COMMENT ON COLUMN ai_pricing.billing_mode IS
  '计费模式: token(按token,默认) | per_call(按次三档) | per_image(按张) | per_video(按次/按秒)';
COMMENT ON COLUMN ai_pricing.per_unit_price IS
  '单位价(分): per_image=分/张; per_video=分/次或分/秒(video_unit)';
COMMENT ON COLUMN ai_pricing.tiered_call_prices IS
  'per_call 三档价(分/次): {"le256k":x,"mid":y,"gt512k":z},档位按 promptTokens';
COMMENT ON COLUMN ai_pricing.video_unit IS
  'per_video 计价单位: call(按次,默认) | second(按秒)';

-- B. llm_call_logs 调用类型(多模态计费/审计维度)
ALTER TABLE llm_call_logs
  ADD COLUMN IF NOT EXISTS call_type varchar(16) NOT NULL DEFAULT 'chat';

CREATE INDEX IF NOT EXISTS llm_call_logs_call_type_idx ON llm_call_logs (call_type);
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
