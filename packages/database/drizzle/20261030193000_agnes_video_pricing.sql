-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- Agnes 媒体定价(2026-10-30 立):视频 + 图像两族。
-- /v1/videos/generations?vendor=agnes 与 /v1/images/generations?vendor=agnes 全链路首次接通,
-- 但 ai_pricing 里 agnes 媒体模型一行都没有 ⇒ calculateCost 取不到 pricingRow,回落到 token
-- 分支而多模态调用的 prompt/completion tokens 恒为 0(v1-multimodal.ts chargeMultimodal)
-- ⇒ 总成本 0 分,用户「付费调用」实际分文不收。本迁移补上这条链路上的第一手定价。
--
-- 单位 = 分(与 billing.ts 列注 144-152 行、relay-billing-service.ts per_video 分支 722-741 行同口径);
-- 对外公示由 /models-pricing 自行 ÷100 折成「元/次」,本文件不另写一套展示价。
-- video_unit='call'(按次)而非 'second':上游 2.5 系列不收顶层 duration
--   (实测 POST /v1/videos 契约 = model/prompt/mode/size/image/seed/negative_prompt,
--   输出时长由 num_frames/frame_rate 决定),按秒计价等于向用户收取上游并不控制的量。
--
-- 取价依据(2026-10-30 定档):flash 档上游免费(仓库既有实测:非 flash 档在账户余额 0 时
--   上游 402/403 insufficient_user_quota),取低位 ¥0.20/次引流;非 flash 档上游要余额,
--   取 ¥0.60/次保毛利。全仓此前无任何视频厂商成文价可对照,故这是「自证价」不是「对标价」——
--   日后按真实上游账单校准时应新增一条生效行(expires_at 收口旧行),不得改写本历史行。
--   管理员改价入口 /admin/ai-pricing,本迁移不覆盖已生效行。
--
-- 图像两行(2026-10-30 补,同一票):/v1/images/generations?vendor=agnes 此前也静默落 tongyi
--   (与视频同型缺陷),本迁移一并登记,单位 per_image=分/张(同 billing.ts 列注口径)。
--   取价依据:上游 agnes-image-2.5-flash 实测 200 真出图(零成本)⇒ ¥0.20/张 与视频 flash 档同价,
--   同一族两档媒体同价、便于对用户讲清("Agnes 免费档 ¥0.20/次·张");参照 gpt-image-2.5 的
--   真实市场成本(约 $0.04/张 ≈ ¥0.29/张),本行留有毛利。两档 flash 同价:上游 2.1 与 2.5
--   同为 flash 族,实测 2.1 在本账号更早触发 rpm 429(需平台实名认证),故不另造价档。
--
-- 幂等:ai_pricing 对 model_id 没有唯一约束(只有普通索引),ON CONFLICT 不适用
--   ⇒ 与 seed/relay-pricing-seed.ts 多模态快照同写法:仅当该 model 当前无生效行才 INSERT。

INSERT INTO ai_pricing (
  model_id, input_token_price, output_token_price,
  billing_mode, per_unit_price, video_unit, region_pricing, currency
)
SELECT v.model_id, 0, 0, v.mode, v.unit, v.vunit, '{"cn":1.0}'::jsonb, 'CNY'
FROM (VALUES
  ('agnes-video-2.5-flash', 'per_video', 20.000000::numeric, 'call'::text),
  ('agnes-video-2.5',       'per_video', 60.000000::numeric, 'call'::text),
  ('agnes-image-2.5-flash', 'per_image', 20.000000::numeric, NULL::text),
  ('agnes-image-2.1-flash', 'per_image', 20.000000::numeric, NULL::text)
) AS v(model_id, mode, unit, vunit)
WHERE NOT EXISTS (
  SELECT 1 FROM ai_pricing p
  WHERE p.model_id = v.model_id
    AND p.effective_at <= now()
    AND (p.expires_at IS NULL OR p.expires_at > now())
);
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
