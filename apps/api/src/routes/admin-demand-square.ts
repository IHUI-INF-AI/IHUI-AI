import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// 需求广场管理路由 — 迁移自旧架构 api/admin/admin-demand-square.ts
// 挂载前缀：/api/admin/demand-square（由 server.ts 统一注册）
// 管理员审核/管理需求广场中的需求发布与智能体上架
// =============================================================================

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

// =============================================================================
// 鉴权辅助
// =============================================================================

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

// =============================================================================
// 数据库表初始化 & 查询辅助
// =============================================================================

const SELECT_COLS = sql`
  id, user_id AS "userId", type, title, description, status,
  reject_reason AS "rejectReason", reviewed_by AS "reviewedBy",
  reviewed_at AS "reviewedAt", created_at AS "createdAt", updated_at AS "updatedAt"
`

async function ensureDemandSquareTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zhs_demand_square (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar(64) NOT NULL,
      type varchar(20) NOT NULL,
      title varchar(255) NOT NULL,
      description text,
      status varchar(20) NOT NULL DEFAULT 'pending',
      reject_reason varchar(500),
      reviewed_by varchar(64),
      reviewed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

function buildWhereClause(status?: string, type?: string, search?: string): SQL {
  const conditions: SQL[] = []
  if (status) conditions.push(sql`status = ${status}`)
  if (type) conditions.push(sql`type = ${type}`)
  if (search) {
    const kw = `%${search}%`
    conditions.push(sql`(title ILIKE ${kw} OR description ILIKE ${kw})`)
  }
  return conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``
}

// =============================================================================
// 路由
// =============================================================================

export const adminDemandSquareRoutes: FastifyPluginAsync = async (server) => {
  await ensureDemandSquareTable()

  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return
  })

  // GET / - 需求列表（支持按状态/类型/关键词筛选）
  server.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, status, type, search } = parsed.data
    const offset = (page - 1) * pageSize
    const where = buildWhereClause(status, type, search)

    const listRows = await db.execute(sql`
      SELECT ${SELECT_COLS} FROM zhs_demand_square ${where}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `)
    const countRows = await db.execute(sql`
      SELECT count(*)::int AS count FROM zhs_demand_square ${where}
    `)
    const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
    return reply.send(
      success({ list: listRows as Record<string, unknown>[], total, page, pageSize }),
    )
  })

  // GET /stats - 审核统计（各状态数量）
  server.get('/stats', async (_request, reply) => {
    const rows = await db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'pending')::int AS pending,
        count(*) FILTER (WHERE status = 'approved')::int AS approved,
        count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
        count(*) FILTER (WHERE status = 'offline')::int AS offline,
        count(*) FILTER (WHERE status = 'featured')::int AS featured
      FROM zhs_demand_square
    `)
    const stats = (rows[0] as Record<string, number> | undefined) ?? {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      offline: 0,
      featured: 0,
    }
    return reply.send(success({ stats }))
  })

  // GET /:id - 需求详情
  server.get('/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.execute(sql`
      SELECT ${SELECT_COLS} FROM zhs_demand_square WHERE id = ${parsed.data.id}
    `)
    const item = rows[0] as Record<string, unknown> | undefined
    if (!item) return reply.status(404).send(error(404, '需求不存在'))
    return reply.send(success({ demand: item }))
  })

  // POST /:id/review - 审核单条需求（通过/拒绝）
  server.post('/:id/review', async (request, reply) => {
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = reviewSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.execute(sql`
      SELECT ${SELECT_COLS} FROM zhs_demand_square WHERE id = ${paramParsed.data.id}
    `)
    const existing = rows[0] as Record<string, unknown> | undefined
    if (!existing) return reply.status(404).send(error(404, '需求不存在'))
    if (existing.status !== 'pending') {
      return reply.status(400).send(error(400, '该需求已审核，不可重复审核'))
    }
    const now = new Date().toISOString()
    const newStatus = body.data.action === 'approve' ? 'approved' : 'rejected'
    const rejectReason = body.data.action === 'reject' ? (body.data.reason ?? null) : null
    await db.execute(sql`
      UPDATE zhs_demand_square
      SET status = ${newStatus}, reject_reason = ${rejectReason},
          reviewed_by = ${request.userId}, reviewed_at = ${now}, updated_at = ${now}
      WHERE id = ${paramParsed.data.id}
    `)
    const updated = {
      ...existing,
      status: newStatus,
      rejectReason: rejectReason ?? undefined,
      reviewedBy: request.userId,
      reviewedAt: now,
      updatedAt: now,
    }
    return reply.send(success({ demand: updated }))
  })

  // POST /batch-review - 批量审核
  server.post('/batch-review', async (request, reply) => {
    const body = batchReviewSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const now = new Date().toISOString()
    const newStatus = body.data.action === 'approve' ? 'approved' : 'rejected'
    const rejectReason = body.data.action === 'reject' ? (body.data.reason ?? null) : null
    const results: Array<{ id: string; status: string }> = []

    for (const id of body.data.ids) {
      const rows = await db.execute(sql`
        SELECT status FROM zhs_demand_square WHERE id = ${id}
      `)
      const existing = rows[0] as { status?: string } | undefined
      if (!existing || existing.status !== 'pending') {
        results.push({ id, status: 'skipped' })
        continue
      }
      await db.execute(sql`
        UPDATE zhs_demand_square
        SET status = ${newStatus}, reject_reason = ${rejectReason},
            reviewed_by = ${request.userId}, reviewed_at = ${now}, updated_at = ${now}
        WHERE id = ${id}
      `)
      results.push({ id, status: newStatus })
    }
    return reply.send(success({ results }))
  })

  // PUT /:id/status - 更新需求状态（下架/置顶等）
  server.put('/:id/status', async (request, reply) => {
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateStatusSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.execute(sql`
      SELECT ${SELECT_COLS} FROM zhs_demand_square WHERE id = ${paramParsed.data.id}
    `)
    const existing = rows[0] as Record<string, unknown> | undefined
    if (!existing) return reply.status(404).send(error(404, '需求不存在'))
    const now = new Date().toISOString()
    await db.execute(sql`
      UPDATE zhs_demand_square SET status = ${body.data.status}, updated_at = ${now}
      WHERE id = ${paramParsed.data.id}
    `)
    const updated = { ...existing, status: body.data.status, updatedAt: now }
    return reply.send(success({ demand: updated }))
  })

  // DELETE /:id - 删除需求
  server.delete('/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.execute(sql`
      SELECT id FROM zhs_demand_square WHERE id = ${parsed.data.id}
    `)
    if (!rows[0]) {
      return reply.status(404).send(error(404, '需求不存在'))
    }
    await db.execute(sql`DELETE FROM zhs_demand_square WHERE id = ${parsed.data.id}`)
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })
}
