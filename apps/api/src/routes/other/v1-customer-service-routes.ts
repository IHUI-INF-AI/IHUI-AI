// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * v1 客服(从 frontend-stub-other-routes.ts 拆分)。
 * GET /v1/customer_service/{messages,messages/read,ticket,ticket/:id,ticket/:id/replies,ticket/:id/rate,ticket/:id/close,faqs}
 */
import type { FastifyPluginAsync } from 'fastify'
import { eq, and, or, desc, asc, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
// O4b 数据闸接线(2026-09-20):站内信(messages)是用户态数据,机器凭据
// (messages:read = scoped-read)只能读"收件人是自己"的行,故走受控读出口 dbReadScoped。
// FAQ(zhs_faq,全站已发布内容)与工单族(db/customer-service-queries.js)不在本次接线范围:
// 前者无 owner 列(scoped-read 下必然 403,接线等于打死端点),后者被后台/客服面共用,
// 需要独立的归属映射(见交付清单)。
import { dbRead, dbReadScoped } from '../../db/index.js'
import { configureDataScopeGuard } from '../../utils/scoped-guard.js'
import { messages, zhsFaq } from '@ihui/database'
import {
  findTickets,
  findTicketById,
  findCommentsByTicket,
  findRatingByTicket,
  transitionTicket,
} from '../../db/customer-service-queries.js'
import { parsePagination, parseIdParam } from './_shared.js'
import { requireCapabilityRules } from '../../utils/capability-guard.js'
import { openCapabilityRules } from '../../config/open-capability-registry.js'
import { requireOpenCapability } from '../../utils/open-capability-gate.js'

// messages 表没有 user_id 列,归属由会话双方表达(sender_id / receiver_id)。
// 本族两个读端点都以"收件人 = 调用主体"为过滤条件,故登记 receiver_id 为该表的 owner 列,
// 让数据闸的 owner 证据判据认得这张表的真实归属形态(判据本身不放宽)。
configureDataScopeGuard({ ownerColumnByTable: { messages: 'receiver_id' } })

export const v1CustomerServiceRoutes: FastifyPluginAsync = async (server) => {
  // O6 收口(原 O3 仅 declareCapability 登记、不强制):客服消息 / 工单(用户态遗留桩)。
  // 读端点归 messages:read;ticket/:id/close 是状态流转,单独登记成 messages:write,
  // 规则表按字面量长度降序匹配,故 close 不会被 catch-all 降级成只读 scope。
  server.addHook(
    'preHandler',
    requireOpenCapability(
      requireCapabilityRules(
        openCapabilityRules('v1-customer-service-read', 'v1-customer-service-close'),
      ),
    ),
  )

  // GET /v1/customer_service/messages — 当前用户消息列表
  server.get('/v1/customer_service/messages', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = or(
      eq(messages.senderId, request.userId!),
      eq(messages.receiverId, request.userId!),
    )
    const [list, totalRows] = await Promise.all([
      dbReadScoped
        .select()
        .from(messages)
        .where(where)
        .orderBy(desc(messages.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbReadScoped
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
    const [row] = await dbReadScoped
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
  // 全站已发布内容(zhs_faq 无 owner 列),刻意保持原始出口:见文件头说明。
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
