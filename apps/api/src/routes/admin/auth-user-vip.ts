/**
 * /api/admin/auth-user-vip 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { userVips } from '@ihui/database'
import { eq, ilike, desc, sql } from 'drizzle-orm'
import {
  paginationSchema,
  idParamSchema,
  createUserVipSchema,
  updateUserVipSchema,
} from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const authUserVipRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.get('/auth-user-vip', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(userVips.userId, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(userVips)
      .where(where)
      .orderBy(desc(userVips.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(userVips)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.get('/auth-user-vip/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db.select().from(userVips).where(eq(userVips.id, p.data.id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.post('/auth-user-vip', async (request, reply) => {
    const b = createUserVipSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const now = new Date()
    const [row] = await db
      .insert(userVips)
      .values({
        userId: b.data.userId,
        vipLevelId: b.data.vipLevelId ?? null,
        levelValue: b.data.levelValue ?? 0,
        startTime: b.data.startTime ? new Date(b.data.startTime) : now,
        endTime: b.data.endTime
          ? new Date(b.data.endTime)
          : new Date(now.getTime() + 30 * 24 * 3600 * 1000),
        status: b.data.status ?? 1,
        autoRenew: b.data.autoRenew ?? 0,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/auth-user-vip/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateUserVipSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(userVips)
      .set({
        ...(b.data.vipLevelId !== undefined && { vipLevelId: b.data.vipLevelId }),
        ...(b.data.levelValue !== undefined && { levelValue: b.data.levelValue }),
        ...(b.data.startTime && { startTime: new Date(b.data.startTime) }),
        ...(b.data.endTime && { endTime: new Date(b.data.endTime) }),
        ...(b.data.status !== undefined && { status: b.data.status }),
        ...(b.data.autoRenew !== undefined && { autoRenew: b.data.autoRenew }),
        updatedAt: new Date(),
      })
      .where(eq(userVips.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/auth-user-vip/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db.select().from(userVips).where(eq(userVips.id, p.data.id)).limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(userVips).where(eq(userVips.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default authUserVipRoutes
