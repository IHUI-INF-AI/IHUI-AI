/**
 * /api/admin/user-roles 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { userRoles } from '@ihui/database'
import { eq, ilike, desc, sql, or } from 'drizzle-orm'
import {
  paginationSchema,
  idParamSchema,
  createUserRoleSchema,
  updateUserRoleSchema,
} from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const userRolesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.get('/user-roles', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(userRoles.userId, `%${search}%`), ilike(userRoles.roleId, `%${search}%`))
      : undefined
    const list = await db
      .select()
      .from(userRoles)
      .where(where)
      .orderBy(desc(userRoles.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(userRoles)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.get('/user-roles/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db.select().from(userRoles).where(eq(userRoles.id, p.data.id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.post('/user-roles', async (request, reply) => {
    const b = createUserRoleSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .insert(userRoles)
      .values({
        userId: b.data.userId,
        roleId: b.data.roleId,
        scopeResourceId: b.data.scopeResourceId ?? null,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/user-roles/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateUserRoleSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(userRoles)
      .set({
        ...(b.data.userId !== undefined && { userId: b.data.userId }),
        ...(b.data.roleId !== undefined && { roleId: b.data.roleId }),
        ...(b.data.scopeResourceId !== undefined && { scopeResourceId: b.data.scopeResourceId }),
      })
      .where(eq(userRoles.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/user-roles/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db.select().from(userRoles).where(eq(userRoles.id, p.data.id)).limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(userRoles).where(eq(userRoles.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default userRolesRoutes
