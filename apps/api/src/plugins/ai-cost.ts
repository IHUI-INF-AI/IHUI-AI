import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { createHash } from 'node:crypto'
import type { Redis } from 'ioredis'
import { eq, sql, and, gte, sum, desc, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { aiCostRecords, aiBudgets, type AiCostRecord } from '@ihui/database'
import { authenticate } from './auth.js'
import { success, error } from '../utils/response.js'
import { calculateCost } from '../services/pricing-service.js'
import { logger } from '../utils/logger.js'

// =============================================================================
// Prompt 缓存 (L1 内存 LRU + L2 Redis 分布式双层)
// =============================================================================

interface CacheEntry {
  response: unknown
  expiredAt: number
}

const promptCache = new Map<string, CacheEntry>()
const CACHE_MAX = 500
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 分钟
const CACHE_TTL_SEC = Math.floor(CACHE_TTL_MS / 1000)
const REDIS_PROMPT_CACHE_PREFIX = 'prompt:cache:'

// P2-3 L2 Redis 客户端:在 aiCostPlugin 注册时由 server.redis 注入(null 表示 Redis 不可用,降级为仅 L1)
let redisClient: Redis | null = null

// P3-1 缓存实时计数器(供 admin 看板查询,与 dashboard 的 cacheHitRate(从 DB 算)互补)
const promptCacheMetrics = {
  hits: 0, // L1 命中次数
  misses: 0, // L1 未命中次数(L2 命中或全 miss)
  l2Hits: 0, // L2 Redis 命中次数
  l2Misses: 0, // L2 Redis 未命中次数
  errors: 0, // L2 Redis 异常次数
}

function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex')
}

/**
 * 查询 prompt 缓存 (仅 L1 内存, 同步, 向后兼容)。
 *
 * 真 LRU + 命中续期: Map 迭代顺序按插入序, 命中后 delete + 重新 set 移到末尾(MRU 端),
 * 淘汰时 promptCache.keys().next().value 指向 LRU 端(最久未访问)。
 * 同时续期 expiredAt = now + CACHE_TTL_MS, 热点 prompt 永不过期。
 *
 * 注: 此函数只查 L1, 不查 L2 Redis。需要 L1+L2 双层查询请用 getCachedPromptAsync。
 */
export function getCachedPrompt(prompt: string): unknown | null {
  const key = hashPrompt(prompt)
  const entry = promptCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiredAt) {
    promptCache.delete(key)
    return null
  }
  // 命中: 删除后重新插入到末尾(MRU 端) + 续期 TTL
  promptCache.delete(key)
  entry.expiredAt = Date.now() + CACHE_TTL_MS
  promptCache.set(key, entry)
  return entry.response
}

/**
 * 查询 prompt 缓存 (L1 内存 + L2 Redis 双层, 异步)。
 *
 * 流程: L1 命中 → 返回 + L1 续期(已实现);L1 未命中 → 异步查 L2 Redis,L2 命中 → 回填 L1 + 返回;
 * L2 未命中 → 返回 null。L2 异常降级返回 null(不阻塞主链路)。
 *
 * P2-3: 跨实例部署时, A 实例写入的缓存只在自己 L1, 通过 L2 Redis 让 B 实例也能命中。
 */
export async function getCachedPromptAsync(prompt: string): Promise<unknown | null> {
  // L1 查询(与同步版同逻辑)
  const key = hashPrompt(prompt)
  const entry = promptCache.get(key)
  if (entry) {
    if (Date.now() <= entry.expiredAt) {
      // L1 命中: 续期 + 移到 MRU 端
      promptCache.delete(key)
      entry.expiredAt = Date.now() + CACHE_TTL_MS
      promptCache.set(key, entry)
      promptCacheMetrics.hits++
      return entry.response
    }
    promptCache.delete(key)
  }
  promptCacheMetrics.misses++

  // L2 查询(Redis)
  if (!redisClient) return null
  try {
    const raw = await redisClient.get(REDIS_PROMPT_CACHE_PREFIX + key)
    if (raw === null) {
      promptCacheMetrics.l2Misses++
      return null
    }
    // L2 命中: 回填 L1 + 返回
    promptCacheMetrics.l2Hits++
    const response = JSON.parse(raw) as unknown
    setCachedPrompt(prompt, response) // 同步回填 L1(含 LRU 淘汰逻辑)
    return response
  } catch (err) {
    // L2 异常降级: 不阻塞主链路,只 log warn + 计数
    promptCacheMetrics.errors++
    logger.warn(`[ai-cost] L2 Redis getCachedPromptAsync 异常, 降级返回 null: ${String(err)}`)
    return null
  }
}

/** 写入 prompt 缓存 (L1 内存 + L2 Redis 异步写入)。 */
export function setCachedPrompt(prompt: string, response: unknown): void {
  const key = hashPrompt(prompt)
  if (promptCache.size >= CACHE_MAX) {
    // 淘汰最旧条目
    const firstKey = promptCache.keys().next().value
    if (firstKey) promptCache.delete(firstKey)
  }
  promptCache.set(key, { response, expiredAt: Date.now() + CACHE_TTL_MS })

  // P2-3 L2 Redis 异步写入(fire-and-forget,失败仅 log warn 不阻塞主链路)
  if (redisClient) {
    void (async () => {
      try {
        await redisClient.set(
          REDIS_PROMPT_CACHE_PREFIX + key,
          JSON.stringify(response),
          'EX',
          CACHE_TTL_SEC,
        )
      } catch (err) {
        promptCacheMetrics.errors++
        logger.warn(`[ai-cost] L2 Redis setCachedPrompt 异常, 跳过 L2 写入: ${String(err)}`)
      }
    })()
  }
}

/** 清空 prompt 缓存 (仅 L1;L2 由 TTL 自动过期,不做批量 DEL 避免阻塞 Redis)。 */
export function clearPromptCache(): void {
  promptCache.clear()
}

/**
 * Prompt 缓存包装器 (L1+L2 双层): 命中直接返回 {cached: true}, 未命中调用 upstreamFetch 后写入缓存再返回 {cached: false}。
 *
 * 缓存读写异常 try/catch 兜底降级, 不阻塞主流程(任何异常都退化为直取 upstream)。
 *
 * 注: 流式对话暂不启用此包装器(缓存整段响应会破坏首 token 延迟, 与 streamToClient 的
 * 增量推送语义冲突), 供未来非流式端点(如批量翻译/嵌入/单轮问答)使用。
 */
export async function cachedStreamWrapper<T>(
  prompt: string,
  upstreamFetch: () => Promise<T>,
): Promise<{ cached: boolean; response: T }> {
  try {
    const hit = await getCachedPromptAsync(prompt)
    if (hit !== null) {
      return { cached: true, response: hit as T }
    }
  } catch (err) {
    logger.warn(`[ai-cost] getCachedPromptAsync 异常, 降级直取 upstream: ${String(err)}`)
  }
  const response = await upstreamFetch()
  try {
    setCachedPrompt(prompt, response)
  } catch (err) {
    logger.warn(`[ai-cost] setCachedPrompt 异常, 跳过缓存写入: ${String(err)}`)
  }
  return { cached: false, response }
}

// =============================================================================
// Token 预算控制
// =============================================================================

interface BudgetCheckResult {
  allowed: boolean
  reason?: string
}

/** 检查预算: 按用户/租户/模型维度, 返回是否允许调用。 */
export async function checkBudget(
  scope: 'user' | 'tenant' | 'model',
  scopeKey: string,
  model?: string,
): Promise<BudgetCheckResult> {
  const conditions = [eq(aiBudgets.scope, scope), eq(aiBudgets.scopeKey, scopeKey)]
  if (model) conditions.push(eq(aiBudgets.model, model))

  const [budget] = await db
    .select()
    .from(aiBudgets)
    .where(and(...conditions))
    .limit(1)

  if (!budget) return { allowed: true }

  // 查今日已用 token
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [used] = await db
    .select({ total: sum(aiCostRecords.totalTokens) })
    .from(aiCostRecords)
    .where(gte(aiCostRecords.createdAt, todayStart))

  const usedToday = Number(used?.total ?? 0)
  if (usedToday >= budget.dailyTokenLimit) {
    return { allowed: false, reason: '日 token 预算已用尽' }
  }

  return { allowed: true }
}

// =============================================================================
// AI 成本记录
// =============================================================================

export interface CostRecordInput {
  userId?: string
  tenantId?: string
  model: string
  provider: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** 可选: 手动传入成本。未提供时由 calculateCost() 自动计算（单位: 分）。 */
  cost?: number
  cached?: boolean
  requestType?: string
  promptHash?: string
  metadata?: string
}

/**
 * 记录一次 AI 调用的成本。
 * - 若 input.cost 未提供，则调用定价引擎 calculateCost() 自动计算（单位: 分）。
 * - 若模型无定价配置，回退 0 成本并记录 warning。
 */
export async function recordAiCost(input: CostRecordInput): Promise<void> {
  let cost = input.cost
  if (cost === undefined) {
    const result = await calculateCost({
      modelId: input.model,
      inputTokens: input.promptTokens,
      outputTokens: input.completionTokens,
    })
    if (result.totalCost === 0) {
      // 模型无定价配置: 回退 0 成本并记录 warning
      logger.warn(`[ai-cost] 模型无定价配置,回退 0 成本: model=${input.model}`)
    }
    cost = result.totalCost
  }
  await db.insert(aiCostRecords).values({
    userId: input.userId,
    tenantId: input.tenantId,
    model: input.model,
    provider: input.provider,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    totalTokens: input.totalTokens,
    cost: cost.toString(),
    cached: input.cached ?? false,
    requestType: input.requestType ?? 'chat',
    promptHash: input.promptHash,
    metadata: input.metadata,
  })
}

/** 装饰 server: 提供 AI 成本治理辅助方法。 */
declare module 'fastify' {
  interface FastifyInstance {
    aiCost: {
      checkBudget: typeof checkBudget
      record: typeof recordAiCost
      /** 仅查 L1 内存(同步, 向后兼容) */
      getCached: typeof getCachedPrompt
      /** 查 L1+L2 Redis 双层(异步, P2-3) */
      getCachedAsync: typeof getCachedPromptAsync
      setCached: typeof setCachedPrompt
      cachedStreamWrapper: typeof cachedStreamWrapper
    }
  }
}

/**
 * AI 成本治理插件:
 * - Token 预算控制 (按用户/租户/模型)
 * - Prompt 缓存 (L1 内存 + L2 Redis 双层, P2-3)
 * - AI 调用成本记录
 * - 成本看板 API (GET /api/admin/ai/cost/dashboard)
 */
const aiCostPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // P2-3 注入 Redis 客户端供 L2 缓存层使用(redisPlugin 已在本插件之前注册)
  redisClient = server.redis

  server.decorate('aiCost', {
    checkBudget,
    record: recordAiCost,
    getCached: getCachedPrompt,
    getCachedAsync: getCachedPromptAsync,
    setCached: setCachedPrompt,
    cachedStreamWrapper,
  })

  // ---- 成本看板 API ----

  // GET /api/admin/ai/cost/dashboard — 成本汇总看板
  server.get(
    '/api/admin/ai/cost/dashboard',
    { preHandler: authenticate },
    async (request: FastifyRequest) => {
      const query = request.query as {
        startDate?: string
        endDate?: string
        tenantId?: string
      }
      const endDate = query.endDate ? new Date(query.endDate) : new Date()
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(endDate.getTime() - 30 * 24 * 3600 * 1000)

      const conditions: SQL[] = [
        gte(aiCostRecords.createdAt, startDate),
        sql`${aiCostRecords.createdAt} <= ${endDate}`,
      ]
      if (query.tenantId) {
        conditions.push(eq(aiCostRecords.tenantId, query.tenantId))
      }

      // 总成本
      const [totalRow] = await db
        .select({
          totalCost: sum(aiCostRecords.cost),
          totalTokens: sum(aiCostRecords.totalTokens),
          totalCalls: sql<number>`count(*)::int`,
        })
        .from(aiCostRecords)
        .where(and(...conditions))

      // 按模型分组
      const byModel = await db
        .select({
          model: aiCostRecords.model,
          cost: sum(aiCostRecords.cost),
          tokens: sum(aiCostRecords.totalTokens),
          calls: sql<number>`count(*)::int`,
        })
        .from(aiCostRecords)
        .where(and(...conditions))
        .groupBy(aiCostRecords.model)
        .orderBy(desc(sum(aiCostRecords.cost)))

      // 按天分组
      const byDay = await db
        .select({
          date: sql<string>`to_char(${aiCostRecords.createdAt}, 'YYYY-MM-DD')`,
          cost: sum(aiCostRecords.cost),
          tokens: sum(aiCostRecords.totalTokens),
          calls: sql<number>`count(*)::int`,
        })
        .from(aiCostRecords)
        .where(and(...conditions))
        .groupBy(sql`to_char(${aiCostRecords.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${aiCostRecords.createdAt}, 'YYYY-MM-DD')`)

      return success({
        summary: {
          totalCost: totalRow?.totalCost ?? '0',
          totalTokens: Number(totalRow?.totalTokens ?? 0),
          totalCalls: totalRow?.totalCalls ?? 0,
          cacheHitRate: await getCacheHitRate(conditions),
        },
        byModel: byModel.map((r) => ({
          model: r.model,
          cost: r.cost ?? '0',
          tokens: Number(r.tokens ?? 0),
          calls: r.calls ?? 0,
        })),
        byDay: byDay.map((r) => ({
          date: r.date,
          cost: r.cost ?? '0',
          tokens: Number(r.tokens ?? 0),
          calls: r.calls ?? 0,
        })),
        period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        // P3-1 实时缓存计数器(与 summary.cacheHitRate(从 DB 算)互补,反映当前进程 L1+L2 命中情况)
        promptCacheMetrics: { ...promptCacheMetrics },
      })
    },
  )

  // GET /api/admin/ai/cost/records — 成本记录明细
  server.get(
    '/api/admin/ai/cost/records',
    { preHandler: authenticate },
    async (request: FastifyRequest) => {
      const query = request.query as {
        limit?: string
        offset?: string
        userId?: string
        model?: string
      }
      const limit = Math.min(parseInt(query.limit ?? '50', 10), 200)
      const offset = parseInt(query.offset ?? '0', 10)

      const conditions: SQL[] = []
      if (query.userId) conditions.push(eq(aiCostRecords.userId, query.userId))
      if (query.model) conditions.push(eq(aiCostRecords.model, query.model))

      const records: AiCostRecord[] = await db
        .select()
        .from(aiCostRecords)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(aiCostRecords.createdAt))
        .limit(limit)
        .offset(offset)

      return success(
        records.map((r) => ({
          id: r.id,
          userId: r.userId,
          tenantId: r.tenantId,
          model: r.model,
          provider: r.provider,
          promptTokens: r.promptTokens,
          completionTokens: r.completionTokens,
          totalTokens: r.totalTokens,
          cost: r.cost,
          cached: r.cached,
          requestType: r.requestType,
          createdAt: r.createdAt,
        })),
      )
    },
  )

  // GET /api/admin/ai/cost/budgets — 预算列表
  server.get('/api/admin/ai/cost/budgets', { preHandler: authenticate }, async () => {
    const budgets = await db.select().from(aiBudgets).orderBy(desc(aiBudgets.updatedAt))
    return success(budgets)
  })

  // POST /api/admin/ai/cost/budgets — 设置预算
  server.post(
    '/api/admin/ai/cost/budgets',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply) => {
      const body = request.body as {
        scope: 'user' | 'tenant' | 'model'
        scopeKey: string
        model?: string
        dailyTokenLimit?: number
        monthlyTokenLimit?: number
        dailyCostLimit?: number
        monthlyCostLimit?: number
      }
      if (!body.scope || !body.scopeKey) {
        reply.status(400).send(error(400, 'scope 和 scopeKey 必填'))
        return
      }

      const [existing] = await db
        .select()
        .from(aiBudgets)
        .where(
          and(
            eq(aiBudgets.scope, body.scope),
            eq(aiBudgets.scopeKey, body.scopeKey),
            body.model ? eq(aiBudgets.model, body.model) : undefined,
          ),
        )
        .limit(1)

      if (existing) {
        const [updated] = await db
          .update(aiBudgets)
          .set({
            dailyTokenLimit: body.dailyTokenLimit ?? existing.dailyTokenLimit,
            monthlyTokenLimit: body.monthlyTokenLimit ?? existing.monthlyTokenLimit,
            dailyCostLimit: body.dailyCostLimit?.toString() ?? existing.dailyCostLimit,
            monthlyCostLimit: body.monthlyCostLimit?.toString() ?? existing.monthlyCostLimit,
          })
          .where(eq(aiBudgets.id, existing.id))
          .returning()
        return success(updated)
      }

      const [created] = await db
        .insert(aiBudgets)
        .values({
          scope: body.scope,
          scopeKey: body.scopeKey,
          model: body.model,
          dailyTokenLimit: body.dailyTokenLimit,
          monthlyTokenLimit: body.monthlyTokenLimit,
          dailyCostLimit: body.dailyCostLimit?.toString(),
          monthlyCostLimit: body.monthlyCostLimit?.toString(),
        })
        .returning()
      return success(created)
    },
  )
}

/** 计算缓存命中率。 */
async function getCacheHitRate(conditions: SQL[]): Promise<number> {
  const [cachedRow] = await db
    .select({
      cached: sql<number>`count(*) filter (where ${aiCostRecords.cached} = true)::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(aiCostRecords)
    .where(and(...conditions))
  const total = Number(cachedRow?.total ?? 0)
  if (total === 0) return 0
  const cached = Number(cachedRow?.cached ?? 0)
  return Math.round((cached / total) * 10000) / 100
}

export default fp(aiCostPlugin, {
  name: 'ai-cost-plugin',
  fastify: '5.x',
})
