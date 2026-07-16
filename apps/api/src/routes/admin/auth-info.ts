/**
 * /api/admin/auth-info 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { userAuthInfo } from '@ihui/database'
import { eq, ilike, desc, sql, or } from 'drizzle-orm'
import {
  paginationSchema,
  idParamSchema,
  updateAuthInfoSchema,
  createAuthInfoSchema,
} from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const authInfoRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.get('/auth-info', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(userAuthInfo.userUuid, `%${search}%`), ilike(userAuthInfo.phone, `%${search}%`))
      : undefined
    const list = await db
      .select()
      .from(userAuthInfo)
      .where(where)
      .orderBy(desc(userAuthInfo.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(userAuthInfo)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.get('/auth-info/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select()
      .from(userAuthInfo)
      .where(eq(userAuthInfo.userUuid, p.data.id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.post('/auth-info', async (request, reply) => {
    const b = createAuthInfoSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .insert(userAuthInfo)
      .values({
        userUuid: b.data.userUuid,
        phone: b.data.phone ?? null,
        realName: b.data.realName ?? null,
        idCard: b.data.idCard ?? null,
        authStatus: b.data.authStatus ?? 'unverified',
        authSource: b.data.authSource ?? null,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/auth-info/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateAuthInfoSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(userAuthInfo)
      .set({
        ...(b.data.phone !== undefined && { phone: b.data.phone }),
        ...(b.data.authStatus !== undefined && { authStatus: b.data.authStatus }),
        ...(b.data.realName !== undefined && { realName: b.data.realName }),
        updatedAt: new Date(),
      })
      .where(eq(userAuthInfo.userUuid, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/auth-info/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db
      .select()
      .from(userAuthInfo)
      .where(eq(userAuthInfo.userUuid, p.data.id))
      .limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(userAuthInfo).where(eq(userAuthInfo.userUuid, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default authInfoRoutes
