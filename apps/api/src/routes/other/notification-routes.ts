/**
 * 通知(从 frontend-stub-other-routes.ts 拆分)。
 * GET /notification/send — 通知发送记录
 * POST /notifications/:id/read — 标记单条已读
 * POST /notifications/badge/read-all — 标记全部已读
 */
import type { FastifyPluginAsync } from 'fastify'
import { eq, and, desc } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { notifications } from '@ihui/database'
import { parseIdParam } from './_shared.js'

export const notificationRoutes: FastifyPluginAsync = async (server) => {
  // GET /notification/send — 通知发送记录(返回当前用户最近通知)
  server.get('/notification/send', async (request, reply) => {
    const list = await dbRead
      .select()
      .from(notifications)
      .where(eq(notifications.userId, request.userId!))
      .orderBy(desc(notifications.createdAt))
      .limit(20)
    return reply.send(success({ list, total: list.length }))
  })

  // POST /notifications/:id/read — 标记单条通知已读
  server.post('/notifications/:id/read', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, request.userId!)))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '通知不存在'))
    return reply.status(201).send(success({ read: true }))
  })

  // POST /notifications/badge/read-all — 标记全部已读
  server.post('/notifications/badge/read-all', async (request, reply) => {
    const rows = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, request.userId!), eq(notifications.isRead, false)))
      .returning({ id: notifications.id })
    return reply.status(201).send(success({ readCount: rows.length }))
  })
}
