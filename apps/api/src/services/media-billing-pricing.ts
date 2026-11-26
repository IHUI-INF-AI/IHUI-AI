// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 媒体生成定价(单一报价真源,2026-11-26 全收费版)。
 *
 * 口径:
 *   1. `ai_pricing` 里 `billing_mode='per_image'` / `per_video` / `per_call`
 *      的 `per_unit_price`(分)是唯一线上价;1 积分 = 1 分钱,直接转积分;
 *   2. 不再有兜底价:没有匹配定价行、模式不匹配、单价 <= 0 一律返回 null,
 *      调用方必须 fail-closed(未定价不可售);
 *   3. 不再有免费模型:即使成本为 0,也必须显式配置 >0 的零售单价;
 *   4. 视频按秒计价时 `units` 必须来自服务端可验证的真实时长;按次计价恒 1 次;
 *   5. 结果一律 `ceil` 到整数积分,绝不出现小数或负数。
 *
 * 本文件是纯模块:不连库、不读 env,方便单测钉住公式。
 */

/** 可计费的媒体类别。 */
export type MediaCategory = 'image' | 'video' | 'audio' | 'voiceprint' | 'video_compose'

/** `ai_pricing` 中与媒体报价有关的字段快照(避免纯模块依赖数据库类型)。 */
export interface MediaPricingSnapshot {
  billingMode: string
  perUnitPrice: number | null
  videoUnit: string | null
  /** 平台上游成本价(分/单位),仅用于成本账;null = 未配置 */
  costUnitPrice?: number | null
}

/** 单次媒体生成的报价结果。 */
export interface MediaPointsQuote {
  /** 最终扣减积分(整数,>=0) */
  points: number
  /** 调用方传入的原始单位数(图片张数 / 视频秒数等) */
  units: number
  /** 实际参与计价的单位数(按次视频/音频恒为 1) */
  appliedUnits: number
  /** 单位价(分/单位),用于流水与排查 */
  unitPricePoints: number
  /** 平台上游成本(分);null = 未配置成本价 */
  costCents: number | null
  /** 报价来源:只可能命中 ai_pricing */
  source: 'ai_pricing'
  category: MediaCategory
}

/** 单位数归一化:非正/非有限一律按 1,防止 0 元或负数扣费。 */
function normalizeUnits(units: number | undefined): number {
  if (typeof units !== 'number' || !Number.isFinite(units) || units <= 0) return 1
  return Math.floor(units)
}

/** 平台成本价 → 分;未配置/非法返回 null,0 是合法成本价。 */
function computeCostCents(costUnitPrice: number | null | undefined, units: number): number | null {
  if (typeof costUnitPrice !== 'number' || !Number.isFinite(costUnitPrice) || costUnitPrice < 0) {
    return null
  }
  return Math.round(costUnitPrice * units * 1e6) / 1e6
}

/** 该类别要求的 ai_pricing billing_mode。 */
export function requiredBillingMode(
  category: MediaCategory,
): 'per_image' | 'per_video' | 'per_call' {
  if (category === 'image') return 'per_image'
  if (category === 'video') return 'per_video'
  return 'per_call'
}

/**
 * 按定价行快照报价。
 *
 * 返回 null 表示“不可售”:调用方必须拒绝请求,不能回落到任何默认价。
 * 单价 0 也视为不可售 —— 本产品不再提供免费媒体模型。
 */
export function quoteMediaPoints(input: {
  category: MediaCategory
  units?: number
  pricing?: MediaPricingSnapshot | null
}): MediaPointsQuote | null {
  const units = normalizeUnits(input.units)
  const category = input.category
  const pricing = input.pricing ?? null
  if (!pricing) return null

  const expectedMode = requiredBillingMode(category)
  if (pricing.billingMode !== expectedMode) return null

  const perUnitRaw = pricing.perUnitPrice
  const costUnit = pricing.costUnitPrice
  const costUsable = typeof costUnit === 'number' && Number.isFinite(costUnit) && costUnit > 0
  const costFallbackPrice = costUsable ? (costUnit as number) * 3 : null
  // 零售价优先用 per_unit_price;缺失时按成本价 ×3 生成,不允许免费。
  const perUnit =
    typeof perUnitRaw === 'number' && Number.isFinite(perUnitRaw) && perUnitRaw > 0
      ? perUnitRaw
      : costFallbackPrice
  if (perUnit === null || !Number.isFinite(perUnit) || perUnit <= 0) return null

  const appliedUnits =
    category === 'image' || (category === 'video' && pricing.videoUnit === 'second') ? units : 1
  const points = Math.ceil(perUnit * appliedUnits)
  if (!Number.isFinite(points) || points <= 0) return null

  return {
    points,
    units,
    appliedUnits,
    unitPricePoints: perUnit,
    costCents: computeCostCents(pricing.costUnitPrice, appliedUnits),
    source: 'ai_pricing',
    category,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
