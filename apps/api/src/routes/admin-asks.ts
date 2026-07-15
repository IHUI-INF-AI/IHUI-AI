import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, ilike, or } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { asks, users } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  keyword: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  status: z.preprocess(emptyToUndefined, z.string().optional()),
  resolved: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
})

const createSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  content: z.string().min(1, '内容不能为空').max(50000),
  tags: z.array(z.string().max(64)).max(20).optional().nullable(),
  status: z.number().int().optional(),
  isResolved: z.boolean().optional(),
})

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
  tags: z.array(z.string().max(64)).max(20).optional().nullable(),
  status: z.number().int().optional(),
  isResolved: z.boolean().optional(),
})

const auditSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending']).optional(),
  reason: z.string().max(500).optional(),
})

function statusStrToNum(s: 'approved' | 'rejected' | 'pending'): number {
  if (s === 'approved') return 1
  if (s === 'rejected') return -1
  return 0
}

function statusStrToNumOpt(s: string | undefined): number | undefined {
  if (!s) return undefined
  if (s === 'approved' || s === 'rejected' || s === 'pending') return statusStrToNum(s)
  const n = Number(s)
  return Number.isInteger(n) ? n : undefined
}

export const adminAskRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/asks', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, search, keyword, status, resolved } = parsed.data
    const kw = search ?? keyword
    const statusNum = statusStrToNumOpt(status)
    const conds: Array<ReturnType<typeof eq>> = []
    if (kw) {
      const like = `%${kw}%`
      conds.push(or(ilike(asks.title, like), ilike(asks.content, like))!)
    }
    if (statusNum !== undefined) conds.push(eq(asks.status, statusNum))
    if (resolved !== undefined) conds.push(eq(asks.isResolved, resolved))
    const where = conds.length > 0 ? and(...conds) : undefined
    const offset = (page - 1) * pageSize
    const cols = {
      id: asks.id,
      userId: asks.userId,
      title: asks.title,
      content: asks.content,
      tags: asks.tags,
      viewCount: asks.viewCount,
      answerCount: asks.answerCount,
      likeCount: asks.likeCount,
      isResolved: asks.isResolved,
      status: asks.status,
      createdAt: asks.createdAt,
      updatedAt: asks.updatedAt,
      userName: users.nickname,
    }
    const [list, totalRows] = await Promise.all([
      dbRead
        .select(cols)
        .from(asks)
        .leftJoin(users, eq(users.id, asks.userId))
        .where(where)
        .orderBy(desc(asks.createdAt))
        .limit(pageSize)
        .offset(offset),
      dbRead
        .select({ count: sql<number>`COUNT(*)` })
        .from(asks)
        .where(where),
    ])
    return reply.send(success({ list, total: Number(totalRows[0]?.count ?? 0), page, pageSize }))
  })

  server.post('/asks', async (request, reply) => {
    const body = createSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [created] = await db
      .insert(asks)
      .values({
        userId: request.userId!,
        title: body.data.title,
        content: body.data.content,
        tags: body.data.tags ?? null,
        status: body.data.status ?? 1,
        isResolved: body.data.isResolved ?? false,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '创建问答失败'))
    return reply.status(201).send(success({ ask: created }))
  })

  server.put('/asks/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (body.data.title !== undefined) updateData.title = body.data.title
    if (body.data.content !== undefined) updateData.content = body.data.content
    if (body.data.tags !== undefined) updateData.tags = body.data.tags
    if (body.data.status !== undefined) updateData.status = body.data.status
    if (body.data.isResolved !== undefined) updateData.isResolved = body.data.isResolved
    const [updated] = await db
      .update(asks)
      .set(updateData)
      .where(eq(asks.id, parsed.data.id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '问答不存在'))
    return reply.send(success({ ask: updated }))
  })

  server.put('/asks/:id/audit', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = auditSchema.safeParse(request.body ?? {})
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const newStatus = body.data.status ? statusStrToNum(body.data.status) : 1
    const [updated] = await db
      .update(asks)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(asks.id, parsed.data.id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '问答不存在'))
    return reply.send(success({ ask: updated }))
  })

  server.delete('/asks/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [deleted] = await db
      .delete(asks)
      .where(eq(asks.id, parsed.data.id))
      .returning({ id: asks.id })
    if (!deleted) return reply.status(404).send(error(404, '问答不存在'))
    return reply.send(success({ id: deleted.id, deleted: true }))
  })
}
