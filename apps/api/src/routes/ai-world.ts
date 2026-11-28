// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  countAiWorldItems,
  countAiWorldRankings,
  countTrendingItems,
  findAiWorldCategories,
  findAiWorldHotItems,
  findAiWorldItemById,
  findRecentSyncLogs,
  incrementViewCount,
  listAiWorldItems,
  findAiWorldFavorites,
  listAiWorldRankings,
  listLeaderboards,
  listTrendingItems,
  type ItemKind,
} from '../db/ai-world-queries.js'
import {
  runDryRun,
  syncAllSources,
  syncRankings,
  syncTrendingMetrics,
  getSourceStats,
} from '../jobs/ai-world-sync.js'
import {
  getAuthoritativeLeaderboard,
  getAuthoritativeRefreshState,
  runAuthoritativeRefresh,
} from '../jobs/authoritative-leaderboard.js'
import { success, error } from '../utils/response.js'
import { requireAdmin, requireAuth } from '../plugins/require-permission.js'

const ListQuerySchema = z.object({
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
  order: z.enum(['latest', 'hot', 'published', 'trending']).default('latest'),
})

function toItemDTO(item: Awaited<ReturnType<typeof listAiWorldItems>>[number]) {
  return {
    id: item.id,
    kind: item.kind,
    categoryId: item.categoryId,
    title: item.title,
    summary: item.summary,
    url: item.url,
    coverImage: item.coverImage,
    source: item.source,
    sourceUrl: item.sourceUrl,
    publishedAt: item.publishedAt,
    fetchedAt: item.fetchedAt,
    metadata: item.metadata,
    viewCount: item.viewCount,
    likeCount: item.likeCount,
    trendingScore: item.trendingScore,
    trendingMetrics: item.trendingMetrics,
    trendingUpdatedAt: item.trendingUpdatedAt,
  }
}

const RankingQuerySchema = z.object({
  leaderboard: z.string().optional(),
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

const TrendingQuerySchema = z.object({
  kind: z.enum(['news', 'paper', 'project', 'tool', 'app']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const aiWorldRoutes: FastifyPluginAsync = async (server) => {
  // GET /ai-world — 旧入口(保留兼容,返回分类 + 各 kind 顶部条目)
  server.get('/ai-world', async (_request, reply) => {
    const categories = await findAiWorldCategories()
    const [tools, apps, news] = await Promise.all([
      findAiWorldHotItems('tool', 6),
      findAiWorldHotItems('app', 6),
      findAiWorldHotItems('news', 6),
    ])
    return reply.send(
      success({
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          icon: c.icon,
          sort: c.sort,
        })),
        tools: tools.map(toItemDTO),
        apps: apps.map(toItemDTO),
        news: news.map(toItemDTO),
      }),
    )
  })

  // GET /ai-world/categories — 全部分类
  server.get('/ai-world/categories', async (_request, reply) => {
    const categories = await findAiWorldCategories()
    return reply.send(success(categories))
  })

  // GET /ai-world/tools — 工具列表(?category=&limit=&offset=&search=&order=)
  server.get('/ai-world/tools', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.message ?? '参数错误'))
    }
    const { category, limit, offset, search, order } = parsed.data
    const [items, total] = await Promise.all([
      listAiWorldItems({
        kind: 'tool' as ItemKind,
        categorySlug: category,
        limit,
        offset,
        search,
        orderBy: order,
      }),
      countAiWorldItems({ kind: 'tool', categorySlug: category, search }),
    ])
    return reply.send(success({ items: items.map(toItemDTO), total, limit, offset }))
  })

  // GET /ai-world/apps — APP 列表
  server.get('/ai-world/apps', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.message ?? '参数错误'))
    }
    const { category, limit, offset, search, order } = parsed.data
    const [items, total] = await Promise.all([
      listAiWorldItems({
        kind: 'app' as ItemKind,
        categorySlug: category,
        limit,
        offset,
        search,
        orderBy: order,
      }),
      countAiWorldItems({ kind: 'app', categorySlug: category, search }),
    ])
    return reply.send(success({ items: items.map(toItemDTO), total, limit, offset }))
  })

  // GET /ai-world/news — 资讯列表(含 paper/project,默认 kind=news)
  // 2026-08-06 修复:前端 helpers.ts 统一按 `${kind}s` 拼接( news → newss ),
  // 注册 newss 别名,否则前端资讯列表请求 500 → 页面 fallback 旧数据。
  const newsListHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void> = async (
    request,
    reply,
  ) => {
    const parsed = ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.message ?? '参数错误'))
    }
    const { category, limit, offset, search, order } = parsed.data
    const [items, total] = await Promise.all([
      listAiWorldItems({
        kind: 'news' as ItemKind,
        categorySlug: category,
        limit,
        offset,
        search,
        orderBy: order,
      }),
      countAiWorldItems({ kind: 'news', categorySlug: category, search }),
    ])
    return reply.send(success({ items: items.map(toItemDTO), total, limit, offset }))
  }
  server.get('/ai-world/news', newsListHandler)
  server.get('/ai-world/newss', newsListHandler)

  // GET /ai-world/papers — 论文列表
  server.get('/ai-world/papers', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.message ?? '参数错误'))
    }
    const { limit, offset, search, order } = parsed.data
    const [items, total] = await Promise.all([
      listAiWorldItems({ kind: 'paper' as ItemKind, limit, offset, search, orderBy: order }),
      countAiWorldItems({ kind: 'paper', search }),
    ])
    return reply.send(success({ items: items.map(toItemDTO), total, limit, offset }))
  })

  // GET /ai-world/projects — GitHub 项目列表
  // GET /ai-world/favorites — 我的收藏 AI 项目(2026-08-06 立,修复孤儿页面)
  server.get('/ai-world/favorites', { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as { userId?: string }).userId
    if (!userId) {
      return reply.status(401).send(error(401, '未登录'))
    }
    try {
      const list = await findAiWorldFavorites(userId)
      return reply.send(success({ list }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '收藏列表查询失败'))
    }
  })

  server.get('/ai-world/projects', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.message ?? '参数错误'))
    }
    const { limit, offset, search, order } = parsed.data
    const [items, total] = await Promise.all([
      listAiWorldItems({ kind: 'project' as ItemKind, limit, offset, search, orderBy: order }),
      countAiWorldItems({ kind: 'project', search }),
    ])
    return reply.send(success({ items: items.map(toItemDTO), total, limit, offset }))
  })

  // GET /ai-world/items/:id — 详情
  server.get<{ Params: { id: string } }>('/ai-world/items/:id', async (request, reply) => {
    const item = await findAiWorldItemById(request.params.id)
    if (!item) {
      return reply.status(404).send(error(404, '资源不存在'))
    }
    // 异步增浏览数,不阻塞响应;挂 catch 避免未处理 Promise 拒绝
    void incrementViewCount(item.id).catch((err) => {
      server.log.error({ err }, 'incrementViewCount failed')
    })
    return reply.send(success(toItemDTO([item][0]!)))
  })

  // GET /ai-world/sync/logs — 同步日志(最近 20 条)+ 信源统计
  server.get('/ai-world/sync/logs', async (_request, reply) => {
    try {
      const [logs, stats] = await Promise.all([
        findRecentSyncLogs(20),
        Promise.resolve(getSourceStats()),
      ])
      return reply.send(success({ logs, stats }))
    } catch (err) {
      server.log.error({ err }, 'ai-world sync/logs failed')
      return reply.status(500).send(error(500, '同步失败'))
    }
  })

  // POST /ai-world/sync — 手动触发同步(admin,支持 ?dry-run=true 只预估不写库)
  server.post('/ai-world/sync', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const query = (request.query ?? {}) as { 'dry-run'?: string }
      if (query['dry-run'] === 'true' || query['dry-run'] === '1') {
        const results = await runDryRun()
        const totalEstimated = results.reduce((sum, r) => sum + r.estimatedItems, 0)
        const failed = results.filter((r) => r.error).length
        return reply.send(
          success({
            dryRun: true,
            total: results.length,
            totalEstimated,
            failed,
            stats: getSourceStats(),
            results,
          }),
        )
      }
      const results = await syncAllSources()
      const ok = results.filter((r) => r.status === 'success').length
      const partial = results.filter((r) => r.status === 'partial').length
      const fail = results.filter((r) => r.status === 'failed').length
      const totalItems = results.reduce((sum, r) => sum + r.itemCount, 0)
      return reply.send(
        success({
          total: results.length,
          success: ok,
          partial,
          failed: fail,
          totalItems,
          stats: getSourceStats(),
          results,
        }),
      )
    } catch (err) {
      server.log.error({ err }, 'ai-world sync failed')
      return reply.status(500).send(error(500, '同步失败'))
    }
  })

  // ===== 模型排行榜端点(2026-07-22 新增) =====

  // GET /ai-world/rankings/leaderboards — 可用榜单列表(去重 leaderboard,聚合 categories)
  server.get('/ai-world/rankings/leaderboards', async (_request, reply) => {
    const leaderboards = await listLeaderboards()
    return reply.send(success({ leaderboards, total: leaderboards.length }))
  })

  // GET /ai-world/rankings — 排行榜列表(?leaderboard=&category=&limit=20&offset=0)
  server.get('/ai-world/rankings', async (request, reply) => {
    const parsed = RankingQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.message ?? '参数错误'))
    }
    const { leaderboard, category, limit, offset } = parsed.data
    const [items, total] = await Promise.all([
      listAiWorldRankings({ leaderboard, category, limit, offset }),
      countAiWorldRankings({ leaderboard, category }),
    ])
    return reply.send(success({ items, total, limit, offset }))
  })

  // ===== 权威榜(2026-11-28 立):服务端每 6 小时刷新,页面读最新快照 =====

  // GET /ai-world/authoritative-leaderboard — 三榜聚合最新快照(公开)
  server.get('/ai-world/authoritative-leaderboard', async (_request, reply) => {
    const snapshot = await getAuthoritativeLeaderboard(server.redis)
    if (!snapshot) {
      return reply.status(503).send(error(503, '权威榜快照尚未就绪'))
    }
    reply.header('cache-control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300')
    return reply.send(success(snapshot))
  })

  // GET /ai-world/authoritative-leaderboard/boards — 新增平台榜单索引(不带 rows)
  server.get('/ai-world/authoritative-leaderboard/boards', async (_request, reply) => {
    const snapshot = await getAuthoritativeLeaderboard(server.redis)
    if (!snapshot) return reply.status(503).send(error(503, '权威榜快照尚未就绪'))
    const boards = (snapshot.boards ?? []).map(({ rows, ...board }) => ({
      ...board,
      totalRows: rows.length,
    }))
    reply.header('cache-control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300')
    return reply.send(success(boards))
  })

  // GET /ai-world/authoritative-leaderboard/boards/:id — 单个平台全量/分页行
  server.get('/ai-world/authoritative-leaderboard/boards/:id', async (request, reply) => {
    const snapshot = await getAuthoritativeLeaderboard(server.redis)
    if (!snapshot) return reply.status(503).send(error(503, '权威榜快照尚未就绪'))
    const id = (request.params as { id?: string }).id ?? ''
    const board = (snapshot.boards ?? []).find((item) => item.id === id)
    if (!board) return reply.status(404).send(error(404, `榜单不存在: ${id}`))
    const query = request.query as { limit?: string; offset?: string; q?: string }
    const limitRaw = Number(query.limit ?? board.rows.length)
    const offsetRaw = Number(query.offset ?? 0)
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.trunc(limitRaw), 1), 5000)
      : board.rows.length
    const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0
    const q = (query.q ?? '').trim().toLowerCase()
    const filtered = q
      ? board.rows.filter((row) => `${row.model} ${row.vendor}`.toLowerCase().includes(q))
      : board.rows
    reply.header('cache-control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300')
    return reply.send(
      success({
        ...board,
        totalRows: filtered.length,
        limit,
        offset,
        rows: filtered.slice(offset, offset + limit),
      }),
    )
  })

  // GET /ai-world/authoritative-leaderboard/status — 最近一次自动刷新状态(公开只暴露运行状态)
  server.get('/ai-world/authoritative-leaderboard/status', async (_request, reply) => {
    const [state, snapshot] = await Promise.all([
      getAuthoritativeRefreshState(server.redis),
      getAuthoritativeLeaderboard(server.redis),
    ])
    return reply.send(
      success({
        state,
        snapshot: snapshot
          ? {
              generatedAt: snapshot.generatedAt,
              lastSuccessAt: snapshot.refresh.lastSuccessAt,
              stale: snapshot.refresh.stale,
              mode: snapshot.refresh.mode,
              schedule: snapshot.refresh.schedule,
            }
          : null,
      }),
    )
  })

  // POST /ai-world/authoritative-leaderboard/refresh — 管理员手动触发
  server.post(
    '/ai-world/authoritative-leaderboard/refresh',
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      void runAuthoritativeRefresh(server.redis, server.log, 'manual').catch((err) => {
        server.log.error({ err }, 'ai-world authoritative leaderboard manual refresh failed')
      })
      return reply.status(202).send(success({ accepted: true, trigger: 'manual' }))
    },
  )

  // ===== 热度排行端点(2026-07-22 新增) =====

  // GET /ai-world/trending — 热度排行(?kind=&limit=20&offset=0,按 trendingScore desc)
  server.get('/ai-world/trending', async (request, reply) => {
    const parsed = TrendingQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.message ?? '参数错误'))
    }
    const { kind, limit, offset } = parsed.data
    const [items, total] = await Promise.all([
      listTrendingItems({ kind: kind as ItemKind | undefined, limit, offset }),
      countTrendingItems({ kind: kind as ItemKind | undefined }),
    ])
    return reply.send(success({ items: items.map(toItemDTO), total, limit, offset }))
  })

  // ===== 手动触发同步端点(2026-07-22 新增) =====

  // POST /ai-world/sync/rankings — 手动触发模型排行榜同步
  server.post(
    '/ai-world/sync/rankings',
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      try {
        const results = await syncRankings()
        const ok = results.filter((r) => r.status === 'success').length
        const fail = results.filter((r) => r.status === 'failed').length
        const totalItems = results.reduce((sum, r) => sum + r.itemCount, 0)
        return reply.send(
          success({
            total: results.length,
            success: ok,
            failed: fail,
            totalItems,
            results,
          }),
        )
      } catch (err) {
        server.log.error({ err }, 'ai-world sync/rankings failed')
        return reply.status(500).send(error(500, '同步失败'))
      }
    },
  )

  // POST /ai-world/sync/trending — 手动触发热度更新
  server.post(
    '/ai-world/sync/trending',
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      try {
        const results = await syncTrendingMetrics()
        const ok = results.filter((r) => r.status === 'success').length
        const fail = results.filter((r) => r.status === 'failed').length
        const totalItems = results.reduce((sum, r) => sum + r.itemCount, 0)
        return reply.send(
          success({
            total: results.length,
            success: ok,
            failed: fail,
            totalItems,
            results,
          }),
        )
      } catch (err) {
        server.log.error({ err }, 'ai-world sync/trending failed')
        return reply.status(500).send(error(500, '同步失败'))
      }
    },
  )

  // POST /ai-world/sync/dry-run — 跑 dry-run(返回预计条目数,不写库)
  server.post('/ai-world/sync/dry-run', { preHandler: [requireAdmin] }, async (_request, reply) => {
    try {
      const results = await runDryRun()
      const totalEstimated = results.reduce((sum, r) => sum + r.estimatedItems, 0)
      const failed = results.filter((r) => r.error).length
      return reply.send(
        success({
          dryRun: true,
          total: results.length,
          totalEstimated,
          failed,
          stats: getSourceStats(),
          results,
        }),
      )
    } catch (err) {
      server.log.error({ err }, 'ai-world sync/dry-run failed')
      return reply.status(500).send(error(500, '同步失败'))
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
