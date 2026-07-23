/**
 * 客服工单路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/customer-service
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { createComment, findTicketById } from '../../db/customer-service-queries.js'

const adminSendCommentSchema = z.object({
  ticketId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  attachments: z.array(z.unknown()).max(20).optional(),
})

export const customerServiceRoutes: FastifyPluginAsync = async (server) => {
  server.post(
    '/admin/customer-service/send',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = parseOrThrow(adminSendCommentSchema, request.body)
      const ticket = await findTicketById(body.ticketId)
      if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
      const comment = await createComment({
        ticketId: body.ticketId,
        userId: request.userId!,
        content: body.content,
        isAdmin: true,
        attachments: body.attachments ?? [],
      })
      return reply.status(201).send(success({ created: true, id: comment.id }))
    },
  )
}
