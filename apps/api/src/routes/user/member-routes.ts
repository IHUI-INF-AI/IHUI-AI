/**
 * Member/Coze 模块(2 个端点:/members/me + /coze/chat/history)。
 * 注:POST /api/sign-in 已在 gamification.ts 中注册,POST /api/coupons/verify 已在 promotions.ts 中注册。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { findMyMember } from '../../db/my-member-queries.js'
import { findCozeChatHistory } from '../../db/coze-chat-queries.js'
import { parsePagination } from './_shared.js'

const botConversationParam = z.object({ botId: z.string(), conversationId: z.string() })

const memberRoutes: FastifyPluginAsync = async (server) => {
  server.get('/members/me', async (request, reply) => {
    const member = await findMyMember(request.userId!)
    return reply.send(success({ member }))
  })

  server.get('/coze/chat/history/:botId/:conversationId', async (request, reply) => {
    const { botId, conversationId } = botConversationParam.parse(request.params)
    if (!botId || !conversationId) return reply.status(400).send(error(400, '参数错误'))
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findCozeChatHistory(botId, conversationId, q.page, q.pageSize)
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })
}

export default memberRoutes
