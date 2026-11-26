// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 用量积分结算(2026-11-26 成本加成版)。
 *
 * 边界:
 * - 用户扣减只看 AI 积分(user_points),不再从钱包 user_margins 扣;
 * - 平台成本仍由 `ai_cost_records` 记录,和用户积分是两本账;
 * - LLM 用户价不再用单一 `points_multiplier` 乘总 token,而是输入/输出分开:
 *     points = ceil(prompt/1000 × input_points_per_1k + completion/1000 × output_points_per_1k)
 *   费率由 `llm-points-pricing` 从 `ai_pricing` 成本价 × 3 生成。
 * - 没有 token 定价行的模型 fail-closed,不允许零价放行;
 * - 开工前按 prompt + max_tokens 冻结积分,结算按真实 usage 多退少补。
 */
import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  LLM_UNKNOWN_POINTS_PER_1K,
  getLlmPointsRates,
  type LlmPointsRates,
} from './llm-points-pricing.js'
import {
  getPointsHoldPricingSnapshot,
  reservePointsUsage,
  settlePointsUsage,
  type ReservePointsUsageResult,
  type SettlePointsUsageResult,
} from './points-service.js'

/** 预检默认输出上限:请求未显式传 max_tokens 时,按 4K 输出冻结,避免无上限白跑。 */
export const DEFAULT_MAX_COMPLETION_TOKENS = 4096
/** 硬上限,防止客户端塞一个超大 max_tokens 把余额冻结成负数。 */
export const MAX_COMPLETION_TOKENS = 131_072

export interface LlmPointsQuote {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** 实际应扣积分 */
  points: number
  inputPointsPer1k: number
  outputPointsPer1k: number
  /** 展示用单值:输入/输出较高的一侧 */
  multiplier: number
  /** ai_pricing 命中的 model_id;null = 无定价,使用保守默认 */
  pricingModelId: string | null
  pricingSource: 'ai_pricing' | 'unknown_default'
}

export interface LlmPointsSettlement extends SettlePointsUsageResult {
  quote: LlmPointsQuote
}

/** 纯换算:输入/输出分开计价,不足 1 积分按 1 积分;零 token 返回 0。 */
export function computeLlmPoints(input: {
  promptTokens: number
  completionTokens: number
  inputPointsPer1k: number
  outputPointsPer1k: number
}): number {
  const promptTokens = Math.max(0, Math.floor(input.promptTokens))
  const completionTokens = Math.max(0, Math.floor(input.completionTokens))
  const inputRate = Number.isFinite(input.inputPointsPer1k)
    ? Math.max(0, input.inputPointsPer1k)
    : 0
  const outputRate = Number.isFinite(input.outputPointsPer1k)
    ? Math.max(0, input.outputPointsPer1k)
    : 0
  if (promptTokens + completionTokens <= 0) return 0
  const raw = (promptTokens / 1000) * inputRate + (completionTokens / 1000) * outputRate
  if (raw <= 0) return 0
  return Math.max(1, Math.ceil(raw))
}

/** 从请求体读取客户端声明的最大输出 token;未声明时用 4K,硬上限 128K。 */
export function readMaxCompletionTokens(
  body: unknown,
  fallback = DEFAULT_MAX_COMPLETION_TOKENS,
): number {
  const obj = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const raw =
    obj.max_tokens ??
    obj.max_completion_tokens ??
    obj.maxTokens ??
    obj.max_output_tokens ??
    fallback
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(MAX_COMPLETION_TOKENS, Math.max(1, Math.floor(n)))
}

function ratesForQuote(rates: LlmPointsRates | null): {
  inputPointsPer1k: number
  outputPointsPer1k: number
  pricingModelId: string | null
  pricingSource: 'ai_pricing' | 'unknown_default'
} {
  if (rates) {
    return {
      inputPointsPer1k: rates.inputPointsPer1k,
      outputPointsPer1k: rates.outputPointsPer1k,
      pricingModelId: rates.pricingModelId,
      pricingSource: 'ai_pricing',
    }
  }
  return {
    inputPointsPer1k: LLM_UNKNOWN_POINTS_PER_1K,
    outputPointsPer1k: LLM_UNKNOWN_POINTS_PER_1K,
    pricingModelId: null,
    pricingSource: 'unknown_default',
  }
}

/** 预扣快照里的费率(结算按它算,避免调价影响在途请求)。 */
export interface LlmRatesOverride {
  inputPointsPer1k: number
  outputPointsPer1k: number
  pricingModelId?: string | null
  pricingSource?: string
}

/** 读取模型当前费率并算出应扣积分。 */
export async function quoteLlmPoints(input: {
  modelId: string
  promptTokens: number
  completionTokens: number
  /** 结算时传预扣快照;缺省才读当前费率 */
  ratesOverride?: LlmRatesOverride | null
}): Promise<LlmPointsQuote> {
  const rates = input.ratesOverride ? null : await getLlmPointsRates(input.modelId)
  const effective = input.ratesOverride
    ? {
        inputPointsPer1k: input.ratesOverride.inputPointsPer1k,
        outputPointsPer1k: input.ratesOverride.outputPointsPer1k,
        pricingModelId: input.ratesOverride.pricingModelId ?? null,
        pricingSource: (input.ratesOverride.pricingSource ??
          'ai_pricing') as LlmPointsQuote['pricingSource'],
      }
    : ratesForQuote(rates)
  const promptTokens = Math.max(0, Math.floor(input.promptTokens))
  const completionTokens = Math.max(0, Math.floor(input.completionTokens))
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    points: computeLlmPoints({
      promptTokens,
      completionTokens,
      inputPointsPer1k: effective.inputPointsPer1k,
      outputPointsPer1k: effective.outputPointsPer1k,
    }),
    inputPointsPer1k: effective.inputPointsPer1k,
    outputPointsPer1k: effective.outputPointsPer1k,
    multiplier: Math.max(effective.inputPointsPer1k, effective.outputPointsPer1k),
    pricingModelId: effective.pricingModelId,
    pricingSource: effective.pricingSource,
  }
}

/** 预检失败的结构化结果:HTTP/WS 共用同一套错误码与文案,避免两条通道漂移。 */
export interface LlmReservationFailure {
  ok: false
  status: number
  errorCode: string
  message: string
  data?: Record<string, unknown>
}

export interface LlmReservationSuccess {
  ok: true
  userId: string
  referenceId: string
  source: string
  quote: LlmPointsQuote
  reservation: ReservePointsUsageResult
}

export type LlmReservationResult = LlmReservationSuccess | LlmReservationFailure

/**
 * 预检 + 冻结的结构化入口(不直接写 HTTP 响应)。
 *
 * WS 通道无法用 FastifyReply,所以把“报价 → 未定价/异常拦截 → 冻结 → 重放/并发拦截
 * → 余额不足拦截”收在这里;HTTP 的 `ensureLlmPointsBalance` 只是它的一层 reply 适配。
 */
export async function reserveLlmPoints(input: {
  userId: string
  modelId: string
  promptTokens: number
  maxCompletionTokens?: number
  source?: string
  referenceId: string
}): Promise<LlmReservationResult> {
  const maxCompletionTokens = input.maxCompletionTokens ?? DEFAULT_MAX_COMPLETION_TOKENS
  const quote = await quoteLlmPoints({
    modelId: input.modelId,
    promptTokens: input.promptTokens,
    completionTokens: maxCompletionTokens,
  })
  if (quote.pricingSource !== 'ai_pricing') {
    return {
      ok: false,
      status: 503,
      errorCode: 'MODEL_PRICING_MISSING',
      message: '该模型未配置成本定价,暂不可售;请联系管理员补价后再试',
      data: { model: input.modelId },
    }
  }
  if (quote.points <= 0) {
    return {
      ok: false,
      status: 503,
      errorCode: 'MODEL_PRICING_INVALID',
      message: '该模型定价异常,暂不可售',
      data: { model: input.modelId, pricingModelId: quote.pricingModelId },
    }
  }

  const source = input.source ?? 'llm_chat'
  const reservation = await reservePointsUsage({
    userId: input.userId,
    amount: quote.points,
    source,
    referenceId: input.referenceId,
    modelId: input.modelId,
    pricingSnapshot: {
      inputPointsPer1k: quote.inputPointsPer1k,
      outputPointsPer1k: quote.outputPointsPer1k,
      pricingModelId: quote.pricingModelId,
      pricingSource: quote.pricingSource,
      frozenAt: new Date().toISOString(),
    },
  })
  if (reservation.alreadySettled) {
    return {
      ok: false,
      status: 409,
      errorCode: 'DUPLICATE_REQUEST',
      message: '该请求已完成计费,不能重复调用;请发起新的请求',
    }
  }
  if (reservation.alreadyHeld) {
    return {
      ok: false,
      status: 409,
      errorCode: 'REQUEST_IN_PROGRESS',
      message: '该请求正在处理中,请勿重复提交',
    }
  }
  if (reservation.shortfall > 0) {
    return {
      ok: false,
      status: 402,
      errorCode: 'INSUFFICIENT_POINTS',
      message: '积分不足,请充值或兑换积分后重试',
      data: {
        balance: reservation.remaining,
        required: quote.points,
        model: input.modelId,
        maxCompletionTokens,
        inputPointsPer1k: quote.inputPointsPer1k,
        outputPointsPer1k: quote.outputPointsPer1k,
        pricingModelId: quote.pricingModelId,
      },
    }
  }
  return {
    ok: true,
    userId: input.userId,
    referenceId: input.referenceId,
    source,
    quote,
    reservation,
  }
}

/**
 * 调用前预检 + 冻结(HTTP 适配层)。
 *
 * - 未定价模型直接 503,不再用“免费模型”放行;
 * - 按 prompt + 本次声明的 max_tokens 冻结,并发请求不能重复使用同一笔余额;
 * - 返回 false 表示已响应,调用方直接 return。
 */
export async function ensureLlmPointsBalance(
  request: FastifyRequest,
  reply: FastifyReply,
  modelId: string,
  estimatedPromptTokens: number,
  maxCompletionTokens = DEFAULT_MAX_COMPLETION_TOKENS,
  options: { source?: string; referenceId?: string } = {},
): Promise<boolean> {
  const userId = request.userId
  if (!userId) return true
  try {
    const result = await reserveLlmPoints({
      userId,
      modelId,
      promptTokens: estimatedPromptTokens,
      maxCompletionTokens,
      source: options.source ?? 'llm_chat',
      referenceId: options.referenceId ?? request.id,
    })
    if (!result.ok) {
      reply.status(result.status).send({
        code: result.status,
        errorCode: result.errorCode,
        message: result.message,
        ...(result.data ? { data: result.data } : {}),
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
 * 有 hold 时先释放 hold,再按真实 usage 扣费:多冻结的部分自动退回。
 */
export async function settleLlmPointsUsage(input: {
  userId: string
  modelId: string
  promptTokens: number
  completionTokens: number
  source: string
  description?: string
  referenceId?: string
  holdReferenceId?: string
  holdSource?: string
}): Promise<LlmPointsSettlement> {
  const holdSource = input.holdSource ?? input.source
  const holdReferenceId = input.holdReferenceId ?? input.referenceId
  let ratesOverride: LlmRatesOverride | null = null
  if (holdReferenceId) {
    const snap = await getPointsHoldPricingSnapshot({
      userId: input.userId,
      source: holdSource,
      referenceId: holdReferenceId,
    })
    if (
      snap &&
      typeof snap.inputPointsPer1k === 'number' &&
      Number.isFinite(snap.inputPointsPer1k) &&
      typeof snap.outputPointsPer1k === 'number' &&
      Number.isFinite(snap.outputPointsPer1k)
    ) {
      ratesOverride = {
        inputPointsPer1k: snap.inputPointsPer1k,
        outputPointsPer1k: snap.outputPointsPer1k,
        pricingModelId: typeof snap.pricingModelId === 'string' ? snap.pricingModelId : undefined,
        pricingSource: snap.pricingSource === 'unknown_default' ? 'unknown_default' : 'ai_pricing',
      }
    }
  }
  const quote = await quoteLlmPoints({ ...input, ratesOverride })
  const settlement = await settlePointsUsage({
    userId: input.userId,
    amount: quote.points,
    source: input.source,
    description: input.description ?? `${input.modelId} 用量 ${quote.totalTokens} tokens`,
    referenceId: input.referenceId,
    holdReferenceId,
    holdSource,
  })
  return { ...settlement, quote }
}

export type { ReservePointsUsageResult }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
