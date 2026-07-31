/**
 * /api/public/status/* 公开状态页路由(2026-07-31 立)。
 *
 * 面向公众展示 IHUI-AI 中转站各模型可用性,类似 status.openai.com 风格。
 * 无需鉴权,但加 IP 限流(每分钟 60 次)+ Redis 缓存(TTL 30 秒)保护后端。
 *
 * 端点清单(注册前缀 /api/public):
 * 1. GET /status/overview   — 系统总览(platform/version/uptime/services 健康状态)
 * 2. GET /status/models     — 模型可用性列表(最近 5 分钟错误率/P95/最近事故)
 * 3. GET /status/incidents  — 最近 30 天事件列表(按 provider + date 聚合,最多 50 条)
 *
 * 数据来源:
 *  - ai_model_config + ai_model_config_models(is_relay_public=true)获取公开模型清单
 *  - llm_call_logs 聚合最近 5 分钟统计计算 status(operational/degraded/outage)
 *  - llm_call_logs status='error' 最近 30 天聚合为 incident
 *
 * 复用模式参考 apps/api/src/routes/admin/relay-stats.ts(percentile_cont / filter 聚合)。
 */
import type { FastifyPluginAsync } from 'fastify'
import type { Redis } from 'ioredis'
import { z } from 'zod'
import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { aiModelConfig, aiModelConfigModels, llmCallLogs } from '@ihui/database'
import { error, success } from '../utils/response.js'

// ===== 共享类型 =====
type ServiceStatus = 'operational' | 'degraded' | 'outage'
type IncidentSeverity = 'minor' | 'major' | 'critical'

interface ServicesHealth {
  api: 'operational'
  database: ServiceStatus
  redis: ServiceStatus
}

interface OverviewResponse {
  platform: 'IHUI-AI'
  version: '1.0.0'
  uptime: number
  timestamp: string
  services: ServicesHealth
}

interface ModelStatus {
  modelId: string
  displayName: string | null
  providerCode: string
  status: ServiceStatus
  p95LatencyMs: number
  errorRate: number
  lastIncidentAt: string | null
}

interface Incident {
  id: string
  providerCode: string
  modelId: string | null
  startedAt: string
  resolvedAt: string | null
  severity: IncidentSeverity
  description: string
}

interface ModelsPayload {
  models: ModelStatus[]
}

interface IncidentsPayload {
  incidents: Incident[]
}

// ===== 查询 schema =====
const incidentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(50),
})

// ===== 常量 =====
const CACHE_TTL_SEC = 30
const RATE_LIMIT_CONFIG = { max: 60, timeWindow: '1 minute' as const }
const PLATFORM_NAME = 'IHUI-AI' as const
const PLATFORM_VERSION = '1.0.0' as const
const FIVE_MIN_MS = 5 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// ===== Redis 缓存辅助 =====
async function withCache<T>(
  redis: Redis,
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached) as T
  } catch {
    // Redis 读故障 → 降级直查 DB,不阻断状态页
  }
  const data = await loader()
  try {
    await redis.set(key, JSON.stringify(data), 'EX', ttlSec)
  } catch {
    // 写缓存失败忽略,下次回源
  }
  return data
}

// ===== 健康探测 =====
async function checkDbHealth(): Promise<boolean> {
  try {
    await dbRead.execute(sql`select 1`)
    return true
  } catch {
    return false
  }
}

async function checkRedisHealth(redis: Redis): Promise<boolean> {
  try {
    return (await redis.ping()) === 'PONG'
  } catch {
    return false
  }
}

// ===== 状态判定 =====
function classifyStatus(errorRate: number): ServiceStatus {
  if (errorRate === 0) return 'operational'
  if (errorRate <= 0.1) return 'degraded'
  return 'outage'
}

function classifySeverity(errorCount: number): IncidentSeverity {
  if (errorCount <= 5) return 'minor'
  if (errorCount <= 20) return 'major'
  return 'critical'
}

// ===== 路由 =====
const publicStatusRoutes: FastifyPluginAsync = async (server) => {
  // ===== 1. GET /status/overview =====
  server.get(
    '/status/overview',
    { config: { rateLimit: RATE_LIMIT_CONFIG } },
    async (request, reply) => {
      try {
        const data = await withCache<OverviewResponse>(
          request.server.redis,
          'status:overview',
          CACHE_TTL_SEC,
          async () => {
            const [dbOk, redisOk] = await Promise.all([
              checkDbHealth(),
              checkRedisHealth(request.server.redis),
            ])
            return {
              platform: PLATFORM_NAME,
              version: PLATFORM_VERSION,
              uptime: Math.floor(process.uptime()),
              timestamp: new Date().toISOString(),
              services: {
                api: 'operational',
                database: dbOk ? 'operational' : 'degraded',
                redis: redisOk ? 'operational' : 'degraded',
              },
            }
          },
        )
        return reply.send(success(data))
      } catch (e) {
        request.log.error(e)
        return reply.status(503).send({ error: 'status_unavailable' })
      }
    },
  )

  // ===== 2. GET /status/models =====
  server.get(
    '/status/models',
    { config: { rateLimit: RATE_LIMIT_CONFIG } },
    async (request, reply) => {
      try {
        const data = await withCache<ModelsPayload>(
          request.server.redis,
          'status:models',
          CACHE_TTL_SEC,
          async () => {
            const fiveMinAgo = new Date(Date.now() - FIVE_MIN_MS)
            // 查公开模型清单(JOIN aiModelConfig 获取 providerCode)
            const models = await dbRead
              .select({
                modelId: aiModelConfigModels.modelId,
                displayName: aiModelConfigModels.relayDisplayName,
                fallbackName: aiModelConfigModels.displayName,
                providerCode: aiModelConfig.providerCode,
              })
              .from(aiModelConfigModels)
              .innerJoin(
                aiModelConfig,
                eq(aiModelConfig.id, aiModelConfigModels.configId),
              )
              .where(
                and(
                  eq(aiModelConfigModels.isRelayPublic, true),
                  eq(aiModelConfigModels.enabled, true),
                  eq(aiModelConfig.enabled, true),
                ),
              )
            // 查最近 5 分钟统计(按 model 聚合)
            const stats = await dbRead
              .select({
                model: llmCallLogs.model,
                callCount: sql<number>`count(*)::int`,
                errorCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
                p95LatencyMs: sql<number>`coalesce(percentile_cont(0.95) WITHIN GROUP (ORDER BY ${llmCallLogs.latencyMs})::int, 0)`,
                lastErrorAt: sql<Date | null>`max(${llmCallLogs.createdAt}) filter (where ${llmCallLogs.status} = 'error')`,
              })
              .from(llmCallLogs)
              .where(gte(llmCallLogs.createdAt, fiveMinAgo))
              .groupBy(llmCallLogs.model)
            const statsMap = new Map<string, (typeof stats)[number]>()
            for (const s of stats) statsMap.set(s.model, s)
            const result: ModelStatus[] = models.map((m) => {
              const s = statsMap.get(m.modelId)
              const callCount = s?.callCount ?? 0
              const errorCount = s?.errorCount ?? 0
              const errorRate = callCount > 0 ? errorCount / callCount : 0
              return {
                modelId: m.modelId,
                displayName: m.displayName ?? m.fallbackName,
                providerCode: m.providerCode,
                status: callCount > 0 ? classifyStatus(errorRate) : 'operational',
                p95LatencyMs: s?.p95LatencyMs ?? 0,
                errorRate,
                lastIncidentAt: s?.lastErrorAt ? s.lastErrorAt.toISOString() : null,
              }
            })
            return { models: result }
          },
        )
        return reply.send(success(data))
      } catch (e) {
        request.log.error(e)
        return reply.status(503).send({ error: 'status_unavailable' })
      }
    },
  )

  // ===== 3. GET /status/incidents =====
  server.get(
    '/status/incidents',
    { config: { rateLimit: RATE_LIMIT_CONFIG } },
    async (request, reply) => {
      const q = incidentsQuerySchema.safeParse(request.query)
      if (!q.success)
        return reply
          .status(400)
          .send(error(400, q.error.issues[0]?.message ?? '参数错误'))
      const { limit } = q.data
      try {
        const data = await withCache<IncidentsPayload>(
          request.server.redis,
          'status:incidents',
          CACHE_TTL_SEC,
          async () => {
            const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)
            const dayCol = sql<string>`to_char(${llmCallLogs.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`
            const rows = await dbRead
              .select({
                providerCode: llmCallLogs.providerCode,
                date: dayCol,
                startedAt: sql<Date>`min(${llmCallLogs.createdAt})`,
                resolvedAt: sql<Date>`max(${llmCallLogs.createdAt})`,
                errorCount: sql<number>`count(*)::int`,
                latestModel: sql<string | null>`(array_agg(${llmCallLogs.model} ORDER BY ${llmCallLogs.createdAt} DESC))[1]`,
              })
              .from(llmCallLogs)
              .where(
                and(
                  eq(llmCallLogs.status, 'error'),
                  gte(llmCallLogs.createdAt, thirtyDaysAgo),
                  isNotNull(llmCallLogs.providerCode),
                ),
              )
              .groupBy(llmCallLogs.providerCode, dayCol)
              .orderBy(desc(sql`min(${llmCallLogs.createdAt})`))
              .limit(limit)
            const incidents: Incident[] = rows.map((r) => ({
              id: `incident-${r.providerCode ?? 'unknown'}-${r.date}`,
              providerCode: r.providerCode ?? 'unknown',
              modelId: r.latestModel,
              startedAt: r.startedAt.toISOString(),
              resolvedAt: r.resolvedAt.toISOString(),
              severity: classifySeverity(r.errorCount),
              description: `${r.errorCount} errors reported for ${r.providerCode ?? 'unknown'} on ${r.date}`,
            }))
            return { incidents }
          },
        )
        return reply.send(success(data))
      } catch (e) {
        request.log.error(e)
        return reply.status(503).send({ error: 'status_unavailable' })
      }
    },
  )
}

export default publicStatusRoutes
