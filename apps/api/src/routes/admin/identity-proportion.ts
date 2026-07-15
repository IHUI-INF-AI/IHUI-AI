/**
 * /api/admin/identity-proportion 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { identityProportions } from '@ihui/database'
import { eq, desc, sql } from 'drizzle-orm'
import { paginationSchema, idParamSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const identityProportionRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
server.get('/identity-proportion', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize } = q.data
    const list = await db
      .select()
      .from(identityProportions)
      .orderBy(desc(identityProportions.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (await db.select({ c: sql<number>`count(*)::int` }).from(identityProportions))[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/identity-proportion', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .insert(identityProportions)
      .values({
        status: Number(body.status ?? 0),
        gift: Number(body.gift ?? 0),
        tokenProportion: Number(body.tokenProportion ?? 0),
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/identity-proportion/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .update(identityProportions)
      .set({
        ...(body.status !== undefined && { status: Number(body.status) }),
        ...(body.gift !== undefined && { gift: Number(body.gift) }),
        updatedAt: new Date(),
      })
      .where(eq(identityProportions.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/identity-proportion/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(identityProportions).where(eq(identityProportions.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default identityProportionRoutes
