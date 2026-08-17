/**
 * 发布数据分析 API — 聚合 ai-service 已有 /publish/stats + /publish/tasks 端点。
 *
 * 端点:
 *   GET /publish/analytics/overview?period=7d|30d|90d  总览(统计卡片 + 趋势 + 平台分布 + 失败原因)
 *   GET /publish/analytics/accounts?period=30d          账号健康度
 *   GET /publish/analytics/platforms?period=30d         平台维度统计
 *
 * 设计:
 * - 复用 publish-routes.ts 的 authenticate preHandler + ai-service 代理模式
 * - 调 ai-service /publish/stats + /publish/tasks 聚合(不新增 ai-service 端点)
 * - period 按 created_at 过滤(7d/30d/90d)
 *
 * 注意:任务列表(GET /tasks)返回的 items 含 targets(原始 JSONB)+ platforms(单平台
 * 执行结果,从 results 映射的 camelCase 数组),是 analytics 统计的唯一数据源;
 * /history 是单平台粒度、无 targets,不可用于本统计。
 *
 * 注意:本路由需在 routes/index.ts 中注册:
 *   import { publishAnalyticsRoutes } from './publish-analytics.js'
 *   server.register(publishAnalyticsRoutes, { prefix: '/api' })
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'

import { config } from '../config/index.js'
import { authenticate } from '../plugins/auth.js'
import { error, success } from '../utils/response.js'

type Period = '7d' | '30d' | '90d'

const PERIOD_MS: Record<Period, number> = {
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
}

/** 任务列表 GET /tasks items[].platforms 元素:ai-service 从 results(snake_case) 映射的 camelCase 结构。 */
interface AiServicePlatformResult {
  platform: string
  success: boolean
  publishedUrl?: string | null
  platformContentId?: string | null
  errorMessage?: string | null
  durationMs?: number
}

interface AiServiceTask {
  id: number
  title: string
  status: string
  createdAt?: string
  scheduledAt?: string | null
  targets?: ReadonlyArray<{
    platform: string
    accountId?: number
    status?: string
    url?: string | null
    error?: string | null
    durationMs?: number
  }>
  /** 单平台执行结果(有结果的平台才有元素,任务未执行/无结果时为 []) */
  platforms?: ReadonlyArray<AiServicePlatformResult>
  error?: string | null
}

interface AiServiceStats {
  tasks?: {
    total?: number
    success?: number
    failed?: number
    partial?: number
  }
}

interface AiServiceHistoryResponse {
  items?: AiServiceTask[]
  list?: AiServiceTask[]
}

/**
 * 解析转发给 ai-service 的鉴权头。
 * 2026-08-17 P0 修复:浏览器同源请求靠 auth_token cookie 认证(无 Authorization header),
 * 原实现只转发 request.headers.authorization → ai-service 无凭据 → 401 → analytics 数据为空。
 * 缺省时从 auth_token cookie 提取 token 构造 Bearer(JWT_SECRET 三端一致,可直接验签)。
 */
function resolveAuthHeader(request: FastifyRequest): string | undefined {
  const authHeader = request.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader
  const cookieToken = (request as unknown as { cookies?: Record<string, string> }).cookies
    ?.auth_token
  if (cookieToken && cookieToken.length > 0) return `Bearer ${cookieToken}`
  return undefined
}

async function fetchAiService<T>(path: string, authHeader: string | undefined): Promise<T | null> {
  const url = `${config.AI_SERVICE_URL}/api/publish${path}`
  const headers: Record<string, string> = {}
  if (authHeader) headers.authorization = authHeader
  try {
    const resp = await fetch(url, { method: 'GET', headers })
    if (!resp.ok) return null
    const ct = resp.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    const raw = (await resp.json()) as { code?: number; data?: unknown }
    // ai-service 统一信封 {code, message, data}:业务数据在 data 下。
    // 解包后 stats 取 .tasks、任务列表取 .items 才能拿到真实数据。
    // 兼容非信封裸响应(无 data 字段)直接返回。
    if (raw && typeof raw === 'object' && 'data' in raw) {
      return raw.data as T
    }
    return raw as T
  } catch {
    return null
  }
}

function parsePeriod(query: unknown): Period {
  const q = query as { period?: string }
  if (q.period === '7d' || q.period === '30d' || q.period === '90d') return q.period
  return '30d'
}

function filterByPeriod<T extends { createdAt?: string; scheduledAt?: string | null }>(
  items: readonly T[],
  period: Period,
): T[] {
  const cutoff = Date.now() - PERIOD_MS[period]
  return items.filter((item) => {
    const ts = item.scheduledAt ?? item.createdAt
    if (!ts) return false
    return new Date(ts).getTime() >= cutoff
  })
}

const PLATFORM_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-purple-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
]

function buildTrend(tasks: readonly AiServiceTask[]): Array<{ date: string; count: number }> {
  const byDay = new Map<string, number>()
  for (const t of tasks) {
    const ts = t.scheduledAt ?? t.createdAt
    if (!ts) continue
    const d = new Date(ts)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    byDay.set(key, (byDay.get(key) ?? 0) + 1)
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))
}

function buildPlatformDistribution(
  tasks: readonly AiServiceTask[],
): Array<{ platform: string; count: number; color: string }> {
  // 从 platforms(真实单平台执行结果)按平台维度统计成功发布次数。
  const byPlatform = new Map<string, { total: number; success: number }>()
  for (const t of tasks) {
    for (const p of t.platforms ?? []) {
      const entry = byPlatform.get(p.platform) ?? { total: 0, success: 0 }
      entry.total++
      if (p.success) entry.success++
      byPlatform.set(p.platform, entry)
    }
  }
  return Array.from(byPlatform.entries())
    .sort((a, b) => b[1].success - a[1].success)
    .map(([platform, data], i) => ({
      platform,
      count: data.success,
      color: PLATFORM_COLORS[i % PLATFORM_COLORS.length] ?? '',
    }))
}

function buildFailureReasons(
  tasks: readonly AiServiceTask[],
): Array<{ reason: string; count: number }> {
  // 从 platforms 收集失败的 errorMessage(按非空计数,截断前 60 字符归一化)。
  const byReason = new Map<string, number>()
  for (const t of tasks) {
    for (const p of t.platforms ?? []) {
      if (p.success || !p.errorMessage) continue
      const reason = p.errorMessage.slice(0, 60) || '未知错误'
      byReason.set(reason, (byReason.get(reason) ?? 0) + 1)
    }
  }
  return Array.from(byReason.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }))
}

function computeAvgDuration(tasks: readonly AiServiceTask[]): number {
  // 从 platforms 的单平台 durationMs 计算平均耗时。
  let total = 0
  let count = 0
  for (const t of tasks) {
    for (const p of t.platforms ?? []) {
      if (typeof p.durationMs === 'number' && p.durationMs > 0) {
        total += p.durationMs
        count++
      }
    }
  }
  return count > 0 ? Math.round(total / count) : 0
}

interface AccountHealthRow {
  accountId: number
  platform: string
  displayName: string
  successRate: number
  lastPublishedAt: string | null
  riskStatus: 'safe' | 'low' | 'medium' | 'high'
}

function computeAccountHealth(tasks: readonly AiServiceTask[]): AccountHealthRow[] {
  // 按 (accountId, platform) 聚合:accountId 来自 targets,执行结果来自 platforms。
  // 同一任务内 targets 与 results 一一对应(scheduler gather 保序),用 platform 关联。
  const byAccount = new Map<
    number,
    { platform: string; success: number; total: number; lastPublished: string | null }
  >()
  for (const t of tasks) {
    const platformResults = new Map<string, AiServicePlatformResult>()
    for (const p of t.platforms ?? []) platformResults.set(p.platform, p)
    for (const target of t.targets ?? []) {
      if (typeof target.accountId !== 'number') continue
      const result = platformResults.get(target.platform)
      if (!result) continue // 该平台无执行结果(未开始/未触达),不参与健康度统计
      const existing = byAccount.get(target.accountId) ?? {
        platform: target.platform,
        success: 0,
        total: 0,
        lastPublished: null,
      }
      existing.total++
      if (result.success) existing.success++
      const ts = t.scheduledAt ?? t.createdAt
      if (ts && (!existing.lastPublished || ts > existing.lastPublished)) {
        existing.lastPublished = ts
      }
      byAccount.set(target.accountId, existing)
    }
  }
  return Array.from(byAccount.entries()).map(([accountId, data]) => {
    const rate = data.total > 0 ? data.success / data.total : 0
    let riskStatus: AccountHealthRow['riskStatus'] = 'safe'
    if (rate < 0.3) riskStatus = 'high'
    else if (rate < 0.6) riskStatus = 'medium'
    else if (rate < 0.8) riskStatus = 'low'
    return {
      accountId,
      platform: data.platform,
      displayName: `账号 ${accountId}`,
      successRate: rate,
      lastPublishedAt: data.lastPublished,
      riskStatus,
    }
  })
}

export const publishAnalyticsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      // 2026-08-06 修复:必须 return reply,防止 handler 在未认证时继续执行
      return reply.status(statusCode).send(error(statusCode, (e as Error).message || '需要登录'))
    }
  })

  server.get('/publish/analytics/overview', async (request, reply) => {
    const period = parsePeriod(request.query)
    const authHeader = resolveAuthHeader(request)
    const [statsRes, histRes] = await Promise.all([
      fetchAiService<AiServiceStats>('/stats', authHeader),
      fetchAiService<AiServiceHistoryResponse>('/tasks?limit=200', authHeader),
    ])
    if (!histRes) {
      return reply.send(
        success({
          totalPublished: 0,
          successRate: 0,
          avgDurationMs: 0,
          activeAccounts: 0,
          trend: [],
          platformDistribution: [],
          failureReasons: [],
        }),
      )
    }
    const allTasks = histRes.items ?? histRes.list ?? []
    const tasks = filterByPeriod(allTasks, period)
    const stats = statsRes?.tasks
    const total = stats?.total ?? tasks.length
    // 成功数以真实单平台执行结果(platforms 中 success=true)为准,
    // 任务级 stats.success 是任务粒度,与平台粒度口径不同,不再混用。
    const successCount = tasks.flatMap((t) => t.platforms ?? []).filter((p) => p.success).length
    const activeAccountIds = new Set<number>()
    for (const t of tasks) {
      for (const target of t.targets ?? []) {
        if (typeof target.accountId === 'number') activeAccountIds.add(target.accountId)
      }
    }
    return reply.send(
      success({
        totalPublished: total,
        successRate: total > 0 ? (successCount / total) * 100 : 0,
        avgDurationMs: computeAvgDuration(tasks),
        activeAccounts: activeAccountIds.size,
        trend: buildTrend(tasks),
        platformDistribution: buildPlatformDistribution(tasks),
        failureReasons: buildFailureReasons(tasks),
      }),
    )
  })

  server.get('/publish/analytics/accounts', async (request, reply) => {
    const period = parsePeriod(request.query)
    const authHeader = resolveAuthHeader(request)
    const histRes = await fetchAiService<AiServiceHistoryResponse>('/tasks?limit=200', authHeader)
    if (!histRes) {
      return reply.send(success([]))
    }
    const allTasks = histRes.items ?? histRes.list ?? []
    const tasks = filterByPeriod(allTasks, period)
    return reply.send(success(computeAccountHealth(tasks)))
  })

  server.get('/publish/analytics/platforms', async (request, reply) => {
    const period = parsePeriod(request.query)
    const authHeader = resolveAuthHeader(request)
    const histRes = await fetchAiService<AiServiceHistoryResponse>('/tasks?limit=200', authHeader)
    if (!histRes) {
      return reply.send(success([]))
    }
    const allTasks = histRes.items ?? histRes.list ?? []
    const tasks = filterByPeriod(allTasks, period)
    const byPlatform = new Map<
      string,
      { total: number; success: number; durationSum: number; durationCount: number }
    >()
    // 直接统计 platforms(真实单平台执行结果),替代原 targets[].status 占位逻辑。
    for (const t of tasks) {
      for (const p of t.platforms ?? []) {
        const existing = byPlatform.get(p.platform) ?? {
          total: 0,
          success: 0,
          durationSum: 0,
          durationCount: 0,
        }
        existing.total++
        if (p.success) existing.success++
        if (typeof p.durationMs === 'number' && p.durationMs > 0) {
          existing.durationSum += p.durationMs
          existing.durationCount++
        }
        byPlatform.set(p.platform, existing)
      }
    }
    const result = Array.from(byPlatform.entries()).map(([platform, data]) => ({
      platform,
      total: data.total,
      successRate: data.total > 0 ? (data.success / data.total) * 100 : 0,
      avgDurationMs: data.durationCount > 0 ? Math.round(data.durationSum / data.durationCount) : 0,
    }))
    return reply.send(success(result))
  })
}
