/**
 * AI 用量积分结算(2026-11-26 立)。
 *
 * 边界:
 * - 用户扣减只看 AI 积分(user_points),不再从钱包 user_margins 扣;
 * - 平台成本仍由 `ai_cost_records` 记录,和用户积分是两本账;
 * - LLM 用户价沿用 `(prompt + completion) / 1000 × 倍率`,媒体用户价读 ai_pricing。
 *
 * 本文件只处理 LLM 的“token → 积分”换算与结算,媒体仍走 media-billing。
 */
import type { FastifyReply, FastifyRequest } from 'fastify'
import { getSpendableBalance } from './daily-credits.js'
import { getPointsMultiplier } from './points-multiplier-resolver.js'
import { settlePointsUsage, type SettlePointsUsageResult } from './points-service.js'

export interface LlmPointsQuote {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  multiplier: number
  points: number
}

export interface LlmPointsSettlement extends SettlePointsUsageResult {
  quote: LlmPointsQuote
}

/** 纯换算:不足 1 积分按 1 积分,零 token / 零倍率返回 0。 */
export function computeLlmPoints(input: {
  promptTokens: number
  completionTokens: number
  multiplier: number
}): number {
  const multiplier = Number.isFinite(input.multiplier) ? Math.max(0, input.multiplier) : 0
  if (multiplier <= 0) return 0
  const tokens = Math.max(0, input.promptTokens) + Math.max(0, input.completionTokens)
  if (tokens <= 0) return 0
  return Math.ceil((tokens / 1000) * multiplier)
}

/** 读取模型当前倍率并算出应扣积分。 */
export async function quoteLlmPoints(input: {
  modelId: string
  promptTokens: number
  completionTokens: number
}): Promise<LlmPointsQuote> {
  const rawMultiplier = await getPointsMultiplier(input.modelId)
  const multiplier = Number.isFinite(rawMultiplier) ? Math.max(0, rawMultiplier) : 1
  const promptTokens = Math.max(0, Math.floor(input.promptTokens))
  const completionTokens = Math.max(0, Math.floor(input.completionTokens))
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    multiplier,
    points: computeLlmPoints({ promptTokens, completionTokens, multiplier }),
  }
}

/** 调用前预检:估算积分不够时直接 402,返回 false 表示已响应。 */
export async function ensureLlmPointsBalance(
  request: FastifyRequest,
  reply: FastifyReply,
  modelId: string,
  estimatedPromptTokens: number,
  estimatedCompletionTokens = 0,
): Promise<boolean> {
  const userId = request.userId
  if (!userId) return true
  try {
    const quote = await quoteLlmPoints({
      modelId,
      promptTokens: estimatedPromptTokens,
      completionTokens: estimatedCompletionTokens,
    })
    if (quote.multiplier <= 0 || quote.points <= 0) return true
    const balance = await getSpendableBalance(userId)
    if (balance.available < quote.points) {
      reply.status(402).send({
        code: 402,
        errorCode: 'INSUFFICIENT_POINTS',
        message: '积分不足,请充值或兑换积分后重试',
        data: {
          balance: balance.available,
          required: quote.points,
          model: modelId,
          multiplier: quote.multiplier,
        },
      })
      return false
    }
    return true
  } catch (err) {
    request.log?.error?.({ err, userId, modelId }, '[ai-points-billing] 积分预检失败')
    reply.status(503).send({
      code: 503,
      errorCode: 'POINTS_SERVICE_UNAVAILABLE',
      message: '积分服务暂不可用,请稍后重试',
    })
    return false
  }
}

/**
 * 上游成功后结算 LLM 积分。
 * 采用部分结算:余额在中途被别的请求花掉时,能扣多少扣多少,差额返回给调用方审计。
 */
export async function settleLlmPointsUsage(input: {
  userId: string
  modelId: string
  promptTokens: number
  completionTokens: number
  source: string
  description?: string
  referenceId?: string
}): Promise<LlmPointsSettlement> {
  const quote = await quoteLlmPoints(input)
  const settlement = await settlePointsUsage({
    userId: input.userId,
    amount: quote.points,
    source: input.source,
    description: input.description ?? `${input.modelId} 用量 ${quote.totalTokens} tokens`,
    referenceId: input.referenceId,
  })
  return { ...settlement, quote }
}
