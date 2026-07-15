/**
 * /api/admin/comment-logs 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { zhsUserCommentLog } from '@ihui/database'
import { eq, ilike, desc, sql, and, type SQL } from 'drizzle-orm'
import { commentLogQuerySchema, idParamSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const commentLogsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
server.get('/comment-logs', async (request, reply) => {
    const q = commentLogQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, userUuid, commentId, createdAt } = q.data
    const conditions: SQL[] = []
    if (userUuid) conditions.push(ilike(zhsUserCommentLog.userUuid, `%${userUuid}%`))
    if (commentId !== undefined) conditions.push(eq(zhsUserCommentLog.commentId, commentId))
    if (createdAt) {
      const dayStart = new Date(createdAt)
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      conditions.push(sql`${zhsUserCommentLog.createdAt} >= ${dayStart.toISOString()}::timestamp`)
      conditions.push(sql`${zhsUserCommentLog.createdAt} < ${dayEnd.toISOString()}::timestamp`)
    }
    const where = conditions.length ? and(...conditions) : undefined
    const list = await db
      .select()
      .from(zhsUserCommentLog)
      .where(where)
      .orderBy(desc(zhsUserCommentLog.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsUserCommentLog)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/comment-logs/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsUserCommentLog).where(eq(zhsUserCommentLog.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default commentLogsRoutes
