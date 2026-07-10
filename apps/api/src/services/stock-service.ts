/**
 * Stock 分析服务。
 * 迁移自旧架构 services/stock_analyse_service.py。
 *
 * 真实实现：
 * 1. Token 余额通过 token-balance-service 插件（server.tokenBalance）扣减
 * 2. AI 模型调用走 OpenAI 兼容 API（STOCK_API_KEY / STOCK_API_BASE / STOCK_MODEL_ID）
 * 3. 分析记录持久化到 stock_analyses 表
 */

import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { stockAnalyses } from '@ihui/database'
import type { TokenBalanceService } from '../plugins/token-balance-service.js'
import { degradedMode, getBulkhead } from '../plugins/resilience-extended.js'

export interface StockAnalysisRequest {
  symbol: string
  question: string
  conversationId?: string
  /** 用户 ID，用于 Token 扣费与历史归属 */
  userId?: string
}

export interface StockAnalysisResult {
  symbol: string
  analysis: string
  conversationId: string
  tokensUsed: number
  createdAt: Date
}

export interface TokenBalance {
  total: number
  used: number
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
 * 查询 Token 余额。
 * 传入 tokenBalance 服务与 userId 时从服务读取真实余额；否则返回默认值。
 */
export async function getTokenBalance(
  tokenBalance?: TokenBalanceService,
  userId?: string,
): Promise<TokenBalance> {
  if (tokenBalance && userId) {
    try {
      const info = await tokenBalance.getBalance(userId)
      return {
        total: info.monthlyQuota,
        used: Math.max(0, info.monthlyQuota - info.balance),
        remaining: info.balance,
      }
    } catch {
      // 查询失败降级返回默认
    }
  }
  return { total: 10000, used: 0, remaining: 10000 }
}

/**
 * 校验 Token 余额是否充足。
 * 未传入服务或 userId 时不拦截（降级放行）。
 */
export async function checkTokenBalance(
  required: number,
  tokenBalance?: TokenBalanceService,
  userId?: string,
): Promise<boolean> {
  if (!tokenBalance || !userId) return true
  try {
    const info = await tokenBalance.getBalance(userId)
    return info.balance >= required
  } catch {
    return true
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
    console.error('[stock-service] 持久化分析记录失败:', (err as Error).message)
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
  tokenBalance?: TokenBalanceService,
): Promise<StockAnalysisResult> {
  const cfg = getStockAIConfig()
  const estimatedTokens = Math.ceil(req.question.length / 4) + 800 // 输入 + 输出估算

  // 1. Token 余额校验 + 扣减
  if (tokenBalance && req.userId) {
    const ok = await checkTokenBalance(estimatedTokens, tokenBalance, req.userId)
    if (!ok) {
      const info = await tokenBalance.getBalance(req.userId).catch(() => ({ balance: 0 }))
      throw new Error(`Token 余额不足: 需要 ${estimatedTokens}, 剩余 ${info.balance}`)
    }
    const deduct = await tokenBalance.deductTokens(
      req.userId,
      estimatedTokens,
      `stock_analysis:${req.symbol}`,
    )
    if (!deduct.success) {
      throw new Error(`Token 扣减失败: 余额不足, 剩余 ${deduct.remaining}`)
    }
  }

  // 2. 调用 AI 模型（未配置 key 或调用失败时降级；Bulkhead 限制并发）
  let analysis: string
  let tokensUsed = estimatedTokens
  if (cfg.apiKey) {
    const ai = await degradedMode(
      () =>
        getBulkhead('stock-ai', 5, 20).execute(() => callStockAIModel(req.symbol, req.question)),
      fallbackAnalysis(req.symbol, req.question),
      (err) => console.error('[stock-service] AI 模型调用失败, 降级为本地分析:', err.message),
    )
    analysis = ai.content
    tokensUsed = ai.tokensUsed
  } else {
    const fb = fallbackAnalysis(req.symbol, req.question)
    analysis = fb.content
    tokensUsed = fb.tokensUsed
  }

  const result: StockAnalysisResult = {
    symbol: req.symbol,
    analysis,
    conversationId: req.conversationId ?? `stock-${Date.now()}`,
    tokensUsed,
    createdAt: new Date(),
  }

  // 3. DB 持久化（失败不影响返回）
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
    console.error('[stock-service] 查询历史记录失败:', (err as Error).message)
    return { list: [], total: 0 }
  }
}
