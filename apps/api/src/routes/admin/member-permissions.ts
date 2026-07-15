/**
 * /api/admin/member/permissions 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { permissions } from '@ihui/database'
import { eq, ilike, desc, sql, or } from 'drizzle-orm'
import { paginationSchema, idParamSchema, createPermissionSchema, updatePermissionSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const memberPermissionsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
server.get('/member/permissions', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(permissions.name, `%${search}%`), ilike(permissions.displayName, `%${search}%`))
      : undefined
    const list = await db
      .select()
      .from(permissions)
      .where(where)
      .orderBy(desc(permissions.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(permissions)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/member/permissions', async (request, reply) => {
    const b = createPermissionSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .insert(permissions)
      .values({
        name: b.data.name,
        displayName: b.data.displayName,
        resource: b.data.resource,
        action: b.data.action,
        description: b.data.description ?? null,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/member/permissions/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updatePermissionSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(permissions)
      .set({
        ...(b.data.name !== undefined && { name: b.data.name }),
        ...(b.data.displayName !== undefined && { displayName: b.data.displayName }),
        ...(b.data.resource !== undefined && { resource: b.data.resource }),
        ...(b.data.action !== undefined && { action: b.data.action }),
        ...(b.data.description !== undefined && { description: b.data.description }),
      })
      .where(eq(permissions.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/member/permissions/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db
      .select()
      .from(permissions)
      .where(eq(permissions.id, p.data.id))
      .limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(permissions).where(eq(permissions.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default memberPermissionsRoutes
