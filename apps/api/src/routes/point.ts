import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  findChannels,
  findAllActiveChannels,
  findChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
  findPoints,
  findPointById,
  createPoint,
  updatePoint,
  deletePoint,
  findRelations,
  updatePointRelations,
  findRecords,
  findUserPointsBalance,
  increasePoints,
  decreasePoints,
  fallbackPoints,
} from '../db/point-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// 通用响应 schema(data 透传)
const responseSchema = {
  200: {
    type: 'object',
    properties: {
      code: { type: 'number' },
      message: { type: 'string' },
      data: { type: 'object', additionalProperties: true },
    },
  },
  400: {
    type: 'object',
    properties: { code: { type: 'number' }, message: { type: 'string' } },
  },
  401: {
    type: 'object',
    properties: { code: { type: 'number' }, message: { type: 'string' } },
  },
  404: {
    type: 'object',
    properties: { code: { type: 'number' }, message: { type: 'string' } },
  },
}

const responseSchema201 = {
  ...responseSchema,
  201: responseSchema[200],
}

// =============================================================================
// Zod schemas
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const channelsListQuery = z.object({
  ...paginationQuery,
  name: z.preprocess(emptyToUndefined, z.string().min(1).max(100).optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
})

const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(50).nullable().optional(),
  description: z.string().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(50).nullable().optional(),
  description: z.string().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const createPointSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(50).nullable().optional(),
  channelId: z.string().uuid().nullable().optional(),
  point: z.number().int().optional(),
  description: z.string().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updatePointSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(50).nullable().optional(),
  channelId: z.string().uuid().nullable().optional(),
  point: z.number().int().optional(),
  description: z.string().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const relationsListQuery = z.object({
  ...paginationQuery,
  pointId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  channelId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
})

const updateRelationsSchema = z.object({
  pointId: z.string().uuid('无效的积分规则 ID'),
  channelIds: z.array(z.string().uuid()).default([]),
})

const recordsListQuery = z.object({
  ...paginationQuery,
  memberId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  type: z.preprocess(emptyToUndefined, z.string().min(1).max(32).optional()),
})

const pointOperationSchema = z.object({
  memberId: z.string().uuid('无效的会员 ID'),
  channelId: z.string().uuid('无效的渠道 ID'),
  pointId: z.string().uuid('无效的积分规则 ID'),
  amount: z.number().int().positive('积分数量必须为正整数'),
  remark: z.string().max(255).optional(),
})

const fallbackSchema = z.object({
  recordId: z.string().uuid('无效的记录 ID'),
  remark: z.string().max(255).optional(),
})

const rulesListQuery = z.object({
  ...paginationQuery,
  name: z.preprocess(emptyToUndefined, z.string().min(1).max(100).optional()),
  channelId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
})

// =============================================================================
// 公共路由（前缀 /api，需登录）
// =============================================================================

export const pointRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /edu-points/channels - 所有启用渠道
  server.get(
    '/edu-points/channels',
    { schema: { response: { ...responseSchema } } },
    async (_request, reply) => {
      const list = await findAllActiveChannels()
      return reply.send(success({ list }))
    },
  )

  // GET /edu-points/channels/:id - 渠道详情
  server.get(
    '/edu-points/channels/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const channel = await findChannelById(parsed.data.id)
      if (!channel) return reply.status(404).send(error(404, '渠道不存在'))
      return reply.send(success({ channel }))
    },
  )

  // GET /edu-points/rules/:id - 积分规则详情
  server.get(
    '/edu-points/rules/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const point = await findPointById(parsed.data.id)
      if (!point) return reply.status(404).send(error(404, '积分规则不存在'))
      return reply.send(success({ point }))
    },
  )

  // GET /edu-points/my-points - 当前用户积分余额
  server.get(
    '/edu-points/my-points',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const points = await findUserPointsBalance(request.userId!)
      return reply.send(success({ points }))
    },
  )
}

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminPointRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ----- Channels Admin -----

  // GET /edu-points/channels - 渠道列表(分页)
  server.get(
    '/edu-points/channels',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = channelsListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findChannels(parsed.data)
      return reply.send(success(result))
    },
  )

  // POST /edu-points/channels - 创建渠道
  server.post(
    '/edu-points/channels',
    { schema: { response: { ...responseSchema201 } } },
    async (request, reply) => {
      const parsed = createChannelSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const channel = await createChannel(parsed.data)
      return reply.status(201).send(success({ channel }))
    },
  )

  // PUT /edu-points/channels/:id - 更新渠道
  server.put(
    '/edu-points/channels/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const idParsed = uuidParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updateChannelSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findChannelById(idParsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '渠道不存在'))
      const channel = await updateChannel(idParsed.data.id, parsed.data)
      return reply.send(success({ channel }))
    },
  )

  // GET /edu-points/channels/:id - 渠道详情(admin)
  server.get(
    '/edu-points/channels/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const channel = await findChannelById(parsed.data.id)
      if (!channel) return reply.status(404).send(error(404, '渠道不存在'))
      return reply.send(success({ channel }))
    },
  )

  // DELETE /edu-points/channels/:id - 删除渠道
  server.delete(
    '/edu-points/channels/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findChannelById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '渠道不存在'))
      await deleteChannel(parsed.data.id)
      return reply.send(success({ ok: true }))
    },
  )

  // ----- Points/Rules Admin -----

  // GET /edu-points/rules - 积分规则列表(分页)
  server.get(
    '/edu-points/rules',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = rulesListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findPoints(parsed.data)
      return reply.send(success(result))
    },
  )

  // POST /edu-points/rules - 创建积分规则
  server.post(
    '/edu-points/rules',
    { schema: { response: { ...responseSchema201 } } },
    async (request, reply) => {
      const parsed = createPointSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const point = await createPoint(parsed.data)
      return reply.status(201).send(success({ point }))
    },
  )

  // PUT /edu-points/rules/:id - 更新积分规则
  server.put(
    '/edu-points/rules/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const idParsed = uuidParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updatePointSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findPointById(idParsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '积分规则不存在'))
      const point = await updatePoint(idParsed.data.id, parsed.data)
      return reply.send(success({ point }))
    },
  )

  // DELETE /edu-points/rules/:id - 删除积分规则
  server.delete(
    '/edu-points/rules/:id',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findPointById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '积分规则不存在'))
      await deletePoint(parsed.data.id)
      return reply.send(success({ ok: true }))
    },
  )

  // ----- Relations Admin -----

  // GET /edu-points/relations - 渠道关联列表
  server.get(
    '/edu-points/relations',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = relationsListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findRelations(parsed.data)
      return reply.send(success(result))
    },
  )

  // PUT /edu-points/relations - 更新积分规则关联渠道(全量覆盖)
  server.put(
    '/edu-points/relations',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = updateRelationsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findPointById(parsed.data.pointId)
      if (!existing) return reply.status(404).send(error(404, '积分规则不存在'))
      const result = await updatePointRelations(parsed.data.pointId, parsed.data.channelIds)
      return reply.send(success(result))
    },
  )

  // ----- Records Admin -----

  // GET /edu-points/records - 积分记录列表
  server.get(
    '/edu-points/records',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = recordsListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findRecords(parsed.data)
      return reply.send(success(result))
    },
  )

  // ----- Increase / Decrease / Fallback 积分增减 -----

  // POST /edu-points/increase - 增加积分(事务包装 + 阈值校验 + channel.code 路由)
  server.post(
    '/edu-points/increase',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = pointOperationSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await increasePoints(parsed.data)
      return reply.send(success(result))
    },
  )

  // POST /edu-points/decrease - 扣减积分(余额校验 + 事务包装)
  server.post(
    '/edu-points/decrease',
    { schema: { response: { ...responseSchema } } },
    async (request, reply) => {
      const parsed = pointOperationSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await decreasePoints(parsed.data)
      return reply.send(success(result))
    },
  )

  // POST /edu-points/fallback - 积分回退(反向操作 + 幂等校验)
  server.post(
    '/edu-points/fallback',
    {
      schema: {
        response: {
          ...responseSchema,
          409: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = fallbackSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await fallbackPoints(parsed.data.recordId, parsed.data.remark)
      return reply.send(success(result))
    },
  )
}
