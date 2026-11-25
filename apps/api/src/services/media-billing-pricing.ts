// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 媒体生成定价(单一报价真源,2026-11-25 收口)。
 *
 * 口径:
 *   1. `ai_pricing` 里 `billing_mode='per_image'` 的 `per_unit_price`(分/张)
 *      与 `billing_mode='per_video'` 的 `per_unit_price`(分/次或分/秒)是唯一线上价;
 *   2. 1 积分 = 1 分钱,所以报价直接是积分数,不再乘模型档位倍率
 *      (媒体零售价本身已经含毛利,再乘一次等于重复加价);
 *   3. 定价行缺失 / 模式不匹配时,回落到本文件的 `MEDIA_FALLBACK_UNIT_POINTS`;
 *      免费模型(ollama/pollinations 等)仍保持 0 积分,不因媒体计费变成收费;
 *   4. 视频按秒计价时,`units` 必须传真实时长(秒);按次计价时无论传多少都只算 1 次;
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
}

/** 单次媒体生成的报价结果。 */
export interface MediaPointsQuote {
  /** 最终扣减积分(整数,>=0) */
  points: number
  /** 调用方传入的原始单位数(图片张数 / 视频秒数等) */
  units: number
  /** 实际参与计价的单位数(按次视频恒为 1) */
  appliedUnits: number
  /** 单位价(分/单位),用于流水与排查 */
  unitPricePoints: number
  /** 报价来源:命中 ai_pricing 还是回落兜底表 */
  source: 'ai_pricing' | 'fallback'
  category: MediaCategory
  /** 免费模型豁免 */
  free: boolean
}

/**
 * 兜底单位价(积分/单位)。只用于 `ai_pricing` 没有对应定价行的模型。
 * 取值与 2026-10-30 Agnes 媒体定价迁移对齐:图片 ¥0.20/张、视频 ¥0.20/次;
 * 语音/声纹/视频合成的固定成本较低,保留原值。
 */
export const MEDIA_FALLBACK_UNIT_POINTS: Readonly<Record<MediaCategory, number>> = Object.freeze({
  image: 20,
  video: 20,
  audio: 2,
  voiceprint: 2,
  video_compose: 30,
})

/** 单位数归一化:非正/非有限一律按 1,防止 0 元或负数扣费。 */
function normalizeUnits(units: number | undefined): number {
  if (typeof units !== 'number' || !Number.isFinite(units) || units <= 0) return 1
  return Math.floor(units)
}

/** 纯兜底报价(不读库),供测试与无定价行场景使用。 */
export function estimateFallbackMediaPoints(category: MediaCategory, units = 1): number {
  const safeUnits = normalizeUnits(units)
  const applied = category === 'video' ? 1 : safeUnits
  return Math.ceil(MEDIA_FALLBACK_UNIT_POINTS[category] * applied)
}

/**
 * 按定价行快照报价。`free=true` 时无条件 0 积分(免费模型)。
 * 传入的 `pricing` 必须是当前生效行;为空则回落兜底表。
 */
export function quoteMediaPoints(input: {
  category: MediaCategory
  units?: number
  pricing?: MediaPricingSnapshot | null
  free?: boolean
}): MediaPointsQuote {
  const units = normalizeUnits(input.units)
  const category = input.category
  const pricing = input.pricing ?? null

  if (input.free) {
    return {
      points: 0,
      units,
      appliedUnits: 0,
      unitPricePoints: 0,
      source: 'fallback',
      category,
      free: true,
    }
  }

  const perUnit = pricing?.perUnitPrice
  if (pricing && typeof perUnit === 'number' && Number.isFinite(perUnit) && perUnit > 0) {
    if (category === 'image' && pricing.billingMode === 'per_image') {
      return {
        points: Math.ceil(perUnit * units),
        units,
        appliedUnits: units,
        unitPricePoints: perUnit,
        source: 'ai_pricing',
        category,
        free: false,
      }
    }
    if (category === 'video' && pricing.billingMode === 'per_video') {
      const appliedUnits = pricing.videoUnit === 'second' ? units : 1
      return {
        points: Math.ceil(perUnit * appliedUnits),
        units,
        appliedUnits,
        unitPricePoints: perUnit,
        source: 'ai_pricing',
        category,
        free: false,
      }
    }
  }

  const appliedUnits = category === 'video' ? 1 : units
  const unitPricePoints = MEDIA_FALLBACK_UNIT_POINTS[category]
  return {
    points: Math.ceil(unitPricePoints * appliedUnits),
    units,
    appliedUnits,
    unitPricePoints,
    source: 'fallback',
    category,
    free: false,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
