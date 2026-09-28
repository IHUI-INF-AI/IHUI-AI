// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
 *    响应恒为 `{ incidents, degraded }`:`degraded=true` 表示「查询失败所以列表为空」,
 *    与「确实没有事件」(`degraded=false`)对消费方必须可区分 —— 空数组不得自证清白。
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
import { and, desc, eq, gte, isNotNull, sql, type SQL } from 'drizzle-orm'
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

export interface Incident {
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
  /**
   * true = 「查询失败所以只能给空列表」,与「确实没有事件」(`false`)必须可区分。
   * 两条分支都显式赋值(正常路径为 false),降级分支不得再产出自洽的"一切正常"空数组。
   */
  degraded: boolean
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

// ===== 驱动返回形态归一化(状态页时间列的唯一出口)=====
/**
 * postgres-js 对**聚合列**(`min`/`max`/`to_char`)的返回形态不可依赖。
 * 生产实测:`min(created_at)` 返回的不是 Date,于是 `.toISOString()` 抛
 * `TypeError: r.startedAt.toISOString is not a function`,被外层 catch 吞成
 * 「HTTP 200 + 空数组」,状态页从 2026-09-13 起永远显示"无故障"。
 *
 * 两道收口,缺一不可:
 * 1. SQL 侧用 `to_char(... AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')` 显式产出
 *    UTC ISO 文本 ⇒ 驱动只可能回 string,且 `new Date()` 对该形态无歧义(不会误按本地时区解析);
 * 2. TS 侧只此一处归一化函数,把 `Date | string | number` 三种可能形态收敛到同一个判据。
 *    刻意**不做**"没有 toISOString 就当字符串"的鸭子类型猜测 —— 解析不出来就抛,
 *    由端点走可见降级;绝不静默产出 "Invalid Date"。
 */
type DriverTimestamp = Date | string | number | null | undefined

function toDate(value: DriverTimestamp): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const parsed = new Date(typeof value === 'number' ? value : value.trim())
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** 必填时间列 → ISO 8601 字符串;取不到合法时间戳即抛(不猜、不产出 Invalid Date)。 */
function isoTimestampOrThrow(value: DriverTimestamp, column: string): string {
  const parsed = toDate(value)
  if (!parsed) throw new TypeError(`status column "${column}" is not a valid timestamp`)
  return parsed.toISOString()
}

/** 可空时间列 → ISO 8601 字符串或 null;非空但解析不出来同样抛。 */
function isoTimestampOrNull(value: DriverTimestamp, column: string): string | null {
  if (value === null || value === undefined) return null
  return isoTimestampOrThrow(value, column)
}

/** 文本列(`to_char` / varchar)的同档归一化:非 string 即视为形态异常,不靠模板串蒙混。 */
function plainTextOrNull(value: string | null | undefined, column: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new TypeError(`status column "${column}" is not text`)
  return value
}

function plainTextOrThrow(value: string | null | undefined, column: string): string {
  const text = plainTextOrNull(value, column)
  if (text === null || text === '') throw new TypeError(`status column "${column}" is empty`)
  return text
}

/** 聚合时间列在 SQL 侧显式转 UTC ISO 文本(见上节说明)。 */
function utcIsoText(expr: SQL): SQL<string | null> {
  return sql<string | null>`to_char((${expr} AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`
}

/** incidents 查询的行形态(时间/文本列按驱动可能给出的形态声明,归一化在 mapIncidentRows)。 */
export interface IncidentRow {
  providerCode: string | null
  date: string | null
  startedAt: DriverTimestamp
  resolvedAt: DriverTimestamp
  errorCount: number
  latestModel: string | null
}

/** 行 → 对外条目。纯函数,便于用生产故障的那一种形态(字符串时间)做回归。 */
export function mapIncidentRows(rows: readonly IncidentRow[]): Incident[] {
  return rows.map((r) => {
    const providerCode = plainTextOrNull(r.providerCode, 'providerCode') ?? 'unknown'
    const date = plainTextOrThrow(r.date, 'date')
    return {
      id: `incident-${providerCode}-${date}`,
      providerCode,
      modelId: plainTextOrNull(r.latestModel, 'latestModel'),
      startedAt: isoTimestampOrThrow(r.startedAt, 'startedAt'),
      resolvedAt: isoTimestampOrNull(r.resolvedAt, 'resolvedAt'),
      severity: classifySeverity(r.errorCount),
      description: `${r.errorCount} errors reported for ${providerCode} on ${date}`,
    }
  })
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
              .innerJoin(aiModelConfig, eq(aiModelConfig.id, aiModelConfigModels.configId))
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
                lastErrorAt: utcIsoText(
                  sql`max(${llmCallLogs.createdAt}) filter (where ${llmCallLogs.status} = 'error')`,
                ),
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
                // 同一档归一化:聚合列不得直接 .toISOString()(与 incidents 同型缺陷)
                lastIncidentAt: isoTimestampOrNull(s?.lastErrorAt ?? null, 'lastErrorAt'),
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
        return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
      const { limit } = q.data
      try {
        const data = await withCache<IncidentsPayload>(
          request.server.redis,
          'status:incidents',
          CACHE_TTL_SEC,
          async () => {
            const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)
            const dayCol = sql<string>`to_char(${llmCallLogs.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`
            const startedAtCol = utcIsoText(sql`min(${llmCallLogs.createdAt})`)
            const resolvedAtCol = utcIsoText(sql`max(${llmCallLogs.createdAt})`)
            const rows = await dbRead
              .select({
                providerCode: llmCallLogs.providerCode,
                date: dayCol,
                startedAt: startedAtCol,
                resolvedAt: resolvedAtCol,
                errorCount: sql<number>`count(*)::int`,
                latestModel: sql<
                  string | null
                >`(array_agg(${llmCallLogs.model} ORDER BY ${llmCallLogs.createdAt} DESC))[1]`,
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
            return { incidents: mapIncidentRows(rows), degraded: false }
          },
        )
        return reply.send(success(data))
      } catch (e) {
        // schema drift(provider_code 字段未迁移)、驱动返回形态异常或任何其他查询错误时,
        // 仍回 HTTP 200 以免拖累状态页整体可用性,**但响应体必须喊出"这是降级不是清白"**:
        // degraded:true 让消费方能区分「确实没有事件」与「查询失败所以没有事件」。
        // 旧写法只回裸空数组 —— 那就是"把没判写成判过了",账面绿而用户永远看不到故障。
        request.log.error(
          { err: e, endpoint: 'incidents' },
          'status incidents query failed, degrading to empty list with degraded=true',
        )
        return reply.send(success<IncidentsPayload>({ incidents: [], degraded: true }))
      }
    },
  )
}

export default publicStatusRoutes
