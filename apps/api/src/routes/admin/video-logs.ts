/**
 * /api/admin/video-logs 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { zhsUserVideoLog } from '@ihui/database'
import { eq, ilike, desc, sql, and, type SQL } from 'drizzle-orm'
import { videoLogQuerySchema, idParamSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const videoLogsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
server.get('/video-logs', async (request, reply) => {
    const q = videoLogQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, userUuid, videoId, createdAt } = q.data
    const conditions: SQL[] = []
    if (userUuid) conditions.push(ilike(zhsUserVideoLog.userUuid, `%${userUuid}%`))
    if (videoId !== undefined) conditions.push(eq(zhsUserVideoLog.videoId, videoId))
    if (createdAt) {
      const dayStart = new Date(createdAt)
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      conditions.push(sql`${zhsUserVideoLog.createdAt} >= ${dayStart.toISOString()}::timestamp`)
      conditions.push(sql`${zhsUserVideoLog.createdAt} < ${dayEnd.toISOString()}::timestamp`)
    }
    const where = conditions.length ? and(...conditions) : undefined
    const list = await db
      .select()
      .from(zhsUserVideoLog)
      .where(where)
      .orderBy(desc(zhsUserVideoLog.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsUserVideoLog)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/video-logs/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsUserVideoLog).where(eq(zhsUserVideoLog.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default videoLogsRoutes
