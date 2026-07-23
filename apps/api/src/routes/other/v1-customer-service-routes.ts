/**
 * v1 客服(从 frontend-stub-other-routes.ts 拆分)。
 * GET /v1/customer_service/{messages,messages/read,ticket,ticket/:id,ticket/:id/replies,ticket/:id/rate,ticket/:id/close,faqs}
 */
import type { FastifyPluginAsync } from 'fastify'
import { eq, and, or, desc, asc, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { dbRead } from '../../db/index.js'
import { messages, zhsFaq } from '@ihui/database'
import {
  findTickets,
  findTicketById,
  findCommentsByTicket,
  findRatingByTicket,
  transitionTicket,
} from '../../db/customer-service-queries.js'
import { parsePagination, parseIdParam } from './_shared.js'

export const v1CustomerServiceRoutes: FastifyPluginAsync = async (server) => {
  // GET /v1/customer_service/messages — 当前用户消息列表
  server.get('/v1/customer_service/messages', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = or(
      eq(messages.senderId, request.userId!),
      eq(messages.receiverId, request.userId!),
    )
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(messages)
        .where(where)
        .orderBy(desc(messages.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /v1/customer_service/messages/read — 未读消息数
  server.get('/v1/customer_service/messages/read', async (request, reply) => {
    const [row] = await dbRead
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.receiverId, request.userId!), eq(messages.isRead, false)))
    return reply.send(success({ unreadCount: row?.count ?? 0 }))
  })

  // GET /v1/customer_service/ticket — 当前用户工单列表
  server.get('/v1/customer_service/ticket', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findTickets({
      page: q.page,
      pageSize: q.pageSize,
      userId: request.userId!,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /v1/customer_service/ticket/:id — 工单详情
  server.get('/v1/customer_service/ticket/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const ticket = await findTicketById(id)
    if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
    if (ticket.userId !== request.userId)
      return reply.status(403).send(error(403, '无权查看此工单'))
    return reply.send(success({ ticket }))
  })

  // GET /v1/customer_service/ticket/:id/replies — 工单回复列表
  server.get('/v1/customer_service/ticket/:id/replies', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const ticket = await findTicketById(id)
    if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
    if (ticket.userId !== request.userId)
      return reply.status(403).send(error(403, '无权查看此工单'))
    const list = await findCommentsByTicket(id)
    return reply.send(success({ list, total: list.length }))
  })

  // GET /v1/customer_service/ticket/:id/rate — 工单评级
  server.get('/v1/customer_service/ticket/:id/rate', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const rating = await findRatingByTicket(id)
    return reply.send(success({ rating: rating ?? null }))
  })

  // GET /v1/customer_service/ticket/:id/close — 关闭工单(状态流转)
  server.get('/v1/customer_service/ticket/:id/close', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const ticket = await findTicketById(id)
    if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
    if (ticket.userId !== request.userId)
      return reply.status(403).send(error(403, '无权操作此工单'))
    const result = await transitionTicket(id, 'closed')
    if (result.reason === 'not_found') return reply.status(404).send(error(404, '工单不存在'))
    if (result.reason === 'invalid_transition')
      return reply.status(400).send(error(400, `当前状态 ${ticket.status} 不能直接关闭`))
    return reply.send(success({ ticket: result.ticket }))
  })

  // GET /v1/customer_service/faqs — FAQ 列表
  server.get('/v1/customer_service/faqs', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = eq(zhsFaq.published, true)
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(zhsFaq)
        .where(where)
        .orderBy(desc(zhsFaq.pinned), asc(zhsFaq.sortOrder))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(zhsFaq)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })
}
