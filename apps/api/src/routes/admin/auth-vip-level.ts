/**
 * /api/admin/auth-vip-level 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { vipLevels } from '@ihui/database'
import { eq, ilike, asc, sql } from 'drizzle-orm'
import {
  paginationSchema,
  idParamSchema,
  createVipLevelSchema,
  updateVipLevelSchema,
} from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const authVipLevelRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.get('/auth-vip-level', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(vipLevels.levelName, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(vipLevels)
      .where(where)
      .orderBy(asc(vipLevels.sortOrder))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(vipLevels)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.get('/auth-vip-level/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db.select().from(vipLevels).where(eq(vipLevels.id, p.data.id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.post('/auth-vip-level', async (request, reply) => {
    const b = createVipLevelSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .insert(vipLevels)
      .values({
        levelName: b.data.levelName,
        levelValue: b.data.levelValue ?? 0,
        price: b.data.price ?? 0,
        durationDays: b.data.durationDays ?? 30,
        status: b.data.status ?? 1,
        sortOrder: b.data.sortOrder ?? 0,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/auth-vip-level/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateVipLevelSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(vipLevels)
      .set({
        ...(b.data.levelName !== undefined && { levelName: b.data.levelName }),
        ...(b.data.levelValue !== undefined && { levelValue: b.data.levelValue }),
        ...(b.data.price !== undefined && { price: b.data.price }),
        ...(b.data.durationDays !== undefined && { durationDays: b.data.durationDays }),
        ...(b.data.status !== undefined && { status: b.data.status }),
        ...(b.data.sortOrder !== undefined && { sortOrder: b.data.sortOrder }),
        updatedAt: new Date(),
      })
      .where(eq(vipLevels.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/auth-vip-level/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db.select().from(vipLevels).where(eq(vipLevels.id, p.data.id)).limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(vipLevels).where(eq(vipLevels.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default authVipLevelRoutes
