import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
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
  subscribeLiveChannel,
  unsubscribeLiveChannel,
  findUserSubscriptions,
} from '../db/live-queries.js'
import { findLiveCalendar } from '../db/live-calendar-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { config } from '../config/index.js'
import {
  verifyCallbackSignature,
  handleCallbackEvent,
  type CallbackSignatureHeaders,
} from '../services/tencent-live-service.js'

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

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

function deriveLiveStatus(isLive: boolean, isPublished: boolean): 'upcoming' | 'living' | 'ended' {
  if (isLive) return 'living'
  if (isPublished) return 'ended'
  return 'upcoming'
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

  // ----- P0-5: 腾讯云直播回调验签(checkSign) -----

  // POST /live/tencent/callback - 腾讯云直播回调端点(验签 + 事件处理)
  // 独立子作用域:捕获 raw body 用于 HMAC-SHA256 验签,不影响其他 live 路由的 JSON 解析。
  server.register(async (scope) => {
    scope.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (req, body, done) => {
        const raw = body as string
        ;(req as FastifyRequest & { rawBody?: string }).rawBody = raw
        if (!raw) {
          done(null, undefined)
          return
        }
        try {
          done(null, JSON.parse(raw))
        } catch (e) {
          done(e as Error, undefined)
        }
      },
    )

    scope.post('/live/tencent/callback', async (request, reply) => {
      const callbackKey = config.TENCENT_LIVE_CALLBACK_KEY
      if (!callbackKey) {
        return reply
          .status(503)
          .send(error(503, '腾讯云直播回调未配置'))
      }

      const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody ?? ''
      const headers = request.headers as CallbackSignatureHeaders
      const verify = verifyCallbackSignature(headers, rawBody, callbackKey)
      if (!verify.ok) {
        return reply.status(403).send(error(403, verify.reason ?? '验签失败'))
      }

      const body = (request.body as Record<string, unknown> | undefined) ?? {}
      const eventType =
        (body.event_type as string | undefined) ??
        (body.eventType as string | undefined) ??
        (body.action as string | undefined)
      const result = await handleCallbackEvent(eventType, body)
      return reply.send(success(result))
    })
  })

  // ----- P0-16: 小程序直播 API 路径对齐（公共，无需登录） -----

  // GET /live/list - 直播列表（简化字段）
  server.get('/live/list', { schema: { response: R } }, async (request, reply) => {
    const parsed = listChannelsQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findLiveChannels({ ...parsed.data, publishedOnly: true })
    const list = result.list.map((c) => ({
      id: c.id,
      title: c.title,
      status: deriveLiveStatus(c.isLive, c.isPublished),
      anchor: c.lecturerName,
      playUrl: c.playUrl,
      watchCount: c.viewCount,
    }))
    return reply.send(
      success({ list, total: result.total, page: result.page, pageSize: result.pageSize }),
    )
  })

  // GET /live/history - 回放列表（isLive=false && isPublished=true）
  server.get('/live/history', { schema: { response: R } }, async (request, reply) => {
    const parsed = listChannelsQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findLiveChannels({ ...parsed.data, isLive: false, publishedOnly: true })
    const list = result.list.map((c) => ({
      id: c.id,
      title: c.title,
      status: deriveLiveStatus(c.isLive, c.isPublished),
      anchor: c.lecturerName,
      playUrl: c.playUrl,
      watchCount: c.viewCount,
    }))
    return reply.send(
      success({ list, total: result.total, page: result.page, pageSize: result.pageSize }),
    )
  })

  // GET /live/calendar - 直播日历（按日期分组，公共，无需登录）
  const calendarQuerySchema = z.object({
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/, '月份格式应为 YYYY-MM')
      .optional(),
  })
  server.get('/live/calendar', { schema: { response: R } }, async (request, reply) => {
    const parsed = calendarQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const now = new Date()
    const monthStr =
      parsed.data.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const parts = monthStr.split('-').map(Number)
    const year = parts[0] ?? 0
    const month = parts[1] ?? 1
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)
    const result = await findLiveCalendar({
      page: 1,
      pageSize: 200,
      startDate,
      endDate,
    })
    const grouped = new Map<
      string,
      Array<{
        id: string
        title: string
        status: string
        anchor: string | null
        playUrl: string | null
        watchCount: number
      }>
    >()
    for (const c of result.list) {
      const st =
        c.startTime instanceof Date ? c.startTime : c.startTime ? new Date(c.startTime) : now
      const date = st.toISOString().slice(0, 10)
      if (!grouped.has(date)) grouped.set(date, [])
      grouped.get(date)!.push({
        id: c.id,
        title: c.title,
        status: deriveLiveStatus(c.isLive, c.isPublished),
        anchor: c.lecturerName,
        playUrl: c.playUrl,
        watchCount: c.viewCount,
      })
    }
    const list = Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, lives]) => ({ date, lives }))
    return reply.send(success({ list }))
  })

  // GET /live/subscriptions - 当前用户订阅的频道列表（需登录）
  server.get('/live/subscriptions', { schema: { response: R } }, async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const userId = request.userId!
    const list = await findUserSubscriptions(userId)
    return reply.send(success({ list }))
  })

  // GET /live/:id - 频道详情（简化字段，GET /live/channels/:id 的别名）
  server.get('/live/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const channel = await findLiveChannelById(parsed.data.id)
    if (!channel || !channel.isPublished || channel.status !== 1) {
      return reply.status(404).send(error(404, '频道不存在'))
    }
    await incrementLiveViewCount(parsed.data.id)
    return reply.send(
      success({
        id: channel.id,
        title: channel.title,
        status: deriveLiveStatus(channel.isLive, channel.isPublished),
        anchor: channel.lecturerName,
        playUrl: channel.playUrl,
        watchCount: channel.viewCount,
      }),
    )
  })

  // ----- P0-1: 直播订阅（需登录） -----

  // POST /live/:id/subscribe - 订阅直播频道
  server.post('/live/:id/subscribe', { schema: { response: R } }, async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    await subscribeLiveChannel(userId, parsed.data.id)
    return reply.status(201).send(success({ ok: true }))
  })

  // DELETE /live/:id/subscribe - 取消订阅
  server.delete('/live/:id/subscribe', { schema: { response: R } }, async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    await unsubscribeLiveChannel(userId, parsed.data.id)
    return reply.send(success({ ok: true }))
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
    const body = z
      .object({ streamName: z.string().optional(), app: z.string().optional() })
      .parse(request.body)
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
      const events = ['StreamBegin', 'StreamEnd', 'RecordFinished', 'Snapshot', 'PornDetect']
      const templates = [
        {
          id: 'default',
          name: '默认模板',
          callbackUrl: '/api/live/tencent/callback',
          events,
        },
        {
          id: 'full',
          name: '全事件模板',
          callbackUrl: '/api/live/tencent/callback',
          events,
        },
        {
          id: 'minimal',
          name: '精简模板(仅推流)',
          callbackUrl: '/api/live/tencent/callback',
          events: ['StreamBegin', 'StreamEnd'],
        },
      ]
      return reply.send(success({ templates }))
    },
  )
}
