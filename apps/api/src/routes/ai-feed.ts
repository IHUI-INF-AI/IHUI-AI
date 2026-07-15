import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import {
  listSources,
  listFeedItems,
  getFeedItem,
  getTrendChart,
  getSourceStats,
  collectAllSources,
  processLlmBatch,
  translateTitles,
} from '../services/ai-feed-service.js'

// =============================================================================
// Zod schemas
// =============================================================================

const itemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  source: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  category: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  trend: z.preprocess(emptyToUndefined, z.string().max(16).optional()),
  keyword: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const trendsQuerySchema = z.object({
  itemId: z.string().uuid('无效的条目 ID'),
  window: z.coerce.number().int().min(1).max(30).default(14),
})

const sourcesQuerySchema = z.object({
  enabledOnly: z
    .preprocess(emptyToUndefined, z.enum(['true', 'false']))
    .default('true')
    .transform((v) => v === 'true'),
})

const summarizeBodySchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
})

const translateBodySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
})

// =============================================================================
// 路由
// =============================================================================

const aiFeedRoutes: FastifyPluginAsync = async (server) => {
  // GET /sources — 数据源列表（前端动态 Tab 渲染）
  server.get('/sources', async (request, reply) => {
    const parsed = sourcesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const list = await listSources(parsed.data.enabledOnly)
    return reply.send(success({ list }))
  })

  // GET /items — 资讯条目分页（支持 source/category/trend/keyword 筛选）
  server.get('/items', async (request, reply) => {
    const parsed = itemsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await listFeedItems(parsed.data)
    return reply.send(success(result))
  })

  // GET /hot — 热门资讯别名（前端调用 /api/ai-feed/hot）
  server.get('/hot', async (request, reply) => {
    const parsed = itemsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await listFeedItems(parsed.data)
    return reply.send(success(result))
  })

  // GET /items/:id — 条目详情
  server.get<{ Params: { id: string } }>('/items/:id', async (request, reply) => {
    const { id } = request.params
    const item = await getFeedItem(id)
    if (!item) return reply.status(404).send(error(404, '条目不存在'))
    return reply.send(success({ item }))
  })

  // GET /trends — 趋势图表数据（7/14 天曲线，需传 itemId 查询参数）
  server.get('/trends', async (request, reply) => {
    const parsed = trendsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const data = await getTrendChart(parsed.data.itemId, parsed.data.window)
    if (!data) return reply.status(404).send(error(404, '条目不存在'))
    return reply.send(success(data))
  })

  // GET /stats — 采集统计（管理/调试用）
  server.get('/stats', async (_request, reply) => {
    const list = await getSourceStats()
    return reply.send(success({ list }))
  })

  // ----- 管理操作（需 admin）-----

  // POST /collect — 手动触发采集
  server.post('/collect', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const result = await collectAllSources()
    return reply.send(success(result))
  })

  // POST /summarize — LLM 分类摘要批处理
  server.post('/summarize', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = summarizeBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await processLlmBatch(parsed.data.limit ?? 100)
    return reply.send(success(result))
  })

  // POST /translate — 标题翻译批处理
  server.post('/translate', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = translateBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await translateTitles(parsed.data.limit ?? 50)
    return reply.send(success(result))
  })
}

export default aiFeedRoutes
