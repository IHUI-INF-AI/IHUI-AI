/**
 * /api/admin/carousel 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { carousels } from '@ihui/database'
import { eq, ilike, asc, sql } from 'drizzle-orm'
import { paginationSchema, idParamSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'

const createCarouselSchema = z.object({
  position: z.string().max(50).default('home'),
  imageUrl: z.string().max(512).default(''),
  title: z.string().max(200).nullable().optional(),
  linkUrl: z.string().max(512).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  sort: z.coerce.number().int().min(0).default(0),
  status: z.coerce.number().int().min(0).max(1).default(1),
})

const updateCarouselSchema = z.object({
  position: z.string().max(50).optional(),
  imageUrl: z.string().max(512).optional(),
  title: z.string().max(200).nullable().optional(),
  linkUrl: z.string().max(512).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  sort: z.coerce.number().int().min(0).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
})

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
    const parsed = createCarouselSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数校验失败'))
    }
    const [row] = await db
      .insert(carousels)
      .values({
        position: parsed.data.position,
        imageUrl: parsed.data.imageUrl,
        title: parsed.data.title ?? null,
        linkUrl: parsed.data.linkUrl ?? null,
        description: parsed.data.description ?? null,
        sort: parsed.data.sort,
        status: parsed.data.status,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/carousel/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = updateCarouselSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数校验失败'))
    }
    const [row] = await db
      .update(carousels)
      .set({
        ...(parsed.data.position !== undefined && { position: parsed.data.position }),
        ...(parsed.data.imageUrl !== undefined && { imageUrl: parsed.data.imageUrl }),
        ...(parsed.data.title !== undefined && { title: parsed.data.title ?? null }),
        ...(parsed.data.linkUrl !== undefined && { linkUrl: parsed.data.linkUrl ?? null }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description ?? null,
        }),
        ...(parsed.data.sort !== undefined && { sort: parsed.data.sort }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
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
