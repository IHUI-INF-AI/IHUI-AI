/**
 * P1-3 智能体分类字典缓存 5 端点（迁移自 coze_zhs_py/api/agent_category_cache_api.py）
 *
 * 端点清单：
 *   1. GET    /api/agent-categories/cache         获取分类缓存（全量 / 分页）
 *   2. POST   /api/agent-categories/cache/refresh 刷新分类缓存
 *   3. DELETE /api/agent-categories/cache         清空分类缓存
 *   4. GET    /api/agent-categories/cache/:key    获取单条缓存
 *   5. POST   /api/agent-categories/cache/sync    同步缓存到 DB
 *
 * 实现：in-memory Map（进程级单例，简化实现，后续可换 Redis，见 AGENTS.md §5）。
 * 鉴权：requireAdmin（roleId >= 1，与 admin 路由一致）。
 * 路径：绝对路径字面量注册，确保 scripts/check-api-routes.mjs 静态扫描可识别。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// In-memory cache store（进程级单例）
// =============================================================================

interface CategoryCacheEntry {
  key: string
  /** Zod z.unknown() 推断为 optional，此处保持一致 */
  value?: unknown
  /** 0=种类, 1=赛道（保留源端语义，可空） */
  field2?: string
  name?: string
  url?: string
  butUrl?: string
  sort?: number
  updatedAt: string
}

const cacheStore = new Map<string, CategoryCacheEntry>()
let lastRefreshedAt: string | null = null

// =============================================================================
// Zod schemas
// =============================================================================

const cacheKeyParam = z.object({
  key: z.string().min(1).max(128),
})

const listQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  keyword: z.string().optional(),
})

const syncBodySchema = z.object({
  upsert: z
    .array(
      z.object({
        key: z.string().min(1).max(128),
        value: z.unknown(),
        field2: z.string().max(8).optional(),
        name: z.string().max(200).optional(),
        url: z.string().max(500).optional(),
        butUrl: z.string().max(500).optional(),
        sort: z.number().int().min(0).optional(),
      }),
    )
    .default([]),
  deleteKeys: z.array(z.string().min(1).max(128)).max(100).default([]),
})

function toPositiveInt(v: string | undefined, fallback: number): number {
  if (!v) return fallback
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// =============================================================================
// Routes plugin
// =============================================================================

export const agentCategoriesCacheRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 1. GET /api/agent-categories/cache - 获取分类缓存（全量 / 分页）
  server.get('/api/agent-categories/cache', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const q = parsed.data
    const page = toPositiveInt(q.page, 1)
    const pageSize = toPositiveInt(q.pageSize, 50)
    const keyword = q.keyword?.trim().toLowerCase()
    let all = Array.from(cacheStore.values())
    if (keyword) {
      all = all.filter((entry) => {
        const name = (entry.name ?? '').toLowerCase()
        return entry.key.toLowerCase().includes(keyword) || name.includes(keyword)
      })
    }
    all.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.key.localeCompare(b.key))
    const start = (page - 1) * pageSize
    const items = all.slice(start, start + pageSize)
    return reply.send(
      success({
        items,
        total: all.length,
        page,
        pageSize,
        lastRefreshedAt,
      }),
    )
  })

  // 2. POST /api/agent-categories/cache/refresh - 刷新分类缓存
  server.post('/api/agent-categories/cache/refresh', async (_req, reply) => {
    lastRefreshedAt = new Date().toISOString()
    return reply.send(
      success({
        refreshed: true,
        lastRefreshedAt,
        total: cacheStore.size,
      }),
    )
  })

  // 5. POST /api/agent-categories/cache/sync - 同步缓存到 DB
  //    简化实现：接收 upsert + deleteKeys 增量，更新内存缓存 + 时间戳
  //    （后续接 DB 时替换为 onConflictDoNothing + DELETE WHERE key IN (...)）
  server.post('/api/agent-categories/cache/sync', async (request, reply) => {
    const parsed = syncBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = parsed.data
    const syncedAt = new Date().toISOString()
    let upserted = 0
    for (const item of body.upsert) {
      cacheStore.set(item.key, { ...item, updatedAt: syncedAt })
      upserted += 1
    }
    let deleted = 0
    for (const key of body.deleteKeys) {
      if (cacheStore.delete(key)) deleted += 1
    }
    if (upserted > 0 || deleted > 0) {
      lastRefreshedAt = syncedAt
    }
    return reply.send(
      success({
        synced: true,
        syncedAt,
        upserted,
        deleted,
        total: cacheStore.size,
      }),
    )
  })

  // 3. DELETE /api/agent-categories/cache - 清空分类缓存
  server.delete('/api/agent-categories/cache', async (_req, reply) => {
    const cleared = cacheStore.size
    cacheStore.clear()
    lastRefreshedAt = null
    return reply.send(success({ cleared, clearedAt: new Date().toISOString() }))
  })

  // 4. GET /api/agent-categories/cache/:key - 获取单条缓存
  server.get('/api/agent-categories/cache/:key', async (request, reply) => {
    const { key } = cacheKeyParam.parse(request.params)
    const entry = cacheStore.get(key)
    if (!entry) return reply.status(404).send(error(404, '缓存条目不存在'))
    return reply.send(success(entry))
  })
}
