import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  findPublishedLiveCategories,
  findAllLiveCategories,
  findLiveCategoryById,
  createLiveCategory,
  updateLiveCategory,
  deleteLiveCategory,
  findLiveChannels,
  findLiveChannelById,
  findLiveChannelsByIds,
  createLiveChannel,
  updateLiveChannel,
  deleteLiveChannel,
  incrementLiveViewCount,
  findLecturers,
  findLecturerById,
  createLecturer,
  updateLecturer,
  deleteLecturer,
  getLiveStatistics,
} from '../db/live-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

/** 复用响应 schema：data 字段允许任意附加属性。 */
const R = {
  200: {
    type: 'object',
    properties: {
      code: { type: 'number' },
      message: { type: 'string' },
      data: { type: 'object', additionalProperties: true },
    },
  },
  201: {
    type: 'object',
    properties: {
      code: { type: 'number' },
      message: { type: 'string' },
      data: { type: 'object', additionalProperties: true },
    },
  },
  400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
  401: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
  403: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
  404: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
}

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const listChannelsQuery = z.object({
  ...paginationQuery,
  search: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  categoryId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  lecturerId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  isLive: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
})

const listLecturersQuery = z.object({
  ...paginationQuery,
  name: z.preprocess(emptyToUndefined, z.string().min(1).max(100).optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
})

const byIdsQuery = z.object({
  ids: z.string().min(1, 'ids 不能为空'),
})

const createLiveCategorySchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateLiveCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const createChannelSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  coverImage: z.string().max(500).nullable().optional(),
  intro: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  lecturerId: z.string().uuid().nullable().optional(),
  lecturerName: z.string().max(100).nullable().optional(),
  pushUrl: z.string().max(500).nullable().optional(),
  playUrl: z.string().max(500).nullable().optional(),
  startTime: z.string().datetime().nullable().optional(),
  endTime: z.string().datetime().nullable().optional(),
  isLive: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
})

const updateChannelSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  coverImage: z.string().max(500).nullable().optional(),
  intro: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  lecturerId: z.string().uuid().nullable().optional(),
  lecturerName: z.string().max(100).nullable().optional(),
  pushUrl: z.string().max(500).nullable().optional(),
  playUrl: z.string().max(500).nullable().optional(),
  startTime: z.string().datetime().nullable().optional(),
  endTime: z.string().datetime().nullable().optional(),
  isLive: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
})

const createLecturerSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  avatar: z.string().max(500).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  intro: z.string().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateLecturerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().max(500).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  intro: z.string().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const streamNotifySchema = z.object({
  streamId: z.string().optional(),
  channelId: z.string().optional(),
  streamName: z.string().optional(),
  app: z.string().optional(),
  clientIp: z.string().optional(),
  serverIp: z.string().optional(),
  publishStartTime: z.string().optional(),
  publishEndTime: z.string().optional(),
  eventTime: z.string().optional(),
  eventType: z.string().optional(),
  sign: z.string().optional(),
  t: z.string().optional(),
})

const tencentStreamQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  streamName: z.string().optional(),
  status: z.string().optional(),
})

// =============================================================================
// 鉴权辅助
// =============================================================================

/** 解析可选 ISO 时间字符串为 Date，空值返回 null。 */
function parseTime(v: string | null | undefined): Date | null {
  if (!v) return null
  return new Date(v)
}

// =============================================================================
// 公共路由（前缀 /api，需登录）
// =============================================================================

export const liveRoutes: FastifyPluginAsync = async (server) => {
  // GET /live/categories - 启用的分类列表（公开）
  server.get('/live/categories', { schema: { response: R } }, async (_request, reply) => {
    const list = await findPublishedLiveCategories()
    return reply.send(success({ list }))
  })

  // GET /live/channels - 已发布频道列表（分页）
  server.get('/live/channels', { schema: { response: R } }, async (request, reply) => {
    const parsed = listChannelsQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findLiveChannels({ ...parsed.data, publishedOnly: true })
    return reply.send(success(result))
  })

  // GET /live/channels/by-ids - 批量获取频道
  server.get('/live/channels/by-ids', { schema: { response: R } }, async (request, reply) => {
    const parsed = byIdsQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const ids = parsed.data.ids
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    const list = await findLiveChannelsByIds(ids)
    return reply.send(success({ list }))
  })

  // GET /live/channels/:id - 频道详情
  server.get('/live/channels/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const channel = await findLiveChannelById(parsed.data.id)
    if (!channel || !channel.isPublished || channel.status !== 1) {
      return reply.status(404).send(error(404, '频道不存在'))
    }
    await incrementLiveViewCount(parsed.data.id)
    return reply.send(success({ channel }))
  })

  // GET /live/lecturers - 讲师列表
  server.get('/live/lecturers', { schema: { response: R } }, async (request, reply) => {
    const parsed = listLecturersQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findLecturers({ ...parsed.data, status: parsed.data.status ?? 1 })
    return reply.send(success(result))
  })

  // GET /live/lecturers/:id - 讲师详情
  server.get('/live/lecturers/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lecturer = await findLecturerById(parsed.data.id)
    if (!lecturer) {
      return reply.status(404).send(error(404, '讲师不存在'))
    }
    return reply.send(success({ lecturer }))
  })

  // GET /live/statistics - 直播统计
  server.get('/live/statistics', { schema: { response: R } }, async (_request, reply) => {
    const statistics = await getLiveStatistics()
    return reply.send(success({ statistics }))
  })

  // POST /live/notify/stream-begin - 直播推流开始回调（腾讯云回调）
  server.post('/live/notify/stream-begin', async (request, reply) => {
    const parsed = streamNotifySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    return reply.send(success({ ok: true, event: 'stream-begin', data: parsed.data }))
  })

  // POST /live/notify/stream-end - 直播推流结束回调（腾讯云回调）
  server.post('/live/notify/stream-end', async (request, reply) => {
    const parsed = streamNotifySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    return reply.send(success({ ok: true, event: 'stream-end', data: parsed.data }))
  })
}

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminLiveRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ----- 分类管理 -----

  server.get('/live/categories', { schema: { response: R } }, async (_request, reply) => {
    const list = await findAllLiveCategories()
    return reply.send(success({ list }))
  })

  server.get('/live/categories/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const category = await findLiveCategoryById(parsed.data.id)
    if (!category) {
      return reply.status(404).send(error(404, '分类不存在'))
    }
    return reply.send(success({ category }))
  })

  server.post('/live/categories', { schema: { response: R } }, async (request, reply) => {
    const parsed = createLiveCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const category = await createLiveCategory(parsed.data)
    return reply.status(201).send(success({ category }))
  })

  server.put('/live/categories/:id', { schema: { response: R } }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateLiveCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findLiveCategoryById(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '分类不存在'))
    }
    const category = await updateLiveCategory(idParsed.data.id, parsed.data)
    return reply.send(success({ category }))
  })

  server.delete('/live/categories/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findLiveCategoryById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '分类不存在'))
    }
    await deleteLiveCategory(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- 频道管理 -----

  server.get('/live/channels', { schema: { response: R } }, async (request, reply) => {
    const parsed = listChannelsQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findLiveChannels(parsed.data)
    return reply.send(success(result))
  })

  server.get('/live/channels/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const channel = await findLiveChannelById(parsed.data.id)
    if (!channel) {
      return reply.status(404).send(error(404, '频道不存在'))
    }
    return reply.send(success({ channel }))
  })

  server.post('/live/channels', { schema: { response: R } }, async (request, reply) => {
    const parsed = createChannelSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const channel = await createLiveChannel({
      ...parsed.data,
      startTime: parseTime(parsed.data.startTime),
      endTime: parseTime(parsed.data.endTime),
    })
    return reply.status(201).send(success({ channel }))
  })

  server.put('/live/channels/:id', { schema: { response: R } }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateChannelSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findLiveChannelById(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '频道不存在'))
    }
    const channel = await updateLiveChannel(idParsed.data.id, {
      ...parsed.data,
      startTime: parseTime(parsed.data.startTime),
      endTime: parseTime(parsed.data.endTime),
    })
    return reply.send(success({ channel }))
  })

  server.delete('/live/channels/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findLiveChannelById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '频道不存在'))
    }
    await deleteLiveChannel(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- 讲师管理 -----

  // GET /live/lecturers - 讲师列表(含禁用,管理员用)
  server.get('/live/lecturers', { schema: { response: R } }, async (request, reply) => {
    const parsed = listLecturersQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findLecturers(parsed.data)
    return reply.send(success(result))
  })

  server.post('/live/lecturers', { schema: { response: R } }, async (request, reply) => {
    const parsed = createLecturerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const lecturer = await createLecturer(parsed.data)
    return reply.status(201).send(success({ lecturer }))
  })

  server.put('/live/lecturers/:id', { schema: { response: R } }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateLecturerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findLecturerById(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '讲师不存在'))
    }
    const lecturer = await updateLecturer(idParsed.data.id, parsed.data)
    return reply.send(success({ lecturer }))
  })

  server.delete('/live/lecturers/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findLecturerById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '讲师不存在'))
    }
    await deleteLecturer(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- 腾讯云直播流管理 -----

  // POST /live/tencent/streams - 创建腾讯云直播流
  server.post('/live/tencent/streams', { schema: { response: R } }, async (request, reply) => {
    const body = request.body as { streamName?: string; app?: string }
    if (!body.streamName) {
      return reply.status(400).send(error(400, 'streamName 不能为空'))
    }
    return reply.send(
      success({
        streamName: body.streamName,
        pushUrl: `rtmp://push.example.com/live/${body.streamName}`,
        playUrl: `rtmp://play.example.com/live/${body.streamName}`,
      }),
    )
  })

  // GET /live/tencent/streams - 查询腾讯云直播流列表
  server.get('/live/tencent/streams', { schema: { response: R } }, async (request, reply) => {
    const parsed = tencentStreamQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    return reply.send(
      success({
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total: 0,
        list: [],
      }),
    )
  })

  // GET /live/tencent/callback-templates - 获取回调模板列表
  server.get(
    '/live/tencent/callback-templates',
    { schema: { response: R } },
    async (_request, reply) => {
      return reply.send(
        success({
          templates: [
            { templateId: '0', templateName: '默认模板', description: '系统默认回调模板' },
          ],
        }),
      )
    },
  )
}
