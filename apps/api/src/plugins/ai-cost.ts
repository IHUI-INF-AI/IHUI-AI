import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { createHash } from 'node:crypto'
import type { Redis } from 'ioredis'
import { eq, sql, and, gte, lte, sum, desc, count, isNotNull, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  aiCostRecords,
  aiBudgets,
  users,
  vipLevels,
  userVips,
  type AiCostRecord,
} from '@ihui/database'
import { requireAdmin } from './require-permission.js'
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

/**
 * 计算 prompt 缓存键(SHA-256)。
 *
 * P4-5: cache key 含 model + tenantId 维度,避免:
 * - 同一 prompt 不同 model 共享缓存(风格/格式不符预期)
 * - 多租户场景共享缓存(隔离弱点)
 *
 * 向后兼容:不传 model/tenantId 时退化为 sha256(prompt)(与旧版一致)。
 */
function hashPrompt(prompt: string, model?: string, tenantId?: string): string {
  const parts: string[] = []
  if (tenantId) parts.push(`tenant:${tenantId}`)
  if (model) parts.push(`model:${model}`)
  parts.push(prompt)
  return createHash('sha256').update(parts.join('|')).digest('hex')
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
export function getCachedPrompt(prompt: string, model?: string, tenantId?: string): unknown | null {
  const key = hashPrompt(prompt, model, tenantId)
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
export async function getCachedPromptAsync(
  prompt: string,
  model?: string,
  tenantId?: string,
): Promise<unknown | null> {
  // L1 查询(与同步版同逻辑)
  const key = hashPrompt(prompt, model, tenantId)
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
export function setCachedPrompt(
  prompt: string,
  response: unknown,
  model?: string,
  tenantId?: string,
): void {
  const key = hashPrompt(prompt, model, tenantId)
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
  model?: string,
  tenantId?: string,
): Promise<{ cached: boolean; response: T }> {
  try {
    const hit = await getCachedPromptAsync(prompt, model, tenantId)
    if (hit !== null) {
      return { cached: true, response: hit as T }
    }
  } catch (err) {
    logger.warn(`[ai-cost] getCachedPromptAsync 异常, 降级直取 upstream: ${String(err)}`)
  }
  const response = await upstreamFetch()
  try {
    setCachedPrompt(prompt, response, model, tenantId)
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

  // 今日 0 点起算
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // 查今日已用 token — P1 修复(2026-08-06):原实现未按 scope 维度过滤,
  // 把全站所有用户/Key 的消费加总当作用户/租户/模型预算,导致任一用户超限时全站被限。
  // 现在按预算维度(user→userId / tenant→tenantId / model→model)聚合。
  const usedConditions: SQL[] = [gte(aiCostRecords.createdAt, todayStart)]
  if (scope === 'user') {
    usedConditions.push(eq(aiCostRecords.userId, scopeKey))
  } else if (scope === 'tenant') {
    usedConditions.push(eq(aiCostRecords.tenantId, scopeKey))
  } else {
    usedConditions.push(eq(aiCostRecords.model, model ?? scopeKey))
  }

  const [used] = await db
    .select({ total: sum(aiCostRecords.totalTokens) })
    .from(aiCostRecords)
    .where(and(...usedConditions))

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
    // P1 修复(2026-08-06):成本看板为 admin 管理端点,原只做登录校验
    // (authenticate),任何登录用户可查看全站成本/预算并可改写预算,改为 requireAdmin。
    { preHandler: requireAdmin },
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
        lte(aiCostRecords.createdAt, endDate),
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
    // P1 修复(2026-08-06):成本看板为 admin 管理端点,原只做登录校验
    // (authenticate),任何登录用户可查看全站成本/预算并可改写预算,改为 requireAdmin。
    { preHandler: requireAdmin },
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
  server.get('/api/admin/ai/cost/budgets', { preHandler: requireAdmin }, async () => {
    const budgets = await db.select().from(aiBudgets).orderBy(desc(aiBudgets.updatedAt))
    return success(budgets)
  })

  // POST /api/admin/ai/cost/budgets — 设置预算
  server.post(
    '/api/admin/ai/cost/budgets',
    // P1 修复(2026-08-06):成本看板为 admin 管理端点,原只做登录校验
    // (authenticate),任何登录用户可查看全站成本/预算并可改写预算,改为 requireAdmin。
    { preHandler: requireAdmin },
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

  // GET /api/admin/ai/cost/top-users — 用户成本排行 Top N
  // 按时间段聚合 userId 的总成本/Token/调用次数,LEFT JOIN users 取昵称/邮箱用于展示
  server.get(
    '/api/admin/ai/cost/top-users',
    // P1 修复(2026-08-06):成本看板为 admin 管理端点,原只做登录校验
    // (authenticate),任何登录用户可查看全站成本/预算并可改写预算,改为 requireAdmin。
    { preHandler: requireAdmin },
    async (request: FastifyRequest) => {
      const query = request.query as {
        startDate?: string
        endDate?: string
        limit?: string
      }
      const endDate = query.endDate ? new Date(query.endDate) : new Date()
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(endDate.getTime() - 30 * 24 * 3600 * 1000)
      const limit = Math.min(parseInt(query.limit ?? '10', 10), 50)

      const rows = await db
        .select({
          userId: aiCostRecords.userId,
          totalCost: sum(aiCostRecords.cost),
          totalTokens: sum(aiCostRecords.totalTokens),
          totalCalls: sql<number>`count(*)::int`,
          nickname: users.nickname,
          email: users.email,
          username: users.username,
        })
        .from(aiCostRecords)
        .leftJoin(users, eq(aiCostRecords.userId, users.id))
        .where(
          and(
            gte(aiCostRecords.createdAt, startDate),
            lte(aiCostRecords.createdAt, endDate),
            isNotNull(aiCostRecords.userId),
          ),
        )
        .groupBy(aiCostRecords.userId, users.nickname, users.email, users.username)
        .orderBy(desc(sum(aiCostRecords.cost)))
        .limit(limit)

      return success(
        rows.map((r) => ({
          userId: r.userId,
          nickname: r.nickname,
          email: r.email,
          username: r.username,
          totalCost: r.totalCost ?? '0',
          totalTokens: Number(r.totalTokens ?? 0),
          totalCalls: r.totalCalls ?? 0,
        })),
      )
    },
  )

  // GET /api/admin/ai/cost/budget-alerts — 预算告警
  // 对比每个 user 预算与今日/本月实际消耗,返回超出 80% 阈值的记录
  server.get(
    '/api/admin/ai/cost/budget-alerts',
    // P1 修复(2026-08-06):成本看板为 admin 管理端点,原只做登录校验
    // (authenticate),任何登录用户可查看全站成本/预算并可改写预算,改为 requireAdmin。
    { preHandler: requireAdmin },
    async (request) => {
      // P0-3e: 字段名含 "token" 命中 response-sanitizer 遮蔽为 "***"(同 vip-quotas),admin 路由直接跳过整端点脱敏
      request.skipResponseSanitization = true
      // 1. 取所有 scope='user' 的预算
    const userBudgets = await db.select().from(aiBudgets).where(eq(aiBudgets.scope, 'user'))

    if (userBudgets.length === 0) return success([])

    // 2. 取今日 0 点 + 本月 1 点
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // 3. 批量查今日 token + 本月 cost
    const alerts: Array<{
      userId: string
      scopeKey: string
      dailyTokenLimit: number
      dailyTokenUsed: number
      dailyTokenPercent: number
      monthlyCostLimit: number
      monthlyCostUsed: number
      monthlyCostPercent: number
      severity: 'warning' | 'critical'
    }> = []

    for (const b of userBudgets) {
      const userId = b.scopeKey
      const [todayRow] = await db
        .select({ used: sum(aiCostRecords.totalTokens) })
        .from(aiCostRecords)
        .where(and(eq(aiCostRecords.userId, userId), gte(aiCostRecords.createdAt, todayStart)))
      const [monthRow] = await db
        .select({ used: sum(aiCostRecords.cost) })
        .from(aiCostRecords)
        .where(and(eq(aiCostRecords.userId, userId), gte(aiCostRecords.createdAt, monthStart)))

      const dailyTokenUsed = Number(todayRow?.used ?? 0)
      const monthlyCostUsed = Number(monthRow?.used ?? 0)
      const dailyTokenPercent =
        b.dailyTokenLimit > 0 ? Math.round((dailyTokenUsed / b.dailyTokenLimit) * 10000) / 100 : 0
      const monthlyCostPercent =
        Number(b.monthlyCostLimit) > 0
          ? Math.round((monthlyCostUsed / Number(b.monthlyCostLimit)) * 10000) / 100
          : 0

      // 阈值:任一维度 >= 80% warning,>= 100% critical
      const maxPercent = Math.max(dailyTokenPercent, monthlyCostPercent)
      if (maxPercent < 80) continue

      alerts.push({
        userId,
        scopeKey: b.scopeKey,
        dailyTokenLimit: b.dailyTokenLimit,
        dailyTokenUsed,
        dailyTokenPercent,
        monthlyCostLimit: Number(b.monthlyCostLimit),
        monthlyCostUsed,
        monthlyCostPercent,
        severity: maxPercent >= 100 ? 'critical' : 'warning',
      })
    }

    // 按严重度 + 百分比降序
    alerts.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
      return (
        Math.max(b.dailyTokenPercent, b.monthlyCostPercent) -
        Math.max(a.dailyTokenPercent, a.monthlyCostPercent)
      )
    })

    return success(alerts)
  })

  // GET /api/admin/ai/cost/vip-quotas — VIP 档位配额视图
  // 返回每档 VIP 的配额配置 + 当前生效用户数
  server.get('/api/admin/ai/cost/vip-quotas', { preHandler: requireAdmin }, async (request) => {
    // P0-3c: aiBudgetDefaults.dailyTokenLimit/monthlyTokenLimit 字段名含 "token" 命中 response-sanitizer
    // 遮蔽为 "***",admin 路由可信上下文直接跳过整端点脱敏
    request.skipResponseSanitization = true
    const levels = await db
      .select()
      .from(vipLevels)
      .where(eq(vipLevels.status, 1))
      .orderBy(vipLevels.levelValue)

    if (levels.length === 0) return success([])

    // 查每档当前生效用户数(status=1 且 endTime > now)
    const now = new Date()
    const levelCounts = await db
      .select({
        levelValue: userVips.levelValue,
        c: count(),
      })
      .from(userVips)
      .where(and(eq(userVips.status, 1), gte(userVips.endTime, now)))
      .groupBy(userVips.levelValue)

    const countMap = new Map<number, number>()
    for (const r of levelCounts) countMap.set(r.levelValue, Number(r.c))

    return success(
      levels.map((l) => ({
        id: l.id,
        levelName: l.levelName,
        levelValue: l.levelValue,
        price: l.price,
        durationDays: l.durationDays,
        aiBudgetDefaults: l.aiBudgetDefaults,
        apiQps: l.apiQps,
        maxConcurrency: l.maxConcurrency,
        modelWhitelist: l.modelWhitelist,
        activeUsers: countMap.get(l.levelValue) ?? 0,
      })),
    )
  })
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
