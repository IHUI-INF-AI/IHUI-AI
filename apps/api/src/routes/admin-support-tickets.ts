import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error, emptyToUndefined } from '../utils/response.js'
import {
  findTicketById,
  updateTicket,
  createComment,
  findCommentsByTicket,
} from '../db/customer-service-queries.js'

// 客服工单(admin/support/tickets)路由 - 3 个端点。
// 复用现有 customer_service_tickets / customer_service_comments 表(见
// packages/database/src/schema/customer-service.ts),与 /api/admin/customer-service
// 路由共用同一份数据。requireAdmin 由 admin-missing-routes.ts hub 统一挂载为 preHandler。
//
// 状态枚举映射:前端 TicketStatus('open'|'processing'|'closed'|'resolved') 与后端
// customer_service_tickets.status('pending'|'open'|'resolved'|'closed'|'rejected')
// 存在语义差异。写入时 'processing' 映射为后端 'open'(处理中);其余直接对应。
// 读回时返回后端原值,前端需自行兼容(完整双向映射属后续迭代,见
// admin-missing-routes.ts P0-3 复核注释)。

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

// 前端状态枚举 → 后端 customer_service_tickets.status 映射。
// 'processing'(处理中)→ 'open';其余直接对应。
const FRONTEND_TO_BACKEND_STATUS: Record<string, string> = {
  open: 'open',
  processing: 'open',
  closed: 'closed',
  resolved: 'resolved',
}

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
    const existing = await findTicketById(parsedParams.data.id)
    if (!existing) return reply.status(404).send(error(404, '工单不存在'))
    const backendStatus = FRONTEND_TO_BACKEND_STATUS[parsed.data.status]
    const ticket = await updateTicket(parsedParams.data.id, { status: backendStatus })
    return reply.send(success({ ticket }))
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
    const existing = await findTicketById(parsedParams.data.id)
    if (!existing) return reply.status(404).send(error(404, '工单不存在'))
    const replyRow = await createComment({
      ticketId: parsedParams.data.id,
      userId: request.userId!,
      content: parsed.data.content,
      isAdmin: parsed.data.isAdmin,
    })
    return reply.status(201).send(success({ reply: replyRow }))
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
    const existing = await findTicketById(parsedParams.data.id)
    if (!existing) return reply.status(404).send(error(404, '工单不存在'))
    const all = await findCommentsByTicket(parsedParams.data.id)
    const start = (parsed.data.page - 1) * parsed.data.pageSize
    const list = all.slice(start, start + parsed.data.pageSize)
    return reply.send(
      success({ list, total: all.length, page: parsed.data.page, pageSize: parsed.data.pageSize }),
    )
  })
}

export default adminSupportTicketsRoutes
