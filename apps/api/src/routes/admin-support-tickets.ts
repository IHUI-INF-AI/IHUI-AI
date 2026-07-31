import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { db } from '../db/index.js'
import { customerServiceTickets, customerServiceComments, users } from '@ihui/database'
import { eq, desc, sql, ilike, and, type SQL } from 'drizzle-orm'

// 客服工单(admin/support/tickets)路由 - 4 个端点,接 customerServiceTickets + customerServiceComments 表。
// status mapping: 前端 'open'|'processing'|'closed'|'resolved' ↔ 后端 'pending'|'open'|'resolved'|'closed'|'rejected'
// (前端 open = 待处理 = 后端 pending;前端 processing = 处理中 = 后端 open)

const FRONTEND_TO_BACKEND: Record<string, string> = {
  open: 'pending',
  processing: 'open',
  closed: 'closed',
  resolved: 'resolved',
}
const BACKEND_TO_FRONTEND: Record<string, string> = {
  pending: 'open',
  open: 'processing',
  resolved: 'resolved',
  closed: 'closed',
  rejected: 'rejected',
}

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

const ticketListQuerySchema = listQuerySchema.extend({
  status: z.preprocess(emptyToUndefined, z.enum(['open', 'processing', 'closed', 'resolved']).optional()),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const adminSupportTicketsRoutes: FastifyPluginAsync = async (server) => {
  // GET /support/tickets — 工单列表(分页 + status 筛选 + search 模糊匹配 title)
  server.get('/support/tickets', async (request, reply) => {
    const parsed = ticketListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, status, search } = parsed.data
    const conds: (SQL | undefined)[] = []
    if (status) {
      const backendStatus = FRONTEND_TO_BACKEND[status]
      if (backendStatus) conds.push(eq(customerServiceTickets.status, backendStatus))
    }
    if (search) conds.push(ilike(customerServiceTickets.title, `%${search}%`))
    const where = conds.length ? and(...conds) : undefined

    const [list, totalRow] = await Promise.all([
      db
        .select({
          id: customerServiceTickets.id,
          ticketNo: customerServiceTickets.ticketNo,
          userId: customerServiceTickets.userId,
          title: customerServiceTickets.title,
          status: customerServiceTickets.status,
          priority: customerServiceTickets.priority,
          source: customerServiceTickets.source,
          createdAt: customerServiceTickets.createdAt,
          updatedAt: customerServiceTickets.updatedAt,
          userName: users.username,
          userNickname: users.nickname,
        })
        .from(customerServiceTickets)
        .leftJoin(users, eq(users.id, customerServiceTickets.userId))
        .where(where)
        .orderBy(desc(customerServiceTickets.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(customerServiceTickets)
        .where(where),
    ])
    const mappedList = list.map((r) => ({
      ...r,
      status: BACKEND_TO_FRONTEND[r.status] ?? r.status,
      userName: r.userNickname ?? r.userName ?? undefined,
    }))
    return reply.send(success({ list: mappedList, total: totalRow[0]?.c ?? 0 }))
  })

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
    const backendStatus = FRONTEND_TO_BACKEND[parsed.data.status]
    if (!backendStatus) {
      return reply.status(400).send(error(400, '无效的 status 值'))
    }
    const now = new Date()
    const patch: { status: string; updatedAt: Date; resolvedAt?: Date; closedAt?: Date } = {
      status: backendStatus,
      updatedAt: now,
    }
    if (backendStatus === 'resolved') patch.resolvedAt = now
    if (backendStatus === 'closed') patch.closedAt = now

    const updated = await db
      .update(customerServiceTickets)
      .set(patch)
      .where(eq(customerServiceTickets.id, parsedParams.data.id))
      .returning({ id: customerServiceTickets.id, status: customerServiceTickets.status })
    const row = updated[0]
    if (!row) {
      return reply.status(404).send(error(404, '工单不存在'))
    }
    return reply.send(
      success({
        id: row.id,
        status: BACKEND_TO_FRONTEND[row.status] ?? row.status,
      }),
    )
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
    const ticket = await db
      .select({ id: customerServiceTickets.id })
      .from(customerServiceTickets)
      .where(eq(customerServiceTickets.id, parsedParams.data.id))
      .limit(1)
    if (ticket.length === 0) {
      return reply.status(404).send(error(404, '工单不存在'))
    }
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '未登录'))
    }
    const inserted = await db
      .insert(customerServiceComments)
      .values({
        ticketId: parsedParams.data.id,
        userId,
        content: parsed.data.content,
        isAdmin: true,
      })
      .returning({ id: customerServiceComments.id })
    const commentRow = inserted[0]
    if (!commentRow) {
      return reply.status(500).send(error(500, '回复写入失败'))
    }
    return reply.status(201).send(
      success({
        ticketId: parsedParams.data.id,
        replied: true,
        isAdmin: true,
        commentId: commentRow.id,
      }),
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
    const ticket = await db
      .select({ id: customerServiceTickets.id })
      .from(customerServiceTickets)
      .where(eq(customerServiceTickets.id, parsedParams.data.id))
      .limit(1)
    if (ticket.length === 0) {
      return reply.status(404).send(error(404, '工单不存在'))
    }
    const { page, pageSize } = parsed.data
    const [list, totalRow] = await Promise.all([
      db
        .select()
        .from(customerServiceComments)
        .where(eq(customerServiceComments.ticketId, parsedParams.data.id))
        .orderBy(desc(customerServiceComments.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(customerServiceComments)
        .where(eq(customerServiceComments.ticketId, parsedParams.data.id)),
    ])
    return reply.send(success({ list, total: totalRow[0]?.c ?? 0 }))
  })
}

export default adminSupportTicketsRoutes
