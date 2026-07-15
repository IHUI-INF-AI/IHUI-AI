/**
 * /api/admin/auth-tokens 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { userSk } from '@ihui/database'
import { eq, ilike, desc, sql, or } from 'drizzle-orm'
import { paginationSchema, idParamSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const authTokensRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
server.get('/auth-tokens', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(ilike(userSk.userId, `%${search}%`), ilike(userSk.key, `%${search}%`))
      : undefined
    const list = await db
      .select()
      .from(userSk)
      .where(where)
      .orderBy(desc(userSk.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(userSk)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/auth-tokens/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db.select().from(userSk).where(eq(userSk.id, p.data.id)).limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(userSk).where(eq(userSk.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default authTokensRoutes
