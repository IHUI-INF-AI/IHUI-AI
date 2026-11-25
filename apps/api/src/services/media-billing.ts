// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 媒体生成计费(2026-11-21 立,2026-11-25 收口到 ai_pricing 单一真源)。
 *
 * 为什么要有这一层:
 *   LLM 走 `chargePointsForCall` 的"按 token 数扣分",而图像/视频上游从不返回 token 用量
 *   —— `extractTokenUsage` 恒得 0,于是 `totalTokens <= 0` 直接跳过扣分。媒体必须有独立
 *   的按张/按秒报价,否则平台付了上游成本、用户一分不扣。
 *
 * 唯一报价源:
 *   `media-billing-pricing.ts` 的 `quoteMediaPoints` 读 `ai_pricing` 的
 *   `per_image` / `per_video` + `per_unit_price`(分)。1 积分 = 1 分钱,
 *   所以不再叠加 `points_multiplier`;缺失定价行才回落到统一兜底表。
 *
 * 三条硬约束:
 *   ① **不预扣**:先调上游,只有拿到可用产物(可渲染图片地址 / 已创建的任务)才扣分。
 *   ② **不阻塞**:扣分异常只记日志,不把已经生成成功的产物吞掉。
 *   ③ **幂等**:同一 `referenceId` 只扣一次,重试/重复推送不会二次扣费。
 */
import type { FastifyReply, FastifyRequest } from 'fastify'
import { getSpendableBalance } from './daily-credits.js'
import { settlePointsUsage } from './points-service.js'
import { inferPointsMultiplier } from './points-multiplier.js'
import { findActivePricingForMode } from './pricing-service.js'
import {
  MEDIA_FALLBACK_UNIT_POINTS,
  quoteMediaPoints,
  type MediaCategory,
  type MediaPointsQuote,
} from './media-billing-pricing.js'

export type { MediaCategory }
export { MEDIA_FALLBACK_UNIT_POINTS }

/** 积分流水 source 标识;幂等查重与对账都按它定位。 */
export const MEDIA_BILLING_SOURCE = 'ai_media'

/**
 * 解析当前模型/类别的唯一报价。
 *
 * - `ai_pricing` 有匹配的 `per_image` / `per_video` 行 ⇒ 按行里的分价报价;
 * - 没有匹配行 ⇒ 回落 `MEDIA_FALLBACK_UNIT_POINTS`;
 * - 免费模型(`inferPointsMultiplier === 0`)且没有显式媒体价 ⇒ 0 积分。
 */
export async function resolveMediaPointsQuote(
  modelId: string,
  category: MediaCategory,
  units = 1,
): Promise<MediaPointsQuote> {
  const pricing =
    category === 'image'
      ? await findActivePricingForMode(modelId, 'per_image')
      : category === 'video'
        ? await findActivePricingForMode(modelId, 'per_video')
        : undefined
  const pricingMode = category === 'image' ? 'per_image' : 'per_video'
  const hasExplicitMediaPrice =
    !!pricing &&
    typeof pricing.perUnitPrice === 'number' &&
    pricing.perUnitPrice >= 0 &&
    pricing.billingMode === pricingMode
  const free = !hasExplicitMediaPrice && inferPointsMultiplier(modelId) === 0

  return quoteMediaPoints({
    category,
    units,
    pricing: pricing
      ? {
          billingMode: pricing.billingMode,
          perUnitPrice: pricing.perUnitPrice,
          videoUnit: pricing.videoUnit,
        }
      : null,
    free,
  })
}

/**
 * 调用前余额预检。按本次报价金额判,而不是只判 >0:
 * 视频 20 积分起、按秒视频可能上千积分,余额 1 也放行的话用户会跑到上游才发现扣不动。
 * 返回 false 表示已响应 402,调用方直接 return。
 */
export async function ensureMediaPointsBalance(
  request: FastifyRequest,
  reply: FastifyReply,
  modelId: string,
  category: MediaCategory,
  units = 1,
): Promise<boolean> {
  const quote = await resolveMediaPointsQuote(modelId, category, units)
  const required = quote.points
  if (required <= 0) return true
  const userId = request.userId
  if (!userId) return true
  const { available: balance } = await getSpendableBalance(userId)
  if (balance >= required) return true
  reply.status(402).send({
    code: 402,
    errorCode: 'INSUFFICIENT_POINTS',
    message: `积分不足:本次${categoryLabel(category)}约需 ${required} 积分,当前余额 ${balance}`,
    data: {
      balance,
      required,
      category,
      units: quote.units,
      applied_units: quote.appliedUnits,
      unit_points: quote.unitPricePoints,
      price_source: quote.source,
    },
  })
  return false
}

/**
 * 生成成功后扣分。返回实际扣掉的积分(0 = 未扣:免费 / 已扣过 / 扣分失败)。
 * 调用点必须在**产物已确认可用之后**,且传一条稳定唯一的 referenceId。
 *
 * 与 LLM 结算同一套部分结算语义:预检后余额被并发花掉时,扣到 0 并记录 shortfall,
 * 不因为余额不足就整笔放弃,避免平台承担上游成本却一分不收。
 */
export async function chargeMediaPoints(
  request: FastifyRequest,
  modelId: string,
  category: MediaCategory,
  units: number,
  referenceId: string,
): Promise<number> {
  const quote = await resolveMediaPointsQuote(modelId, category, units)
  const amount = quote.points
  if (amount <= 0) return 0
  const userId = request.userId
  if (!userId || !referenceId) return 0
  try {
    const settlement = await settlePointsUsage({
      userId,
      amount,
      source: MEDIA_BILLING_SOURCE,
      description: `媒体生成扣分(${category}, model=${modelId}, units=${quote.appliedUnits}, unit=${quote.unitPricePoints}, source=${quote.source})`.slice(
        0,
        255,
      ),
      referenceId,
    })
    if (settlement.alreadySettled) return 0
    if (settlement.shortfall > 0) {
      request.log.warn(
        {
          model: modelId,
          category,
          units,
          referenceId,
          shortfall: settlement.shortfall,
          deducted: settlement.deducted,
        },
        '[media-billing] 积分不足,已部分结算',
      )
    }
    return settlement.deducted
  } catch (err) {
    // 余额在预检与扣分之间被并发消耗等情形:产物已给用户,不能因扣分失败吞掉结果。
    request.log.warn(
      { err, model: modelId, category, units, referenceId },
      '[media-billing] 扣分失败(产物已交付,不阻塞响应)',
    )
    return 0
  }
}

function categoryLabel(category: MediaCategory): string {
  switch (category) {
    case 'image':
      return '出图'
    case 'video':
      return '出片'
    case 'audio':
      return '语音'
    case 'voiceprint':
      return '声纹'
    case 'video_compose':
      return '视频合成'
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
