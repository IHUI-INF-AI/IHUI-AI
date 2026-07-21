import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  countAiWorldItems,
  findAiWorldCategories,
  findAiWorldHotItems,
  findAiWorldItemById,
  findRecentSyncLogs,
  incrementViewCount,
  listAiWorldItems,
  type ItemKind,
} from '../db/ai-world-queries.js'
import { syncAllSources } from '../jobs/ai-world-sync.js'
import { success } from '../utils/response.js'

const ListQuerySchema = z.object({
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
  order: z.enum(['latest', 'hot', 'published']).default('latest'),
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
  }
}

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
      return reply.status(400).send({ code: 400, message: parsed.error.message, data: null })
    }
    const { category, limit, offset, search, order } = parsed.data
    const [items, total] = await Promise.all([
      listAiWorldItems({ kind: 'tool' as ItemKind, categorySlug: category, limit, offset, search, orderBy: order }),
      countAiWorldItems({ kind: 'tool', categorySlug: category, search }),
    ])
    return reply.send(success({ items: items.map(toItemDTO), total, limit, offset }))
  })

  // GET /ai-world/apps — APP 列表
  server.get('/ai-world/apps', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ code: 400, message: parsed.error.message, data: null })
    }
    const { category, limit, offset, search, order } = parsed.data
    const [items, total] = await Promise.all([
      listAiWorldItems({ kind: 'app' as ItemKind, categorySlug: category, limit, offset, search, orderBy: order }),
      countAiWorldItems({ kind: 'app', categorySlug: category, search }),
    ])
    return reply.send(success({ items: items.map(toItemDTO), total, limit, offset }))
  })

  // GET /ai-world/news — 资讯列表(含 paper/project,默认 kind=news)
  server.get('/ai-world/news', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ code: 400, message: parsed.error.message, data: null })
    }
    const { category, limit, offset, search, order } = parsed.data
    const [items, total] = await Promise.all([
      listAiWorldItems({ kind: 'news' as ItemKind, categorySlug: category, limit, offset, search, orderBy: order }),
      countAiWorldItems({ kind: 'news', categorySlug: category, search }),
    ])
    return reply.send(success({ items: items.map(toItemDTO), total, limit, offset }))
  })

  // GET /ai-world/papers — 论文列表
  server.get('/ai-world/papers', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ code: 400, message: parsed.error.message, data: null })
    }
    const { limit, offset, search, order } = parsed.data
    const [items, total] = await Promise.all([
      listAiWorldItems({ kind: 'paper' as ItemKind, limit, offset, search, orderBy: order }),
      countAiWorldItems({ kind: 'paper', search }),
    ])
    return reply.send(success({ items: items.map(toItemDTO), total, limit, offset }))
  })

  // GET /ai-world/projects — GitHub 项目列表
  server.get('/ai-world/projects', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ code: 400, message: parsed.error.message, data: null })
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
      return reply.status(404).send({ code: 404, message: 'Not found', data: null })
    }
    // 异步增浏览数,不阻塞响应
    void incrementViewCount(item.id)
    return reply.send(success(toItemDTO([item][0]!)))
  })

  // GET /ai-world/sync/logs — 同步日志(最近 20 条)
  server.get('/ai-world/sync/logs', async (_request, reply) => {
    const logs = await findRecentSyncLogs(20)
    return reply.send(success(logs))
  })

  // POST /ai-world/sync — 手动触发同步(admin)
  server.post('/ai-world/sync', async (_request, reply) => {
    const results = await syncAllSources()
    const ok = results.filter((r) => r.status === 'success').length
    const fail = results.filter((r) => r.status === 'failed').length
    return reply.send(success({ total: results.length, success: ok, failed: fail, results }))
  })
}
