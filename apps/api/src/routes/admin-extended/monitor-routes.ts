/**
 * 监控告警路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/monitor, /admin/monitoring
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { Redis, RedisKey } from 'ioredis'
import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { monitorAlerts } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
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
  server.get('/admin/monitor/funnel/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    // 基于现有 monitorAlerts 表按来源聚合生成漏斗数据
    const rows = await db
      .select({
        source: monitorAlerts.source,
        severity: monitorAlerts.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(monitorAlerts)
      .where(eq(monitorAlerts.id, id))
      .groupBy(monitorAlerts.source, monitorAlerts.severity)
    return reply.send(success({ funnel: rows, total: rows.reduce((s, r) => s + r.count, 0) }))
  })
  server.get('/admin/monitoring/alerts', { preHandler: requireAdmin }, async (_request, reply) => {
    const list = await db
      .select()
      .from(monitorAlerts)
      .orderBy(desc(monitorAlerts.firedAt))
      .limit(100)
    return reply.send(success({ list, total: list.length }))
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
