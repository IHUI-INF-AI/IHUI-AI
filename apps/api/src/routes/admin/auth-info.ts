/**
 * /api/admin/auth-info 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { userAuthInfo } from '@ihui/database'
import { eq, ilike, desc, sql, or } from 'drizzle-orm'
import { paginationSchema, idParamSchema, updateAuthInfoSchema } from './_shared.js'

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
}

export default authInfoRoutes
