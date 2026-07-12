import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import {
  findCategories,
  createCategory,
  createTicket,
  findTicketById,
  findTickets,
  transitionTicket,
  assignTicket,
  updateTicket,
  deleteTicket,
  createComment,
  findCommentsByTicket,
  findAgents,
  createAgent,
  updateAgentStatus,
  findAgentById,
  findAgentByUserId,
  createRating,
  findRatingByTicket,
} from '../db/customer-service-queries.js'

const ADMIN_ROLE_ID = 1

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const listTicketsQuery = z.object({
  ...paginationQuery,
  status: z.preprocess(emptyToUndefined, z.string().max(16).optional()),
  categoryId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  priority: z.preprocess(emptyToUndefined, z.string().max(16).optional()),
})

const adminListTicketsQuery = listTicketsQuery.extend({
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  assigneeId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
})

const createTicketSchema = z.object({
  title: z.string().min(2, '标题至少 2 个字符').max(200),
  description: z.string().min(10, '描述至少 10 个字符').max(5000),
  categoryId: z.string().uuid().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  source: z.string().max(16).optional(),
  attachments: z.array(z.unknown()).optional(),
})

const updateTicketSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
})

const transitionSchema = z.object({
  status: z.enum(['pending', 'open', 'resolved', 'closed', 'rejected']),
})

const assignSchema = z.object({
  agentId: z.string().uuid('assigneeId 不能为空'),
})

const createCommentSchema = z.object({
  content: z.string().min(1, '回复内容不能为空').max(5000),
  attachments: z.array(z.unknown()).optional(),
})

const createCategorySchema = z.object({
  name: z.string().min(1).max(64),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'slug 仅允许小写字母、数字与连字符'),
  description: z.string().max(255).nullable().optional(),
  sortOrder: z.number().int().optional(),
})

const createAgentSchema = z.object({
  userId: z.string().uuid(),
  nickname: z.string().min(1).max(64),
  avatar: z.string().max(500).nullable().optional(),
  maxConcurrent: z.number().int().min(1).max(100).optional(),
  skills: z.array(z.string()).optional(),
})

const updateAgentStatusSchema = z.object({
  status: z.enum(['online', 'busy', 'away', 'offline']),
})

const createRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).nullable().optional(),
})

// =============================================================================
// 响应 schema 片段
// =============================================================================

const okResponse = {
  200: {
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

const createdResponse = {
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
// 鉴权辅助
// =============================================================================

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

// =============================================================================
// 用户路由（前缀 /api/customer-service，需登录）
// 工单流程：提交 → 查看 → 评论 → 评级
// =============================================================================

export const customerServiceRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // GET /customer-service/categories - 分类列表（公开给已登录用户）
  server.get(
    '/categories',
    { schema: { summary: '工单分类列表', tags: ['customer-service'], response: okResponse } },
    async (_request, reply) => {
      const list = await findCategories()
      return reply.send(success({ list }))
    },
  )

  // GET /customer-service/tickets - 我的工单列表
  server.get(
    '/tickets',
    {
      schema: {
        summary: '我的工单列表',
        tags: ['customer-service'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string' },
            categoryId: { type: 'string' },
            priority: { type: 'string' },
          },
        },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = listTicketsQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findTickets({ ...parsed.data, userId: request.userId! })
      return reply.send(success(result))
    },
  )

  // GET /customer-service/tickets/:id - 工单详情（仅本人或管理员）
  server.get(
    '/tickets/:id',
    { schema: { summary: '工单详情', tags: ['customer-service'], response: okResponse } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const ticket = await findTicketById(parsed.data.id)
      if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
      const roleId = request.jwtPayload?.roleId ?? 0
      if (ticket.userId !== request.userId && roleId < ADMIN_ROLE_ID) {
        return reply.status(403).send(error(403, '无权访问该工单'))
      }
      const comments = await findCommentsByTicket(parsed.data.id)
      const rating = await findRatingByTicket(parsed.data.id)
      return reply.send(success({ ticket, comments, rating }))
    },
  )

  // POST /customer-service/tickets - 创建工单
  server.post(
    '/tickets',
    {
      schema: {
        summary: '创建工单',
        tags: ['customer-service'],
        body: { type: 'object', additionalProperties: true },
        response: createdResponse,
      },
    },
    async (request, reply) => {
      const parsed = createTicketSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const ticket = await createTicket({ userId: request.userId!, ...parsed.data })
      return reply.status(201).send(success({ ticket }))
    },
  )

  // PUT /customer-service/tickets/:id - 更新工单（仅本人，且仅 pending 状态）
  server.put(
    '/tickets/:id',
    {
      schema: {
        summary: '更新工单',
        tags: ['customer-service'],
        body: { type: 'object', additionalProperties: true },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = updateTicketSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findTicketById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '工单不存在'))
      if (existing.userId !== request.userId) return reply.status(403).send(error(403, '无权操作'))
      if (existing.status !== 'pending')
        return reply.status(400).send(error(400, '工单状态不允许修改'))
      const ticket = await updateTicket(parsed.data.id, body.data)
      return reply.send(success({ ticket }))
    },
  )

  // DELETE /customer-service/tickets/:id - 撤销工单（仅本人，且仅 pending 状态）
  server.delete(
    '/tickets/:id',
    { schema: { summary: '撤销工单', tags: ['customer-service'], response: okResponse } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findTicketById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '工单不存在'))
      if (existing.userId !== request.userId) return reply.status(403).send(error(403, '无权操作'))
      if (existing.status !== 'pending')
        return reply.status(400).send(error(400, '工单状态不允许撤销'))
      await deleteTicket(parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    },
  )

  // GET /customer-service/tickets/:id/comments - 工单评论列表
  server.get(
    '/tickets/:id/comments',
    { schema: { summary: '工单评论列表', tags: ['customer-service'], response: okResponse } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const ticket = await findTicketById(parsed.data.id)
      if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
      const roleId = request.jwtPayload?.roleId ?? 0
      if (ticket.userId !== request.userId && roleId < ADMIN_ROLE_ID) {
        return reply.status(403).send(error(403, '无权访问该工单'))
      }
      const comments = await findCommentsByTicket(parsed.data.id)
      return reply.send(success({ list: comments }))
    },
  )

  // POST /customer-service/tickets/:id/comments - 用户回复工单
  server.post(
    '/tickets/:id/comments',
    {
      schema: {
        summary: '回复工单',
        tags: ['customer-service'],
        body: { type: 'object', additionalProperties: true },
        response: createdResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = createCommentSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const ticket = await findTicketById(parsed.data.id)
      if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
      if (ticket.userId !== request.userId) return reply.status(403).send(error(403, '无权操作'))
      const comment = await createComment({
        ticketId: parsed.data.id,
        userId: request.userId!,
        content: body.data.content,
        isAdmin: false,
        attachments: body.data.attachments,
      })
      return reply.status(201).send(success({ comment }))
    },
  )

  // POST /customer-service/tickets/:id/rating - 用户对工单评级（仅 resolved/closed 可评）
  server.post(
    '/tickets/:id/rating',
    {
      schema: {
        summary: '工单评级',
        tags: ['customer-service'],
        body: { type: 'object', additionalProperties: true },
        response: createdResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = createRatingSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const ticket = await findTicketById(parsed.data.id)
      if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
      if (ticket.userId !== request.userId) return reply.status(403).send(error(403, '无权操作'))
      if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
        return reply.status(400).send(error(400, '工单未解决，暂不可评级'))
      }
      const existing = await findRatingByTicket(parsed.data.id)
      if (existing) return reply.status(400).send(error(400, '该工单已评级'))
      const rating = await createRating({
        ticketId: parsed.data.id,
        userId: request.userId!,
        agentId: ticket.assigneeId,
        rating: body.data.rating,
        comment: body.data.comment,
      })
      return reply.status(201).send(success({ rating }))
    },
  )

  // GET /customer-service/agents - 坐席列表（用户可查看在线坐席）
  server.get(
    '/agents',
    {
      schema: {
        summary: '坐席列表',
        tags: ['customer-service'],
        querystring: { type: 'object', properties: { status: { type: 'string' } } },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const status = (request.query as { status?: string }).status
      const list = await findAgents(status)
      return reply.send(success({ list }))
    },
  )
}

// =============================================================================
// 管理员路由（前缀 /api/admin/customer-service）
// 工单流程：分配 → 状态流转 → 客服回复 → 坐席管理
// =============================================================================

export const adminCustomerServiceRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 分类管理 =====

  // POST /admin/customer-service/categories - 创建分类
  server.post(
    '/categories',
    {
      schema: {
        summary: '创建工单分类',
        tags: ['customer-service'],
        body: { type: 'object', additionalProperties: true },
        response: createdResponse,
      },
    },
    async (request, reply) => {
      const parsed = createCategorySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const category = await createCategory(parsed.data)
      return reply.status(201).send(success({ category }))
    },
  )

  // ===== 工单管理 =====

  // GET /admin/customer-service/tickets - 工单列表
  server.get(
    '/tickets',
    {
      schema: {
        summary: '工单列表',
        tags: ['customer-service'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string' },
            categoryId: { type: 'string' },
            priority: { type: 'string' },
            userId: { type: 'string' },
            assigneeId: { type: 'string' },
          },
        },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = adminListTicketsQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findTickets(parsed.data)
      return reply.send(success(result))
    },
  )

  // POST /admin/customer-service/tickets/:id/transition - 工单状态流转
  server.post(
    '/tickets/:id/transition',
    {
      schema: {
        summary: '工单状态流转',
        tags: ['customer-service'],
        body: { type: 'object', additionalProperties: true },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = transitionSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const res = await transitionTicket(parsed.data.id, body.data.status)
      if (res.reason === 'not_found') return reply.status(404).send(error(404, '工单不存在'))
      if (res.reason === 'invalid_transition') {
        return reply.status(400).send(error(400, '当前状态不允许流转到目标状态'))
      }
      return reply.send(success({ ticket: res.ticket }))
    },
  )

  // POST /admin/customer-service/tickets/:id/assign - 分配工单
  server.post(
    '/tickets/:id/assign',
    {
      schema: {
        summary: '分配工单',
        tags: ['customer-service'],
        body: { type: 'object', additionalProperties: true },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = assignSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const agent = await findAgentById(body.data.agentId)
      if (!agent) return reply.status(404).send(error(404, '坐席不存在'))
      const res = await assignTicket(parsed.data.id, body.data.agentId)
      if (res.reason === 'not_found') return reply.status(404).send(error(404, '工单不存在'))
      return reply.send(success({ ticket: res.ticket }))
    },
  )

  // POST /admin/customer-service/tickets/:id/comments - 客服回复工单
  server.post(
    '/tickets/:id/comments',
    {
      schema: {
        summary: '客服回复工单',
        tags: ['customer-service'],
        body: { type: 'object', additionalProperties: true },
        response: createdResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = createCommentSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const ticket = await findTicketById(parsed.data.id)
      if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
      const comment = await createComment({
        ticketId: parsed.data.id,
        userId: request.userId!,
        content: body.data.content,
        isAdmin: true,
        attachments: body.data.attachments,
      })
      return reply.status(201).send(success({ comment }))
    },
  )

  // ===== 坐席管理 =====

  // GET /admin/customer-service/agents - 坐席列表
  server.get(
    '/agents',
    {
      schema: {
        summary: '坐席列表',
        tags: ['customer-service'],
        querystring: { type: 'object', properties: { status: { type: 'string' } } },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const status = (request.query as { status?: string }).status
      const list = await findAgents(status)
      return reply.send(success({ list }))
    },
  )

  // POST /admin/customer-service/agents - 创建坐席
  server.post(
    '/agents',
    {
      schema: {
        summary: '创建坐席',
        tags: ['customer-service'],
        body: { type: 'object', additionalProperties: true },
        response: createdResponse,
      },
    },
    async (request, reply) => {
      const parsed = createAgentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findAgentByUserId(parsed.data.userId)
      if (existing) return reply.status(400).send(error(400, '该用户已是坐席'))
      const agent = await createAgent(parsed.data)
      return reply.status(201).send(success({ agent }))
    },
  )

  // PUT /admin/customer-service/agents/:id/status - 更新坐席状态
  server.put(
    '/agents/:id/status',
    {
      schema: {
        summary: '更新坐席状态',
        tags: ['customer-service'],
        body: { type: 'object', additionalProperties: true },
        response: okResponse,
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = updateAgentStatusSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const agent = await updateAgentStatus(parsed.data.id, body.data.status)
      if (!agent) return reply.status(404).send(error(404, '坐席不存在'))
      return reply.send(success({ agent }))
    },
  )
}
