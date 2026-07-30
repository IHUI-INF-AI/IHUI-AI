/**
 * /api/admin/relay/stats 中转站实时监控 Dashboard 聚合端点(2026-07-31 立)。
 *
 * 端点清单(注册前缀 /api/admin):
 * 1. GET /relay/stats/overview          — 今日 + 昨日对比 + 7d + 30d 聚合(KPI 卡片)
 * 2. GET /relay/stats/model-distribution — 今日模型分布(饼图,top 10 + other)
 * 3. GET /relay/stats/trend?days=7       — 最近 N 天趋势(折线图,默认 7 最大 30)
 * 4. GET /relay/stats/top-users?limit=10 — 今日高消费用户排行
 *
 * 复用 llm_call_logs 表;costCents 从 metadata->>'costCents' 提取(COALESCE 兜底老数据 null)。
 * 时区:业务"今日"按 Asia/Shanghai 计算日界,避免 UTC 漏算。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { dbRead } from '../../db/index.js'
import { llmCallLogs, users } from '@ihui/database'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'

// ===== 共享类型 =====
interface PeriodAggregate {
  callCount: number
  totalTokens: number
  totalCostCents: number
  errorCount: number
  errorRate: number
  avgLatencyMs: number
  p95LatencyMs: number
}

interface RangeAggregate {
  callCount: number
  totalCostCents: number
  errorRate: number
}

// ===== 时区工具:Asia/Shanghai 日界(UTC 表示)=====
// Shanghai = UTC+8。Shanghai 当天 00:00 对应的 UTC 时间 = Date.UTC(y,m,d) - 8h。
function shanghaiDayStartUtc(daysAgo = 0): Date {
  const shanghaiNow = new Date(Date.now() + 8 * 3600 * 1000)
  return new Date(
    Date.UTC(
      shanghaiNow.getUTCFullYear(),
      shanghaiNow.getUTCMonth(),
      shanghaiNow.getUTCDate() - daysAgo,
    ) - 8 * 3600 * 1000,
  )
}

// ===== 聚合查询:指定 [start, end) 区间 =====
async function aggregatePeriod(start: Date, end: Date): Promise<PeriodAggregate> {
  const rows = await dbRead
    .select({
      callCount: sql<number>`count(*)::int`,
      totalTokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
      totalCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)), 0)::int`,
      errorCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
      avgLatencyMs: sql<number>`coalesce(avg(${llmCallLogs.latencyMs}), 0)::int`,
      p95LatencyMs: sql<number>`coalesce(percentile_cont(0.95) WITHIN GROUP (ORDER BY ${llmCallLogs.latencyMs})::int, 0)`,
    })
    .from(llmCallLogs)
    .where(and(gte(llmCallLogs.createdAt, start), lte(llmCallLogs.createdAt, end)))
  const r = rows[0]!
  const callCount = r.callCount
  return {
    callCount,
    totalTokens: r.totalTokens,
    totalCostCents: r.totalCostCents,
    errorCount: r.errorCount,
    errorRate: callCount > 0 ? r.errorCount / callCount : 0,
    avgLatencyMs: r.avgLatencyMs,
    p95LatencyMs: r.p95LatencyMs,
  }
}

async function aggregateRange(start: Date, end: Date): Promise<RangeAggregate> {
  const rows = await dbRead
    .select({
      callCount: sql<number>`count(*)::int`,
      totalCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)), 0)::int`,
      errorCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
    })
    .from(llmCallLogs)
    .where(and(gte(llmCallLogs.createdAt, start), lte(llmCallLogs.createdAt, end)))
  const r = rows[0]!
  const callCount = r.callCount
  return {
    callCount,
    totalCostCents: r.totalCostCents,
    errorRate: callCount > 0 ? r.errorCount / callCount : 0,
  }
}

function deltaRate(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 1
  return (curr - prev) / prev
}

// ===== 查询 schema =====
const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
})

const topUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

const relayStatsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /relay/stats/overview =====
  server.get('/relay/stats/overview', async (request, reply) => {
    try {
      const todayStart = shanghaiDayStartUtc(0)
      const yesterdayStart = shanghaiDayStartUtc(1)
      const last7dStart = shanghaiDayStartUtc(6)
      const last30dStart = shanghaiDayStartUtc(29)
      // 区间上界用"现在"(实时监控),下界用对应天数前的 Shanghai 日界
      const now = new Date()

      const [today, yesterday, last7d, last30d] = await Promise.all([
        aggregatePeriod(todayStart, now),
        aggregatePeriod(yesterdayStart, todayStart),
        aggregateRange(last7dStart, now),
        aggregateRange(last30dStart, now),
      ])

      return reply.send(
        success({
          today,
          yesterday,
          delta: {
            callCountDelta: deltaRate(today.callCount, yesterday.callCount),
            totalCostCentsDelta: deltaRate(today.totalCostCents, yesterday.totalCostCents),
            errorRateDelta: today.errorRate - yesterday.errorRate,
          },
          last7d,
          last30d,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询监控总览失败'))
    }
  })

  // ===== 2. GET /relay/stats/model-distribution =====
  server.get('/relay/stats/model-distribution', async (request, reply) => {
    try {
      const todayStart = shanghaiDayStartUtc(0)
      const now = new Date()
      const rows = await dbRead
        .select({
          model: llmCallLogs.model,
          callCount: sql<number>`count(*)::int`,
          totalTokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
          totalCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)), 0)::int`,
        })
        .from(llmCallLogs)
        .where(and(gte(llmCallLogs.createdAt, todayStart), lte(llmCallLogs.createdAt, now)))
        .groupBy(llmCallLogs.model)
        .orderBy(desc(sql`count(*)::int`))

      const totalCall = rows.reduce((s, r) => s + r.callCount, 0)
      const top = rows.slice(0, 10)
      const rest = rows.slice(10)
      const otherCallCount = rest.reduce((s, r) => s + r.callCount, 0)
      const otherTokens = rest.reduce((s, r) => s + r.totalTokens, 0)
      const otherCost = rest.reduce((s, r) => s + r.totalCostCents, 0)

      const models = top.map((r) => ({
        model: r.model,
        callCount: r.callCount,
        totalTokens: r.totalTokens,
        totalCostCents: r.totalCostCents,
        percentage: totalCall > 0 ? r.callCount / totalCall : 0,
      }))
      if (otherCallCount > 0) {
        models.push({
          model: 'other',
          callCount: otherCallCount,
          totalTokens: otherTokens,
          totalCostCents: otherCost,
          percentage: totalCall > 0 ? otherCallCount / totalCall : 0,
        })
      }

      return reply.send(success({ models }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询模型分布失败'))
    }
  })

  // ===== 3. GET /relay/stats/trend?days=7 =====
  server.get('/relay/stats/trend', async (request, reply) => {
    const q = trendQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { days } = q.data
    try {
      const start = shanghaiDayStartUtc(days - 1)
      const now = new Date()
      const dayCol = sql<string>`to_char(${llmCallLogs.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`
      const rows = await dbRead
        .select({
          date: dayCol.as('date'),
          callCount: sql<number>`count(*)::int`,
          totalCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)), 0)::int`,
          errorCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
          avgLatencyMs: sql<number>`coalesce(avg(${llmCallLogs.latencyMs}), 0)::int`,
        })
        .from(llmCallLogs)
        .where(and(gte(llmCallLogs.createdAt, start), lte(llmCallLogs.createdAt, now)))
        .groupBy(dayCol)
        .orderBy(dayCol)

      const byDate = new Map<string, (typeof rows)[number]>()
      for (const r of rows) byDate.set(r.date, r)

      // 填充缺失日期(最近 N 天,Shanghai 日界),保证折线图连续
      const daysArr: Array<{
        date: string
        callCount: number
        totalCostCents: number
        errorRate: number
        avgLatencyMs: number
      }> = []
      for (let i = days - 1; i >= 0; i--) {
        const d = shanghaiDayStartUtc(i)
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        const r = byDate.get(key)
        const callCount = r?.callCount ?? 0
        const errorCount = r?.errorCount ?? 0
        daysArr.push({
          date: key,
          callCount,
          totalCostCents: r?.totalCostCents ?? 0,
          errorRate: callCount > 0 ? errorCount / callCount : 0,
          avgLatencyMs: r?.avgLatencyMs ?? 0,
        })
      }

      return reply.send(success({ days: daysArr }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询趋势失败'))
    }
  })

  // ===== 4. GET /relay/stats/top-users?limit=10 =====
  server.get('/relay/stats/top-users', async (request, reply) => {
    const q = topUsersQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { limit } = q.data
    try {
      const todayStart = shanghaiDayStartUtc(0)
      const now = new Date()
      const rows = await dbRead
        .select({
          userId: llmCallLogs.userId,
          username: users.username,
          callCount: sql<number>`count(*)::int`,
          totalCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)), 0)::int`,
        })
        .from(llmCallLogs)
        .leftJoin(users, eq(llmCallLogs.userId, users.id))
        .where(and(gte(llmCallLogs.createdAt, todayStart), lte(llmCallLogs.createdAt, now)))
        .groupBy(llmCallLogs.userId, users.username)
        .orderBy(desc(sql`sum(((${llmCallLogs.metadata}->>'costCents')::numeric))`))
        .limit(limit)

      const userList = rows.map((r) => ({
        userId: r.userId,
        username: r.username,
        callCount: r.callCount,
        totalCostCents: r.totalCostCents,
      }))

      return reply.send(success({ users: userList }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询高消费用户失败'))
    }
  })
}

export default relayStatsRoutes
