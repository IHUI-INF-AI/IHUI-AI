// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 监控告警路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/monitor, /admin/monitoring
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { Redis, RedisKey } from 'ioredis'
import { eq, desc, and, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { monitorAlerts } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow, emptyToUndefined } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'

/* -------------------------------------------------------------------------- */
/*  Redis INFO 解析 & 辅助函数                                                   */
/* -------------------------------------------------------------------------- */

function parseRedisInfo(info: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {}
  let currentSection = ''
  for (const line of info.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('# ')) {
      currentSection = trimmed.slice(2)
      sections[currentSection] = {}
    } else if (currentSection && trimmed.includes(':')) {
      const sep = trimmed.indexOf(':')
      const section = sections[currentSection]
      if (section) {
        section[trimmed.slice(0, sep)] = trimmed.slice(sep + 1)
      }
    }
  }
  return sections
}

interface TopKey {
  key: string
  type: string
  size: number
  encoding: string
}

interface PrefixEntry {
  prefix: string
  count: number
  totalSize: number
}

async function getTopRedisKeys(redis: Redis, limit = 20): Promise<TopKey[]> {
  const results: TopKey[] = []
  let cursor = 0
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'COUNT', 200)
    cursor = Number(nextCursor)
    for (const key of keys) {
      if (results.length >= limit * 3) break
      try {
        const [type, memory, encoding] = await Promise.all([
          redis.type(key),
          redis.memory('USAGE', key as RedisKey).catch(() => 0),
          redis.object('ENCODING', key as RedisKey).catch(() => 'unknown'),
        ])
        results.push({
          key,
          type: type as string,
          size: (memory ?? 0) as number,
          encoding: encoding as string,
        })
      } catch {
        // skip keys that error
      }
    }
    if (results.length >= limit * 3) break
  } while (cursor !== 0)
  return results.sort((a, b) => b.size - a.size).slice(0, limit)
}

async function getKeysByPrefix(redis: Redis): Promise<PrefixEntry[]> {
  const prefixMap = new Map<string, { count: number; totalSize: number }>()
  let cursor = 0
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'COUNT', 500)
    cursor = Number(nextCursor)
    for (const key of keys) {
      const prefix = key.includes(':') ? (key.split(':')[0] ?? '') || 'other' : 'other'
      const entry = prefixMap.get(prefix) ?? { count: 0, totalSize: 0 }
      entry.count++
      try {
        const memory = await redis.memory('USAGE', key as RedisKey)
        entry.totalSize += (memory ?? 0) as number
      } catch {
        // skip
      }
      prefixMap.set(prefix, entry)
    }
  } while (cursor !== 0)
  return Array.from(prefixMap.entries())
    .map(([prefix, data]) => ({ prefix, count: data.count, totalSize: data.totalSize }))
    .sort((a, b) => b.totalSize - a.totalSize)
}

/**
 * 告警列表的筛选参数。
 *
 * 只约束"长度像不像一个列值"(库列是 varchar(20)),**不**在此处枚举合法取值:
 * 合法词表由前端 `@/lib/admin/monitor-alert-vocabulary` 独家持有(AGENTS.md §0.6),
 * 后端再抄一份就会漂移。未知取值命中 0 行,是诚实的"没有这种值",不是静默放行。
 */
const monitorAlertsQuerySchema = z.object({
  severity: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

export const monitorRoutes: FastifyPluginAsync = async (server) => {
  server.post(
    '/admin/monitor/alerts/:id/ack',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const [row] = await db
        .update(monitorAlerts)
        .set({ status: 'suppressed' })
        .where(eq(monitorAlerts.id, id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '告警不存在'))
      return reply.send(success(row))
    },
  )
  server.post(
    '/admin/monitor/alerts/:id/resolve',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const [row] = await db
        .update(monitorAlerts)
        .set({ status: 'resolved', resolvedAt: new Date() })
        .where(eq(monitorAlerts.id, id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '告警不存在'))
      return reply.send(success(row))
    },
  )
  /**
   * GET /admin/monitor/funnel/:id —— 已摘除(2026-10-31,admin 监控崩溃族 ④)。
   *
   * 这条路由是**假路由**:`:id` 要求 UUID、返回的是"按单条告警聚合"的一行,
   * 而 web 的漏斗页传的是 'signup'/'purchase' 这类漏斗名 ⇒ 必 404、页面恒空。
   * 真正的业务漏斗在 `GET /api/earnings/funnel`(register→active→byok→vip),
   * web 侧已改读它,本路由一并摘除(不留第二份"看起来能用"的空实现)。
   */

  /**
   * GET /admin/monitoring/alerts —— 告警列表(可按 severity / status 真过滤)。
   *
   * 为什么带筛选:web 的 admin 监控告警页原来把 `level=`/`status=` 发给
   * registerCrud 的 GET,而那个工厂只解析 page/pageSize/search ⇒ 两个筛选器
   * **从未生效**(控件在、筛选不发生)。这里按库列真名 severity/status 真的过滤,
   * 且 total 是**过滤后**的条数(不是 list.length,否则分页与总数会各说各话)。
   *
   * 词表不在后端另立一份(AGENTS.md §0.6):severity/status 的取值集合由
   * `@ihui/types` 的 `MONITOR_ALERT_SEVERITIES/STATUSES` 独家持有,后端只做列等值过滤,
   * 传进来的未知值自然命中 0 行,不会把"没判"说成"没有"。
   */
  server.get('/admin/monitoring/alerts', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = monitorAlertsQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
    const { severity, status } = parsed.data
    const conditions = []
    if (severity) conditions.push(eq(monitorAlerts.severity, severity))
    if (status) conditions.push(eq(monitorAlerts.status, status))
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const list = await db
      .select()
      .from(monitorAlerts)
      .where(where)
      .orderBy(desc(monitorAlerts.firedAt))
      .limit(100)
    const [totalRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(monitorAlerts)
      .where(where)
    return reply.send(success({ list, total: totalRow?.c ?? 0 }))
  })
  server.get('/admin/monitor/redis', { preHandler: requireAdmin }, async (_request, reply) => {
    const redis = server.redis

    // 获取 Redis INFO 完整输出
    const infoRaw = await redis.info('all')
    const parsed = parseRedisInfo(infoRaw)

    // 提取数值辅助
    const num = (section: string, key: string): number => {
      const val = parsed[section]?.[key]
      return val ? Number.parseInt(val, 10) : 0
    }

    // 从 Keyspace 汇总总 key 数
    const keyspace = parsed['Keyspace'] ?? {}
    const totalKeys = Object.values(keyspace).reduce<number>((sum, line) => {
      const m = line.match(/keys=(\d+)/)
      return sum + (m ? Number.parseInt(m[1] ?? '', 10) || 0 : 0)
    }, 0)

    // 命中率
    const hits = num('Stats', 'keyspace_hits')
    const misses = num('Stats', 'keyspace_misses')
    const totalOps = hits + misses
    const hitRate = totalOps > 0 ? Math.round((hits / totalOps) * 10_000) / 100 : 0
    const missRate = totalOps > 0 ? Math.round((misses / totalOps) * 10_000) / 100 : 0

    // 并行扫描 keys
    const [topKeys, byPrefix] = await Promise.all([getTopRedisKeys(redis), getKeysByPrefix(redis)])

    return reply.send(
      success({
        overview: {
          totalKeys,
          usedMemory: num('Memory', 'used_memory'),
          maxMemory: num('Memory', 'maxmemory'),
          hitRate,
          missRate,
          hits,
          misses,
          evictions: num('Stats', 'evicted_keys'),
          connectedClients: num('Clients', 'connected_clients'),
          uptime: num('Server', 'uptime_in_seconds'),
          opsPerSec: num('Stats', 'instantaneous_ops_per_sec'),
        },
        topKeys,
        byPrefix,
      }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
