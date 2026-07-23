/**
 * 其他补充端点(5 个:/vip/benefits + /notifications/:id + /messages/:id + /categories + /analytics/track)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { success, error } from '../../utils/response.js'
import { findNotificationById } from '../../db/notification-queries.js'
import { findMessageById } from '../../db/chat-queries.js'
import { findSiteCategories } from '../../db/site-categories-queries.js'
import { createAnalyticsEvent } from '../../db/analytics-queries.js'
import { listVipLevels } from '../../db/vip-queries.js'
import { parseIdParam } from './_shared.js'

const miscRoutes: FastifyPluginAsync = async (server) => {
  server.get('/vip/benefits', async (_request, reply) => {
    const list = await listVipLevels(true)
    return reply.send(success({ list }))
  })

  server.get('/notifications/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const notification = await findNotificationById(id)
    return reply.send(success({ notification }))
  })

  server.get('/messages/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const message = await findMessageById(id)
    return reply.send(success({ message }))
  })

  server.get('/categories', async (request, reply) => {
    const type = (request.query as { type?: string } | null)?.type
    const list = await findSiteCategories({ type })
    return reply.send(success({ list }))
  })

  server.post('/analytics/track', async (request, reply) => {
    const body = (request.body as { event?: string; properties?: unknown } | null) ?? {}
    if (!body.event) return reply.status(400).send(error(400, '缺少 event'))
    await createAnalyticsEvent({
      userId: request.userId,
      event: body.event,
      properties: body.properties,
      ip: request.ip,
      userAgent: (request.headers['user-agent'] as string | undefined) ?? null,
    })
    return reply.send(success({ success: true }))
  })
}

export default miscRoutes
