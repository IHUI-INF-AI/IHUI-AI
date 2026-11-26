// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * v1 多模态定价闸的纯解析器(2026-11-26)。
 *
 * 把「路由 → 计费类型 / 模型 / 单位数」的判定从路由文件抽出来,便于单测锁住:
 * - image 取 n(1~10);video 按请求的 duration 取 1~300 秒(按次定价会忽略 units),
 *   保证预扣冻结的是实际时长而不是 1 秒;
 * - audio 走 per_call 的 audio 计价(2026-11-26 单列,避免落到 token 行);
 * - music/3d/generation 走 image 口径,兼容 per_call / per_image 两种定价行。
 *
 * 返回 null 表示 preHandler 不拦价(例如 GET 轮询、请求体没有 model 的 400 请求)。
 */
export type MultimodalPriceCallType = 'chat' | 'image' | 'video' | 'audio'

export interface MultimodalPriceContext {
  model: string
  callType: MultimodalPriceCallType
  units: number
}

export function multimodalPriceRequest(
  routeUrl: string,
  body: unknown,
): MultimodalPriceContext | null {
  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const model = typeof payload.model === 'string' ? payload.model.trim() : ''
  if (!model) return null
  const normalizedRoute = routeUrl.replace(/^\/v1(?=\/)/, '')
  const callType: MultimodalPriceCallType = normalizedRoute.startsWith('/images')
    ? 'image'
    : normalizedRoute.startsWith('/videos')
      ? 'video'
      : normalizedRoute.startsWith('/audio')
        ? 'audio'
        : 'image'
  let units = 1
  if (callType === 'image') {
    const rawN = Number(payload.n)
    units = Number.isFinite(rawN) ? Math.max(1, Math.min(10, Math.floor(rawN))) : 1
  } else if (callType === 'video') {
    // 按秒定价时 units=duration;按次定价 calculateCost 会忽略 units。
    // 上限 300 秒防止异常 duration 冻结过大,同时余额不足会直接 402。
    const rawDuration = Number(payload.duration)
    units = Number.isFinite(rawDuration)
      ? Math.max(1, Math.min(300, Math.floor(rawDuration)))
      : 1
  }
  return { model, callType, units }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
