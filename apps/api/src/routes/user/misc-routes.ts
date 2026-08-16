/**
 * 其他补充端点(5 个:/vip/benefits + /notifications/:id + /messages/:id + /categories + /analytics/track)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { success } from '../../utils/response.js'
import { findNotificationById } from '../../db/notification-queries.js'
import { findMessageById } from '../../db/chat-queries.js'
import { findSiteCategories } from '../../db/site-categories-queries.js'
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

  // 2026-08-10:原 /analytics/track 已迁移至 routes/analytics.ts(公开匿名上报,
  // 兼容批量/单事件)。本文件保留其他端点,不再定义 track 避免重复。
}

export default miscRoutes
