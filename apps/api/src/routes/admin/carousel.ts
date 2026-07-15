/**
 * /api/admin/carousel 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { carousels } from '@ihui/database'
import { eq, ilike, asc, sql } from 'drizzle-orm'
import { paginationSchema, idParamSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const carouselRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
server.get('/carousel', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(carousels.title, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(carousels)
      .where(where)
      .orderBy(asc(carousels.sort))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(carousels)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/carousel', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .insert(carousels)
      .values({
        position: String(body.position ?? 'home'),
        imageUrl: String(body.imageUrl ?? ''),
        title: body.title ? String(body.title) : null,
        linkUrl: body.linkUrl ? String(body.linkUrl) : null,
        description: body.description ? String(body.description) : null,
        sort: Number(body.sort ?? 0),
        status: Number(body.status ?? 1),
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/carousel/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .update(carousels)
      .set({
        ...(body.position !== undefined && { position: String(body.position) }),
        ...(body.imageUrl !== undefined && { imageUrl: String(body.imageUrl) }),
        ...(body.title !== undefined && { title: body.title ? String(body.title) : null }),
        ...(body.linkUrl !== undefined && { linkUrl: body.linkUrl ? String(body.linkUrl) : null }),
        ...(body.description !== undefined && {
          description: body.description ? String(body.description) : null,
        }),
        ...(body.sort !== undefined && { sort: Number(body.sort) }),
        ...(body.status !== undefined && { status: Number(body.status) }),
        updatedAt: new Date(),
      })
      .where(eq(carousels.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/carousel/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(carousels).where(eq(carousels.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default carouselRoutes
