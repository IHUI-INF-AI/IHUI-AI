import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, or, ilike, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { zhsDemandSquare } from '@ihui/database'

const ADMIN_ROLE_ID = 1

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  type: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
})

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'offline', 'featured']),
})

const batchReviewSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
})

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
  const roleId = request.jwtPayload?.roleId ?? 0
  if (roleId < ADMIN_ROLE_ID) {
    reply.status(403).send(error(403, '需要管理员权限'))
    return false
  }
  return true
}

function buildWhere(status?: string, type?: string, search?: string) {
  const conditions = []
  if (status) conditions.push(eq(zhsDemandSquare.status, status))
  if (type) conditions.push(eq(zhsDemandSquare.type, type))
  if (search) {
    const kw = `%${search}%`
    conditions.push(or(ilike(zhsDemandSquare.title, kw), ilike(zhsDemandSquare.description, kw)))
  }
  return conditions.length > 0 ? and(...conditions) : undefined
}

export const adminDemandSquareRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return
  })

  server.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, status, type, search } = parsed.data
    const offset = (page - 1) * pageSize
    const where = buildWhere(status, type, search)

    const list = await db
      .select()
      .from(zhsDemandSquare)
      .where(where)
      .orderBy(desc(zhsDemandSquare.createdAt))
      .limit(pageSize)
      .offset(offset)
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(zhsDemandSquare)
      .where(where)
    const total = countRows[0]?.count ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })

  server.get('/stats', async (_request, reply) => {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where status = 'pending')::int`,
        approved: sql<number>`count(*) filter (where status = 'approved')::int`,
        rejected: sql<number>`count(*) filter (where status = 'rejected')::int`,
        offline: sql<number>`count(*) filter (where status = 'offline')::int`,
        featured: sql<number>`count(*) filter (where status = 'featured')::int`,
      })
      .from(zhsDemandSquare)
    return reply.send(
      success({
        stats: stats ?? { total: 0, pending: 0, approved: 0, rejected: 0, offline: 0, featured: 0 },
      }),
    )
  })

  server.get('/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [item] = await db
      .select()
      .from(zhsDemandSquare)
      .where(eq(zhsDemandSquare.id, parsed.data.id))
      .limit(1)
    if (!item) return reply.status(404).send(error(404, '需求不存在'))
    return reply.send(success({ demand: item }))
  })

  server.post('/:id/review', async (request, reply) => {
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = reviewSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select()
      .from(zhsDemandSquare)
      .where(eq(zhsDemandSquare.id, paramParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '需求不存在'))
    if (existing.status !== 'pending') {
      return reply.status(400).send(error(400, '该需求已审核，不可重复审核'))
    }
    const now = new Date()
    const newStatus = body.data.action === 'approve' ? 'approved' : 'rejected'
    const rejectReason = body.data.action === 'reject' ? (body.data.reason ?? null) : null
    const [updated] = await db
      .update(zhsDemandSquare)
      .set({
        status: newStatus,
        rejectReason,
        reviewedBy: request.userId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(zhsDemandSquare.id, paramParsed.data.id))
      .returning()
    return reply.send(success({ demand: updated }))
  })

  server.post('/batch-review', async (request, reply) => {
    const body = batchReviewSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const now = new Date()
    const newStatus = body.data.action === 'approve' ? 'approved' : 'rejected'
    const rejectReason = body.data.action === 'reject' ? (body.data.reason ?? null) : null
    const results: Array<{ id: string; status: string }> = []

    for (const id of body.data.ids) {
      const [existing] = await db
        .select({ status: zhsDemandSquare.status })
        .from(zhsDemandSquare)
        .where(eq(zhsDemandSquare.id, id))
        .limit(1)
      if (!existing || existing.status !== 'pending') {
        results.push({ id, status: 'skipped' })
        continue
      }
      await db
        .update(zhsDemandSquare)
        .set({
          status: newStatus,
          rejectReason,
          reviewedBy: request.userId,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(zhsDemandSquare.id, id))
      results.push({ id, status: newStatus })
    }
    return reply.send(success({ results }))
  })

  server.put('/:id/status', async (request, reply) => {
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateStatusSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [updated] = await db
      .update(zhsDemandSquare)
      .set({ status: body.data.status, updatedAt: new Date() })
      .where(eq(zhsDemandSquare.id, paramParsed.data.id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '需求不存在'))
    return reply.send(success({ demand: updated }))
  })

  server.delete('/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select({ id: zhsDemandSquare.id })
      .from(zhsDemandSquare)
      .where(eq(zhsDemandSquare.id, parsed.data.id))
      .limit(1)
    if (!existing) {
      return reply.status(404).send(error(404, '需求不存在'))
    }
    await db.delete(zhsDemandSquare).where(eq(zhsDemandSquare.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })
}
