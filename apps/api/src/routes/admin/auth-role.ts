/**
 * /api/admin/auth-role 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { roles } from '@ihui/database'
import { eq, ilike, desc, sql, or } from 'drizzle-orm'
import { paginationSchema, idParamSchema, createRoleSchema, updateRoleSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const authRoleRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.get('/auth-role', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(roles.name, `%${search}%`), ilike(roles.displayName, `%${search}%`))
      : undefined
    const list = await db
      .select()
      .from(roles)
      .where(where)
      .orderBy(desc(roles.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(roles)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.get('/auth-role/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db.select().from(roles).where(eq(roles.id, p.data.id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.post('/auth-role', async (request, reply) => {
    const b = createRoleSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .insert(roles)
      .values({
        name: b.data.name,
        displayName: b.data.displayName,
        description: b.data.description ?? null,
        scope: b.data.scope ?? 'self',
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/auth-role/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateRoleSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(roles)
      .set({
        ...(b.data.name !== undefined && { name: b.data.name }),
        ...(b.data.displayName !== undefined && { displayName: b.data.displayName }),
        ...(b.data.description !== undefined && { description: b.data.description }),
        ...(b.data.scope !== undefined && { scope: b.data.scope }),
        updatedAt: new Date(),
      })
      .where(eq(roles.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/auth-role/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db.select().from(roles).where(eq(roles.id, p.data.id)).limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(roles).where(eq(roles.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default authRoleRoutes
