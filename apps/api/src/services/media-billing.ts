// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 媒体生成计费(2026-11-26 全收费/fail-closed 版)。
 *
 * 唯一报价源:
 *   `media-billing-pricing.ts` 的 `quoteMediaPoints` 读 `ai_pricing` 的
 *   `per_image` / `per_video` / `per_call` + `per_unit_price`(分)。
 *   1 积分 = 1 分钱，不再叠加模型倍率；没有定价行一律拒绝，不再回落兜底价。
 *
 * 三条硬约束:
 *   ① 未定价不卖:预检阶段直接 503，不让用户跑到上游才发现无法计价；
 *   ② 预扣冻结:开工前按本次报价冻结积分，结算按真实用量扣费并释放差额；
 *   ③ 幂等:同一 `referenceId` 只扣一次，重试/重复推送不会二次扣费。
 */
import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  getActivePointsHoldAmount,
  releasePointsHold,
  reservePointsUsage,
  settlePointsUsage,
} from './points-service.js'
import { findActivePricingForMode } from './pricing-service.js'
import { recordAiCost } from '../plugins/ai-cost.js'
import {
  quoteMediaPoints,
  requiredBillingMode,
  type MediaCategory,
  type MediaPointsQuote,
} from './media-billing-pricing.js'

export type { MediaCategory }
export { requiredBillingMode }

/** 积分流水 source 标识；幂等查重与对账都按它定位。 */
export const MEDIA_BILLING_SOURCE = 'ai_media'

/** 媒体任务(尤其视频)排队+生成可能超过 15 分钟;冻结期放宽到 60 分钟。 */
const MEDIA_HOLD_TTL_MS = 60 * 60 * 1000

/**
 * 解析当前模型/类别的唯一报价。
 *
 * - `ai_pricing` 有匹配的 `per_image` / `per_video` / `per_call` 行 ⇒ 按分价报价；
 * - 没有匹配行、模式不匹配、单价 <= 0 ⇒ 返回 null（不可售）。
 */
export async function resolveMediaPointsQuote(
  modelId: string,
  category: MediaCategory,
  units = 1,
): Promise<MediaPointsQuote | null> {
  const pricing = await findActivePricingForMode(modelId, requiredBillingMode(category))
  if (!pricing) return null
  return quoteMediaPoints({
    category,
    units,
    pricing: {
      billingMode: pricing.billingMode,
      perUnitPrice: pricing.perUnitPrice,
      videoUnit: pricing.videoUnit,
      costUnitPrice: pricing.costUnitPrice,
    },
  })
}

/**
 * 调用前预检 + 冻结。按本次报价金额冻结，而不是只判断 >0：
 * 视频按秒可能上千积分，余额 1 也放行的话用户会跑到上游才发现扣不动。
 *
 * 返回 false 表示已响应 402/503，调用方直接 return。
 */
export async function ensureMediaPointsBalance(
  request: FastifyRequest,
  reply: FastifyReply,
  modelId: string,
  category: MediaCategory,
  units = 1,
): Promise<boolean> {
  const quote = await resolveMediaPointsQuote(modelId, category, units)
  if (!quote) {
    reply.status(503).send({
      code: 503,
      errorCode: 'MEDIA_PRICING_MISSING',
      message: `该模型未配置${categoryLabel(category)}定价，暂不可售;请联系管理员补价后再试`,
      data: { model: modelId, category, units },
    })
    return false
  }

  const userId = request.userId
  if (!userId) return true

  try {
    const reservation = await reservePointsUsage({
      userId,
      amount: quote.points,
      source: MEDIA_BILLING_SOURCE,
      referenceId: request.id,
      modelId,
      ttlMs: MEDIA_HOLD_TTL_MS,
    })
    // 同 LLM:request.id 可被客户端伪造复用,已结算/在跑的引用不能再放上游。
    if (reservation.alreadySettled) {
      reply.status(409).send({
        code: 409,
        errorCode: 'DUPLICATE_REQUEST',
        message: '该请求已完成计费,不能重复生成;请发起新的请求',
      })
      return false
    }
    if (reservation.alreadyHeld) {
      reply.status(409).send({
        code: 409,
        errorCode: 'REQUEST_IN_PROGRESS',
        message: '该请求正在处理中,请勿重复提交',
      })
      return false
    }
    if (reservation.shortfall > 0) {
      reply.status(402).send({
        code: 402,
        errorCode: 'INSUFFICIENT_POINTS',
        message: `积分不足:本次${categoryLabel(category)}约需 ${quote.points} 积分,当前可用 ${reservation.remaining}`,
        data: {
          balance: reservation.remaining,
          required: quote.points,
          category,
          units: quote.units,
          applied_units: quote.appliedUnits,
          unit_points: quote.unitPricePoints,
          model: modelId,
        },
      })
      return false
    }
    return true
  } catch (err) {
    request.log?.error?.({ err, userId, modelId, category }, '[media-billing] 积分预检失败')
    reply.status(503).send({
      code: 503,
      errorCode: 'POINTS_SERVICE_UNAVAILABLE',
      message: '积分服务暂不可用,请稍后重试',
    })
    return false
  }
}

/**
 * 生成成功后扣分。返回实际扣掉的积分(0 = 已扣过/扣分失败)。
 *
 * `referenceId` 必须是稳定唯一的业务引用(任务 id / request.id)；
 * `holdReferenceId` 默认 request.id，与预检冻结的 hold 对齐。
 */
export async function chargeMediaPoints(
  request: FastifyRequest,
  modelId: string,
  category: MediaCategory,
  units: number,
  referenceId: string,
  holdReferenceId = request.id,
): Promise<number> {
  const quote = await resolveMediaPointsQuote(modelId, category, units)
  const userId = request.userId
  if (!userId || !referenceId) return 0
  if (!quote) {
    // 预检时已有定价、产物交付时定价行刚好过期/被下架:不能 0 元放走。
    // 按开工前冻结的金额结算(那是用户当时确认过的最高价),无 hold 才留告警。
    const holdAmount = await getActivePointsHoldAmount({
      userId,
      source: MEDIA_BILLING_SOURCE,
      referenceId: holdReferenceId,
    })
    if (holdAmount !== null && holdAmount > 0) {
      try {
        const settlement = await settlePointsUsage({
          userId,
          amount: holdAmount,
          source: MEDIA_BILLING_SOURCE,
          description:
            `媒体定价行失效,按预扣额结算(model=${modelId}, category=${category}, reference=${referenceId})`.slice(
              0,
              255,
            ),
          referenceId,
          holdReferenceId,
        })
        request.log.warn(
          {
            model: modelId,
            category,
            units,
            referenceId,
            holdAmount,
            deducted: settlement.deducted,
          },
          '[media-billing] 定价行失效,已按预扣额结算;请立即补价',
        )
        return settlement.alreadySettled ? 0 : settlement.deducted
      } catch (err) {
        request.log.error(
          { err, model: modelId, category, units, referenceId, holdAmount },
          '[media-billing] 定价行失效且预扣额结算失败(产物已交付)',
        )
        return 0
      }
    }
    request.log.warn(
      { model: modelId, category, units, referenceId },
      '[media-billing] 产物已交付但定价行缺失且无有效预扣,无法扣分;已留成本告警',
    )
    return 0
  }

  let deducted = 0
  let alreadySettled = false
  try {
    const settlement = await settlePointsUsage({
      userId,
      amount: quote.points,
      source: MEDIA_BILLING_SOURCE,
      description:
        `媒体生成扣分(${category}, model=${modelId}, units=${quote.appliedUnits}, unit=${quote.unitPricePoints}, source=${quote.source})`.slice(
          0,
          255,
        ),
      referenceId,
      holdReferenceId,
    })
    alreadySettled = settlement.alreadySettled
    deducted = alreadySettled ? 0 : settlement.deducted
    if (!alreadySettled && settlement.shortfall > 0) {
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
  } catch (err) {
    // 结算失败:主动释放 hold,避免余额被锁到 TTL;产物已给用户,不能吞掉结果。
    await releasePointsHold({
      userId,
      source: MEDIA_BILLING_SOURCE,
      referenceId: holdReferenceId,
    }).catch(() => undefined)
    request.log.warn(
      { err, model: modelId, category, units, referenceId },
      '[media-billing] 扣分失败(产物已交付,不阻塞响应)',
    )
  }

  // 成本账独立于积分账:重复回调命中积分幂等时不再重复写成本。
  if (!alreadySettled) {
    const costCents = quote.costCents
    if (costCents === null) {
      request.log.warn(
        { model: modelId, category, units, referenceId },
        '[media-billing] 成本价缺失,本次不写 0 成本;请补 ai_pricing.cost_unit_price',
      )
    } else {
      try {
        await recordAiCost({
          userId,
          model: modelId,
          provider: modelId.includes('/') ? (modelId.split('/')[0] ?? 'media') : 'media',
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: costCents,
          currency: 'CNY',
          requestType: `media_${category}`,
          costStatus: costCents > 0 ? 'priced' : 'zero_cost',
          metadata: JSON.stringify({
            category,
            units: quote.units,
            appliedUnits: quote.appliedUnits,
            referenceId,
            userPricePoints: quote.points,
            priceSource: quote.source,
            costStatus: costCents > 0 ? 'priced' : 'zero_cost',
          }),
        })
      } catch (err) {
        request.log.warn(
          { err, model: modelId, category, units, referenceId, costCents },
          '[media-billing] 平台成本落账失败(产物已交付,不阻塞响应)',
        )
      }
    }
  }

  return deducted
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
