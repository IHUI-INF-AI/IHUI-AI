/**
 * 消息会话 + 客服发送(从 frontend-stub-other-routes.ts 拆分)。
 * POST /messages/conversations — 创建消息会话
 * POST /customer-service/send — 客服发送消息
 * 两者均调用 createMessage 落库
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { createMessage } from '../../db/notification-queries.js'

const sendMessageSchema = z.object({
  receiverId: z.string().uuid(),
  content: z.string().min(1).max(5000),
})

export const messageRoutes: FastifyPluginAsync = async (server) => {
  // POST /messages/conversations — 创建消息会话
  server.post('/messages/conversations', async (request, reply) => {
    const body = sendMessageSchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const msg = await createMessage(request.userId!, body.data.receiverId, body.data.content)
    return reply.status(201).send(success({ message: msg }))
  })

  // POST /customer-service/send — 客服发送消息
  server.post('/customer-service/send', async (request, reply) => {
    const body = sendMessageSchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const msg = await createMessage(request.userId!, body.data.receiverId, body.data.content)
    return reply.status(201).send(success({ message: msg }))
  })
}
