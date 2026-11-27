// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Crew LLM 适配器
 *
 * 通过 ai-service 的 /api/llm/complete 端点调用 LLM,复用项目已有的 LiteLLM 网关。
 * ai-service 内部优先级:ai_model_config 表(ownerUuid/providerCode 匹配) > .env 环境变量 > stub 降级。
 *
 * .env 已配置的 provider(有真实 API key):
 * - AGNES_API_KEY + AGNES_API_BASE(OpenAI 兼容)→ 模型前缀 agnes/*
 * - (stepfun 已于 2026-10-26 因订阅失效被永久除名,不再是可调用的 provider)
 * 默认模型:经 utils/retired-providers.ts 的唯一解析入口取(调用方显式 → .env LITELLM_MODEL
 * → 非退役的末位兜底链),本文件不再写死任何 provider 档。
 */
import { randomUUID } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import { config } from '../config/index.js'
import { logger } from './clawdbot/logger.js'
import { recordAiCost, resolveAiCost } from '../plugins/ai-cost.js'
import {
  quoteLlmPoints,
  settleLlmPointsUsage,
  DEFAULT_MAX_COMPLETION_TOKENS,
  MAX_COMPLETION_TOKENS,
} from './ai-points-billing.js'
import { releasePointsHold, reservePointsUsage } from './points-service.js'
import { estimateTokens } from './context-manager-service.js'
import { AppError } from '../errors/AppError.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { resolveDefaultChatModel } from '../utils/retired-providers.js'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** tool role 时必填:工具调用的 ID */
  tool_call_id?: string
  /** assistant role 且发起工具调用时:工具调用列表 */
  tool_calls?: ToolCall[]
  /** assistant role 且为 tool 调用时:工具名称(可选,用于日志) */
  name?: string
}

/** OpenAI function calling tool 定义 */
export interface LlmToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

/** LLM 返回的工具调用 */
export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface LlmCallOptions {
  /** 指定模型名(含 provider 前缀,如 agnes/agnes-2.5-flash);留空用解析出的默认模型 */
  modelId?: string
  messages: LlmMessage[]
  temperature?: number
  maxTokens?: number
  /** function calling:工具定义列表 */
  tools?: LlmToolDef[]
  /** 工具选择策略: auto(默认)/none/required */
  toolChoice?: 'auto' | 'none' | 'required'
  /** G7: 可选 userId,用于记录 AI 调用成本(不传则不记成本) */
  userId?: string
  /** G7: 可选 sessionId,用于关联 Crew 会话 */
  sessionId?: string
  /**
   * F-97: 发起调用的 Fastify request。传入时 aiServiceFetch 会透传调用者
   * Authorization,调用不再回落成系统票(系统身份);后台任务仍可留空。
   */
  request?: FastifyRequest
}

export interface LlmCallResult {
  content: string
  modelUsed: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  stub: boolean
  /** LLM 返回的工具调用(若有) */
  toolCalls?: ToolCall[]
}

/**
 * 默认模型(经 utils/retired-providers.ts 的唯一解析入口取):
 * 调用方显式模型 → .env LITELLM_MODEL → 非退役的末位兜底链。
 * stepfun 已于 2026-10-26 永久退役,这里不再写死任何退役档。
 */
const DEFAULT_MODEL = resolveDefaultChatModel()

/**
 * 调用 ai-service 的 /api/llm/complete 端点。
 *
 * 响应格式(与 ai-service app/routers/llm.py 一致):
 * - 成功: { content, model, usage, stub }
 * - 失败: { content: "", model, usage: {}, stub: false, error: true, error_message: "..." }
 */
export async function callRealLlm(opts: LlmCallOptions): Promise<LlmCallResult> {
  const model = opts.modelId || DEFAULT_MODEL
  const url = `${config.AI_SERVICE_URL}/api/llm/complete`

  const body: Record<string, unknown> = {
    messages: opts.messages.map((m) => {
      // 透传 function calling 相关字段
      const msg: Record<string, unknown> = { role: m.role, content: m.content }
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
      if (m.tool_calls) msg.tool_calls = m.tool_calls
      if (m.name) msg.name = m.name
      return msg
    }),
    model,
  }
  // 透传可选参数(LiteLLM 兼容)
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens
  if (opts.tools && opts.tools.length > 0) body.tools = opts.tools
  if (opts.toolChoice) body.tool_choice = opts.toolChoice

  // 2026-11-26: AI 调用只预检 AI 积分,不再看钱包余额;按 prompt + maxTokens 冻结。
  const billingReferenceId = `crew:${opts.sessionId ?? 'adhoc'}:${randomUUID()}`
  if (opts.userId) {
    const promptEstimate = estimateTokens(opts.messages.map((m) => m.content).join('\n'))
    const maxCompletion = Math.min(
      MAX_COMPLETION_TOKENS,
      Math.max(1, opts.maxTokens ?? DEFAULT_MAX_COMPLETION_TOKENS),
    )
    const quote = await quoteLlmPoints({
      modelId: model,
      promptTokens: promptEstimate,
      completionTokens: maxCompletion,
    })
    if (quote.pricingSource !== 'ai_pricing') {
      throw new AppError(`模型 ${model} 未配置成本定价,暂不可售`, 503, 'MODEL_PRICING_MISSING')
    }
    const reservation = await reservePointsUsage({
      userId: opts.userId,
      amount: quote.points,
      source: 'crew_llm',
      referenceId: billingReferenceId,
      modelId: model,
    })
    if (reservation.shortfall > 0) {
      throw new AppError('积分不足,请充值或兑换积分后重试', 402, 'INSUFFICIENT_POINTS')
    }
  }

  const start = Date.now()
  logger.info(
    { model, msgs: opts.messages.length, tools: opts.tools?.length ?? 0, url },
    '[CrewLLM] 调用 ai-service',
  )

  const resp = await aiServiceFetch(opts.request ?? null, '/api/llm/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    if (opts.userId) {
      await releasePointsHold({
        userId: opts.userId,
        source: 'crew_llm',
        referenceId: billingReferenceId,
      }).catch(() => undefined)
    }
    throw new Error(`ai-service /api/llm/complete HTTP ${resp.status}: ${errText.slice(0, 300)}`)
  }

  const data = (await resp.json()) as {
    content?: string
    model?: string
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    stub?: boolean
    error?: boolean
    error_message?: string
    tool_calls?: ToolCall[]
  }

  // ai-service 返回 error 字段时表示 LLM 调用失败
  if (data.error) {
    if (opts.userId) {
      await releasePointsHold({
        userId: opts.userId,
        source: 'crew_llm',
        referenceId: billingReferenceId,
      }).catch(() => undefined)
    }
    throw new Error(data.error_message || `ai-service LLM 调用失败(model=${model})`)
  }

  const u = data.usage ?? {}
  const result: LlmCallResult = {
    content: data.content ?? '',
    modelUsed: data.model ?? model,
    usage: {
      promptTokens: u.prompt_tokens ?? 0,
      completionTokens: u.completion_tokens ?? 0,
      totalTokens: u.total_tokens ?? 0,
    },
    stub: data.stub ?? false,
    toolCalls: data.tool_calls && data.tool_calls.length > 0 ? data.tool_calls : undefined,
  }

  logger.info(
    {
      model: result.modelUsed,
      elapsed: Date.now() - start,
      tokens: result.usage.totalTokens,
      stub: result.stub,
      toolCalls: result.toolCalls?.length ?? 0,
    },
    '[CrewLLM] 调用完成',
  )

  // G7: 记录 AI 调用成本(独立函数,不依赖 server)
  // stub 响应无真实 LLM 调用,跳过记成本;userId 未传时跳过(系统侧调用)
  if (opts.userId && !result.stub && result.usage.totalTokens > 0) {
    const provider = result.modelUsed.includes('/') ? result.modelUsed.split('/')[0]! : 'unknown'

    // 两本账分开:
    // - 用户积分按倍率扣(user_points),上游已发生成本不能撤回 ⇒ 部分结算;
    // - 平台成本按真实价格记(ai_cost_records),不再和用户扣费混成一个数。
    let settlement: {
      deducted: number
      remaining: number
      shortfall: number
      alreadySettled: boolean
      quote: { points: number; multiplier: number }
    } | null = null
    const actual = await resolveAiCost({
      model: result.modelUsed,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
    })
    const costCents = Math.ceil(actual.cost)
    try {
      settlement = await settleLlmPointsUsage({
        userId: opts.userId,
        modelId: result.modelUsed,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        source: 'crew_llm',
        description: opts.sessionId ? `Crew LLM ${opts.sessionId}` : 'Crew LLM',
        referenceId: billingReferenceId,
        holdReferenceId: billingReferenceId,
      })
      if (settlement.shortfall > 0) {
        logger.warn(
          {
            userId: opts.userId,
            points: settlement.quote.points,
            deducted: settlement.deducted,
            shortfall: settlement.shortfall,
          },
          '[CrewLLM] 运行中积分不足:已扣至 0,欠额写入 ai_cost_records',
        )
      }
    } catch (e) {
      // 上游成本已发生、结果已返回:不能释放 hold 变成免费。
      // settleLlmPointsUsage 已把 hold 标成 settle_pending,由周期任务重试。
      logger.warn({ err: e }, '[CrewLLM] settleLlmPointsUsage 失败,已留待结算重试')
    }

    const billing = {
      pointsDeducted: settlement?.deducted ?? 0,
      pointsBalanceAfter: settlement?.remaining ?? null,
      billingShortfallPoints: settlement?.shortfall ?? 0,
      pointsQuote: settlement?.quote.points ?? 0,
      pointsMultiplier: settlement?.quote.multiplier ?? null,
    }

    try {
      await recordAiCost({
        userId: opts.userId,
        model: result.modelUsed,
        provider,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        requestType: opts.sessionId ? 'crew_session' : 'crew',
        // 同一 Crew 计费引用重放只落一条成本,避免与内部结算/重试双记。
        idempotencyKey: `llm_cost:${billingReferenceId}`,
        // 成本账显式传上游成本;用户积分已由 settleLlmPointsUsage 单独结算,两本账分离
        cost: costCents,
        currency: actual.currency,
        metadata: JSON.stringify({
          ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
          billing,
        }),
      })
    } catch (e) {
      logger.warn({ err: e }, '[CrewLLM] recordAiCost 失败(不影响主流程)')
    }
  }

  return result
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
