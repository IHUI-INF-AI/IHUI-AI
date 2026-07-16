import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { createExamine, approveExamine, rejectExamine } from '../db/agents-queries.js'

const menuSchema = z.object({
  name: z.string().min(1, '菜单名称不能为空').max(64),
  icon: z.string().max(128).optional(),
  path: z.string().max(256).optional(),
  sort: z.number().int().default(0),
  parentId: z.string().uuid().optional().nullable(),
  visible: z.boolean().default(true),
})

const demandAuditSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  auditComment: z.string().max(500).optional(),
})

export const adminExtendedRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  const idParam = z.object({ id: z.string() })
  const demandAuditListQuery = z.object({
    status: z.string().optional(),
    page: z.coerce.number().optional().default(1),
    pageSize: z.coerce.number().optional().default(20),
  })
  const onlineUsersQuery = z.object({
    keyword: z.string().optional(),
    page: z.coerce.number().optional().default(1),
    pageSize: z.coerce.number().optional().default(20),
  })

  // ===========================================================================
  // 菜单管理 — /admin/menu
  // ===========================================================================
  server.get('/menu', async (_request, reply) => {
    const rows = await db.execute(sql`
      SELECT id, name, icon, path, sort, parent_id, visible, created_at, updated_at
      FROM admin_menus ORDER BY sort ASC, created_at ASC
    `)
    return reply.send(success((rows as Record<string, unknown>[]) ?? []))
  })

  server.post('/menu', async (request, reply) => {
    const parsed = menuSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { name, icon, path, sort, parentId, visible } = parsed.data
    const [row] = await db.execute(sql`
      INSERT INTO admin_menus (name, icon, path, sort, parent_id, visible, created_at, updated_at)
      VALUES (${name}, ${icon ?? null}, ${path ?? null}, ${sort}, ${parentId ?? null}, ${visible}, NOW(), NOW())
      RETURNING id, name, icon, path, sort, parent_id, visible, created_at
    `)
    return reply.send(success(row ?? {}))
  })

  server.put('/menu/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const parsed = menuSchema.partial().safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { name, icon, path, sort, parentId, visible } = parsed.data
    const [row] = await db.execute(sql`
      UPDATE admin_menus SET
        name = COALESCE(${name ?? null}, name),
        icon = COALESCE(${icon ?? null}, icon),
        path = COALESCE(${path ?? null}, path),
        sort = COALESCE(${sort ?? null}, sort),
        parent_id = COALESCE(${parentId ?? null}, parent_id),
        visible = COALESCE(${visible ?? null}, visible),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, icon, path, sort, parent_id, visible, updated_at
    `)
    if (!row) return reply.status(404).send(error(404, '菜单不存在'))
    return reply.send(success(row))
  })

  server.delete('/menu/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    await db.execute(sql`DELETE FROM admin_menus WHERE id = ${id}`)
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 需求审核 — /admin/demand-audit
  // ===========================================================================
  server.get('/demand-audit', async (request, reply) => {
    const query = demandAuditListQuery.parse(request.query)
    const page = query.page
    const pageSize = query.pageSize
    const offset = (page - 1) * pageSize
    const statusFilter = query.status ? sql`WHERE status = ${query.status}` : sql``
    const rows = await db.execute(sql`
      SELECT id, title, description, submitter_id, submitter_name, status, audit_comment,
             submitted_at, audited_at, created_at
      FROM demand_audits ${statusFilter}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `)
    const countResult = await db.execute(
      sql`SELECT COUNT(*) as total FROM demand_audits ${statusFilter}`,
    )
    const total = ((countResult as Record<string, unknown>[])?.[0]?.total as number) ?? 0
    return reply.send(
      success({ list: (rows as Record<string, unknown>[]) ?? [], total, page, pageSize }),
    )
  })

  server.get('/demand-audit/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const [row] = await db.execute(sql`
      SELECT id, title, description, submitter_id, submitter_name, status, audit_comment,
             submitted_at, audited_at, created_at
      FROM demand_audits WHERE id = ${id}
    `)
    if (!row) return reply.status(404).send(error(404, '需求不存在'))
    return reply.send(success(row))
  })

  server.put('/demand-audit/:id/audit', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const parsed = demandAuditSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { status, auditComment } = parsed.data
    const [row] = await db.execute(sql`
      UPDATE demand_audits SET
        status = ${status},
        audit_comment = ${auditComment ?? null},
        audited_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, title, status, audit_comment, audited_at
    `)
    if (!row) return reply.status(404).send(error(404, '需求不存在'))
    return reply.send(success(row))
  })

  // ===========================================================================
  // 在线用户 — /admin/online-users
  // ===========================================================================
  server.get('/online-users', async (request, reply) => {
    const query = onlineUsersQuery.parse(request.query)
    const page = query.page
    const pageSize = query.pageSize
    const offset = (page - 1) * pageSize
    const keywordFilter = query.keyword
      ? sql`WHERE (username ILIKE ${'%' + query.keyword + '%'} OR ip_address ILIKE ${'%' + query.keyword + '%'})`
      : sql``
    const rows = await db.execute(sql`
      SELECT id, username, ip_address, login_at, last_active_at, device_info, location, status
      FROM online_users ${keywordFilter}
      ORDER BY last_active_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `)
    const countResult = await db.execute(
      sql`SELECT COUNT(*) as total FROM online_users ${keywordFilter}`,
    )
    const total = ((countResult as Record<string, unknown>[])?.[0]?.total as number) ?? 0
    return reply.send(
      success({ list: (rows as Record<string, unknown>[]) ?? [], total, page, pageSize }),
    )
  })

  server.post('/online-users/:id/force-logout', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const [row] = await db.execute(sql`
      UPDATE online_users SET status = 'force_offline', updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, username, status
    `)
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(success({ ...row, message: '已强制下线' }))
  })

  // ===========================================================================
  // Agent 审核别名 — /admin/examine/*（兼容前端旧路径）
  // ===========================================================================
  server.post('/examine', async (request, reply) => {
    const body = z
      .object({
        agentId: z.string().optional(),
        reason: z.string().nullable().optional(),
        status: z.string().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    if (!body.data.agentId) {
      return reply.status(400).send(error(400, 'agentId 为必填项'))
    }
    const record = await createExamine({
      agentId: body.data.agentId,
      userId: request.userId,
      status: body.data.status ?? 'pending',
      reason: body.data.reason,
    })
    return reply.send(success(record))
  })

  server.post('/examine/pass', async (request, reply) => {
    const body = z.object({ recordId: z.string() }).safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const record = await approveExamine(body.data.recordId, request.userId!)
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success(record))
  })

  server.post('/examine/reject', async (request, reply) => {
    const body = z
      .object({ recordId: z.string(), reason: z.string().optional() })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    if (!body.data.reason) {
      return reply.status(400).send(error(400, 'reason 为必填项'))
    }
    const record = await rejectExamine(body.data.recordId, request.userId!, body.data.reason)
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success(record))
  })
}
