// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Stock 分析服务。
 * 迁移自旧架构 services/stock_analyse_service.py。
 *
 * 真实实现：
 * 1. 调用前按 AI 积分做预检,成功后按真实 token 走 settleLlmPointsUsage 结算
 * 2. AI 模型调用走 OpenAI 兼容 API（STOCK_API_KEY / STOCK_API_BASE / STOCK_MODEL_ID）
 * 3. 分析记录持久化到 stock_analyses 表
 */

import { randomUUID } from 'node:crypto'
import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { stockAnalyses } from '@ihui/database'
import type { TokenBalanceService } from '../plugins/token-balance-service.js'
import { resolveAiCost, recordAiCost } from '../plugins/ai-cost.js'
import { quoteLlmPoints, settleLlmPointsUsage } from './ai-points-billing.js'
import { getSpendableBalance } from './daily-credits.js'
import { releasePointsHold, reservePointsUsage } from './points-service.js'
import { AppError } from '../errors/AppError.js'
import { degradedMode, getBulkhead } from '../plugins/resilience-extended.js'
import { logger } from '../utils/logger.js'

export interface StockAnalysisRequest {
  symbol: string
  question: string
  conversationId?: string
  /** 用户 ID，用于 AI 积分结算与历史归属 */
  userId?: string
}

export interface StockAnalysisResult {
  symbol: string
  analysis: string
  conversationId: string
  tokensUsed: number
  createdAt: Date
  error?: string
  mock?: boolean
}

export interface TokenBalance {
  /** 永久积分(充值/兑换/奖励,不随日界变化) */
  permanent: number
  /** 今日赠送剩余(当天有效) */
  daily: number
  /** 当前可用积分 = permanent + daily */
  remaining: number
}

// ---------------------------------------------------------------------------
// AI 模型配置（环境变量）
// ---------------------------------------------------------------------------

interface StockAIConfig {
  apiKey: string
  apiBase: string
  modelId: string
}

function getStockAIConfig(): StockAIConfig {
  return {
    apiKey: process.env.STOCK_API_KEY ?? '',
    apiBase: (process.env.STOCK_API_BASE ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
    modelId: process.env.STOCK_MODEL_ID ?? 'gpt-4o-mini',
  }
}

const SYSTEM_PROMPT =
  '你是一位专业的股票分析师，擅长从技术面、基本面和市场情绪三个维度分析股票。' +
  '请基于用户提出的问题，给出结构化、客观的分析，包含：' +
  '1. 技术指标分析（趋势、支撑/阻力位、成交量等）；' +
  '2. 基本面评估（财务数据、行业地位、估值等）；' +
  '3. 市场情绪判断（资金流向、市场热点等）；' +
  '4. 风险提示与操作建议。' +
  '注意：分析仅供参考，不构成投资建议。'

/**
 * 调用 OpenAI 兼容 chat/completions 接口。
 * 返回分析文本与实际消耗的 token 数；失败时抛出错误。
 */
async function callStockAIModel(
  symbol: string,
  question: string,
): Promise<{ content: string; tokensUsed: number }> {
  const cfg = getStockAIConfig()
  const userMessage = `股票代码：${symbol}\n问题：${question}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const resp = await fetch(`${cfg.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.modelId,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        temperature: 0.7,
      }),
      signal: controller.signal,
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      throw new Error(`AI 模型返回 ${resp.status}: ${errText.slice(0, 200)}`)
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { total_tokens?: number }
    }
    const content = data.choices?.[0]?.message?.content ?? ''
    if (!content) {
      throw new Error('AI 模型返回空内容')
    }
    const tokensUsed = data.usage?.total_tokens ?? Math.ceil(userMessage.length / 4) + 500
    return { content, tokensUsed }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 本地降级分析：当 AI 模型未配置或调用失败时返回基础结构化分析。
 */
function fallbackAnalysis(
  symbol: string,
  question: string,
): { content: string; tokensUsed: number } {
  const content =
    `【${symbol}】基础分析报告（本地降级模式）\n\n` +
    `问题：${question}\n\n` +
    `由于 AI 模型暂不可用，以下为基础分析框架：\n\n` +
    `1. 技术指标分析\n` +
    `   - 建议关注 ${symbol} 的均线系统、MACD、RSI 等关键技术指标\n` +
    `   - 重点观察近期成交量变化与价格突破/跌破关键位\n\n` +
    `2. 基本面评估\n` +
    `   - 留意最新财报数据、营收与利润增长趋势\n` +
    `   - 关注行业景气度与公司在行业中的竞争地位\n\n` +
    `3. 市场情绪判断\n` +
    `   - 观察主力资金流向与北向/南向资金动向\n` +
    `   - 留意市场热点轮动与板块效应\n\n` +
    `4. 风险提示\n` +
    `   - 以上为框架性分析，具体操作请结合实时数据\n` +
    `   - 股市有风险，投资需谨慎\n\n` +
    `（降级模式：AI 模型未配置或调用失败）`
  const tokensUsed = Math.ceil(question.length / 4) + 200
  return { content, tokensUsed }
}

// ---------------------------------------------------------------------------
// Token 余额：委托给 token-balance-service
// ---------------------------------------------------------------------------

/**
 * 查询 Stock 分析可用余额。
 * 2026-11-26 起返回 AI 积分余额(永久 + 当日赠送),不再返回钱包分。
 */
export async function getTokenBalance(
  _tokenBalance?: TokenBalanceService,
  userId?: string,
): Promise<TokenBalance> {
  if (!userId) return { permanent: 0, daily: 0, remaining: 0 }
  const balance = await getSpendableBalance(userId)
  return {
    permanent: balance.permanent,
    daily: balance.daily,
    remaining: balance.available,
  }
}

// ---------------------------------------------------------------------------
// DB 持久化
// ---------------------------------------------------------------------------

async function persistAnalysis(
  req: StockAnalysisRequest,
  result: StockAnalysisResult,
  modelId: string,
): Promise<void> {
  try {
    await db.insert(stockAnalyses).values({
      userId: req.userId ?? null,
      symbol: result.symbol,
      question: req.question,
      analysis: result.analysis,
      model: modelId,
      conversationId: result.conversationId,
      tokensUsed: result.tokensUsed,
    })
  } catch (err) {
    // 表不存在或其他 DB 异常时不影响主流程
    logger.error('[stock-service] 持久化分析记录失败', { error: (err as Error).message })
  }
}

// ---------------------------------------------------------------------------
// 核心分析流程
// ---------------------------------------------------------------------------

/**
 * 执行 Stock 分析。
 * 1. 校验并扣减 Token（通过 tokenBalance 服务）
 * 2. 调用真实 AI 模型（OpenAI 兼容 API），失败时降级为本地分析
 * 3. 将分析记录保存到 DB
 */
export async function executeStockAnalysis(
  req: StockAnalysisRequest,
  _tokenBalance?: TokenBalanceService,
): Promise<StockAnalysisResult> {
  const cfg = getStockAIConfig()
  const isConfigured = !!cfg.apiKey && !!process.env.STOCK_API_BASE

  // API 未配置时返回明确的 mock 响应（而非假装返回真实数据）
  if (!isConfigured) {
    return {
      symbol: req.symbol,
      analysis: '',
      conversationId: req.conversationId ?? `stock-${Date.now()}`,
      tokensUsed: 0,
      createdAt: new Date(),
      error: 'Stock API not configured',
      mock: true,
    }
  }

  // 2026-11-26: Stock 分析只扣 AI 积分,不再预扣钱包;按输入 + 800 输出冻结。
  const billingReferenceId = `stock:${req.conversationId ?? 'adhoc'}:${randomUUID()}`
  const inputTokens = Math.ceil(req.question.length / 4)
  const estimatedCompletionTokens = 800
  const quote = await quoteLlmPoints({
    modelId: cfg.modelId,
    promptTokens: inputTokens,
    completionTokens: estimatedCompletionTokens,
  })
  if (quote.pricingSource !== 'ai_pricing') {
    throw new AppError(`模型 ${cfg.modelId} 未配置成本定价,暂不可售`, 503, 'MODEL_PRICING_MISSING')
  }
  if (req.userId) {
    const reservation = await reservePointsUsage({
      userId: req.userId,
      amount: quote.points,
      source: 'stock_analysis',
      referenceId: billingReferenceId,
      modelId: cfg.modelId,
    })
    if (reservation.shortfall > 0) {
      throw new AppError(
        `积分不足: 需要 ${quote.points} 积分, 剩余 ${reservation.remaining} 积分`,
        402,
        'INSUFFICIENT_POINTS',
      )
    }
  }

  // 2. 调用真实 AI 模型（调用失败时降级为本地分析；Bulkhead 限制并发）
  // 降级为本地分析时上游没有产生 AI 成本,不扣积分、不记成本。
  let degraded = false
  const ai = await degradedMode(
    () => getBulkhead('stock-ai', 5, 20).execute(() => callStockAIModel(req.symbol, req.question)),
    fallbackAnalysis(req.symbol, req.question),
    (err) => {
      degraded = true
      logger.error('[stock-service] AI 模型调用失败, 降级为本地分析', { error: err.message })
    },
  )

  if (degraded && req.userId) {
    await releasePointsHold({
      userId: req.userId,
      source: 'stock_analysis',
      referenceId: billingReferenceId,
    }).catch(() => undefined)
  }

  const result: StockAnalysisResult = {
    symbol: req.symbol,
    analysis: ai.content,
    conversationId: req.conversationId ?? `stock-${Date.now()}`,
    tokensUsed: ai.tokensUsed,
    createdAt: new Date(),
  }

  // 3. 两本账分开:用户积分按倍率扣;平台成本按真实价格记 ai_cost_records。
  if (!degraded && req.userId) {
    const completionTokens =
      ai.tokensUsed > 0 ? Math.max(0, ai.tokensUsed - inputTokens) : estimatedCompletionTokens
    try {
      const settlement = await settleLlmPointsUsage({
        userId: req.userId,
        modelId: cfg.modelId,
        promptTokens: inputTokens,
        completionTokens,
        source: 'stock_analysis',
        description: `Stock ${req.symbol}`,
        referenceId: billingReferenceId,
        holdReferenceId: billingReferenceId,
      })
      if (settlement.shortfall > 0) {
        logger.warn('[stock-service] 积分不足,已部分扣费', {
          userId: req.userId,
          points: settlement.quote.points,
          deducted: settlement.deducted,
        })
      }
    } catch (err) {
      // 上游 AI 已实际调用并返回内容:不能释放 hold 变成免费。
      // settleLlmPointsUsage 已标记 settle_pending,交给周期任务重试。
      logger.error('[stock-service] 积分结算失败,已留待结算重试', {
        error: (err as Error).message,
      })
    }

    try {
      const actual = await resolveAiCost({
        model: cfg.modelId,
        promptTokens: inputTokens,
        completionTokens,
      })
      await recordAiCost({
        userId: req.userId,
        model: cfg.modelId,
        provider: 'stock',
        promptTokens: inputTokens,
        completionTokens,
        totalTokens: ai.tokensUsed,
        requestType: 'stock_analysis',
        // 同一股票分析计费引用只落一条成本。
        idempotencyKey: `llm_cost:${billingReferenceId}`,
        cost: Math.ceil(actual.cost),
        currency: actual.currency,
      })
    } catch (err) {
      logger.error('[stock-service] AI 成本记账失败', { error: (err as Error).message })
    }
  }

  // 4. DB 持久化（失败不影响返回）
  await persistAnalysis(req, result, cfg.modelId)

  return result
}

/**
 * 获取历史分析记录（分页）。
 * 从 stock_analyses 表查询；表不存在或查询失败时返回空列表。
 */
export async function getStockHistory(
  symbol: string | null,
  page: number,
  pageSize: number,
  userId?: string,
): Promise<{ list: StockAnalysisResult[]; total: number }> {
  try {
    const offset = (page - 1) * pageSize
    const conditions = []
    if (symbol) conditions.push(eq(stockAnalyses.symbol, symbol))
    if (userId) conditions.push(eq(stockAnalyses.userId, userId))
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const rows = await db
      .select()
      .from(stockAnalyses)
      .where(where)
      .orderBy(desc(stockAnalyses.createdAt))
      .limit(pageSize)
      .offset(offset)

    const totalRows = await db.select({ c: count() }).from(stockAnalyses).where(where)

    const list: StockAnalysisResult[] = rows.map((r) => ({
      symbol: r.symbol,
      analysis: r.analysis,
      conversationId: r.conversationId ?? `stock-${r.id}`,
      tokensUsed: r.tokensUsed,
      createdAt: r.createdAt,
    }))

    return { list, total: totalRows[0]?.c ?? 0 }
  } catch (err) {
    logger.error('[stock-service] 查询历史记录失败', { error: (err as Error).message })
    return { list: [], total: 0 }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
