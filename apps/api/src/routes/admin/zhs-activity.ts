/**
 * /api/admin/zhs-activity 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { zhsActivity } from '@ihui/database'
import { eq, ilike, desc, sql } from 'drizzle-orm'
import { paginationSchema, idParamSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const zhsActivityRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
server.get('/zhs-activity', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(zhsActivity.activityName, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(zhsActivity)
      .where(where)
      .orderBy(desc(zhsActivity.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsActivity)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/zhs-activity', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .insert(zhsActivity)
      .values({
        activityName: body.activityName ? String(body.activityName) : null,
        activityRule: body.activityRule ? String(body.activityRule) : null,
        status: Number(body.status ?? 1),
        creator: body.creator ? String(body.creator) : null,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/zhs-activity/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .update(zhsActivity)
      .set({
        ...(body.activityName !== undefined && {
          activityName: body.activityName ? String(body.activityName) : null,
        }),
        ...(body.status !== undefined && { status: Number(body.status) }),
        updatedAt: new Date(),
      })
      .where(eq(zhsActivity.id, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/zhs-activity/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsActivity).where(eq(zhsActivity.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default zhsActivityRoutes
