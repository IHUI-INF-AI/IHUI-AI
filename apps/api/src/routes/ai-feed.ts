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
  getTrendNotifications,
  proxyImage,
  computeTrendSignals,
  updateSource,
  type UpdateSourcePatch,
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

const notificationsQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(24),
  minGrowth: z.coerce.number().min(0).max(1000).default(15),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

const imageProxyQuerySchema = z.object({
  url: z
    .string()
    .url('无效的图片 URL')
    .refine((v) => /^https?:\/\//i.test(v), '仅支持 http/https 协议'),
})

const updateSourceBodySchema = z.object({
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  fetchIntervalMinutes: z.number().int().min(1).max(10080).optional(),
  sourceName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(64).optional(),
  color: z.string().max(16).optional(),
  icon: z.string().max(255).optional(),
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

  // GET /notifications — 趋势爆发通知（前端每 60s 轮询）
  server.get('/notifications', async (request, reply) => {
    const parsed = notificationsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await getTrendNotifications(
      parsed.data.hours,
      parsed.data.minGrowth,
      parsed.data.limit,
    )
    return reply.send(success(result))
  })

  // GET /image-proxy — 图片代理（防盗链，返回二进制流）
  server.get('/image-proxy', async (request, reply) => {
    const parsed = imageProxyQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const { buffer, contentType } = await proxyImage(parsed.data.url)
      return reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=86400')
        .header('Access-Control-Allow-Origin', '*')
        .send(buffer)
    } catch (e) {
      return reply.status(502).send(error(502, (e as Error).message ?? '图片代理失败'))
    }
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

  // POST /trend — 手动触发趋势信号计算（管理员）
  server.post('/trend', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const result = await computeTrendSignals()
    return reply.send(success(result))
  })

  // PUT /sources/:source_id — 更新数据源配置（管理员）
  server.put<{ Params: { source_id: string } }>('/sources/:source_id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = updateSourceBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const updated = await updateSource(request.params.source_id, parsed.data as UpdateSourcePatch)
    if (!updated) return reply.status(404).send(error(404, '数据源不存在'))
    return reply.send(success({ source: updated }))
  })
}

export default aiFeedRoutes
