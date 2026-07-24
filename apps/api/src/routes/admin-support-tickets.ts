import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error, emptyToUndefined } from '../utils/response.js'

// 客服工单(admin/support/tickets)路由 - 3 个端点。
// 注:本项目暂未建立独立 support_tickets 表;现有 customerServiceTickets 走 /api/admin/customer-service,
// 与前端 admin/ticket 页面的 TicketStatus('open'|'processing'|'closed'|'resolved')语义不一致。
// 此处提供空桩路由,消除 404,保证前端调用契约成立;待 support_tickets 表落地后再行实装。

const idParamSchema = z.object({ id: z.string().min(1) })

const statusBodySchema = z.object({
  status: z.enum(['open', 'processing', 'closed', 'resolved']),
})

const replyBodySchema = z.object({
  content: z.string().min(1).max(5000),
  isAdmin: z.boolean().optional().default(true),
})

const listQuerySchema = z.object({
  page: z.preprocess((v) => emptyToUndefined(v), z.coerce.number().int().min(1).default(1)),
  pageSize: z.preprocess(
    (v) => emptyToUndefined(v),
    z.coerce.number().int().min(1).max(100).default(20),
  ),
})

const adminSupportTicketsRoutes: FastifyPluginAsync = async (server) => {
  // PUT /support/tickets/:id/status — 更新工单状态
  server.put('/support/tickets/:id/status', async (request, reply) => {
    const parsedParams = idParamSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = statusBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 空桩:无 support_tickets 表,仅返回成功确认
    return reply.send(success({ id: parsedParams.data.id, status: parsed.data.status }))
  })

  // POST /support/tickets/:id/reply — 客服回复工单
  server.post('/support/tickets/:id/reply', async (request, reply) => {
    const parsedParams = idParamSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = replyBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 空桩:无 support_tickets 表,仅返回成功确认
    return reply
      .status(201)
      .send(
        success({ ticketId: parsedParams.data.id, replied: true, isAdmin: parsed.data.isAdmin }),
      )
  })

  // GET /support/tickets/:id/replies — 工单回复列表
  server.get('/support/tickets/:id/replies', async (request, reply) => {
    const parsedParams = idParamSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 空桩:无 support_ticket_replies 表,返回空列表
    return reply.send(success({ list: [], total: 0 }))
  })
}

export default adminSupportTicketsRoutes
