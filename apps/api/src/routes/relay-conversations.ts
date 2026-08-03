/**
 * /api/developer/conversations 中转站用户对话会话历史(2026-08-01 立,B 端协作场景)。
 *
 * 端点清单:
 * 1. GET   /developer/conversations               — 列出当前用户的会话(分页 + apiKeyId 筛选)
 * 2. GET   /developer/conversations/:id/messages   — 获取会话消息列表(分页,:id = conversation_id)
 * 3. PATCH /developer/conversations/:id            — 更新会话标题
 * 4. DELETE /developer/conversations/:id           — 删除会话(CASCADE 删消息)
 *
 * 全部 requireAuth,校验 userId 归属。:id 参数为 conversation_id(用户可见字符串),非 UUID 主键。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { requireAuth } from '../plugins/require-permission.js'
import {
  listConversations,
  getConversationMessages,
  deleteConversation,
  updateConversationTitle,
} from '../services/relay-conversation-service.js'

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  /** 按 API Key 筛选 */
  apiKeyId: z.preprocess(emptyToUndefined, z.uuid().optional()),
})

const messagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

/** :id 参数 = conversation_id(用户可见字符串,非 UUID) */
const conversationIdParamSchema = z.object({
  id: z.string().min(1).max(100),
})

const updateTitleBodySchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
})

const relayConversationsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAuth)

  // ===== 1. GET /developer/conversations — 会话列表 =====
  server.get('/developer/conversations', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize, apiKeyId } = q.data

    try {
      const result = await listConversations(userId, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        apiKeyId,
      })
      return reply.send(
        success({
          items: result.items,
          total: result.total,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询会话列表失败'))
    }
  })

  // ===== 2. GET /developer/conversations/:id/messages — 消息列表 =====
  server.get('/developer/conversations/:id/messages', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const p = conversationIdParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const q = messagesQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))

    try {
      const result = await getConversationMessages(p.data.id, userId, {
        limit: q.data.pageSize,
        offset: (q.data.page - 1) * q.data.pageSize,
      })
      return reply.send(
        success({
          items: result.items,
          total: result.total,
          page: q.data.page,
          pageSize: q.data.pageSize,
        }),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : '查询消息失败'
      const status = msg.includes('无权') || msg.includes('不存在') ? 404 : 500
      request.log.error(e)
      return reply.status(status).send(error(status, msg))
    }
  })

  // ===== 3. PATCH /developer/conversations/:id — 更新标题 =====
  server.patch('/developer/conversations/:id', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const p = conversationIdParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateTitleBodySchema.safeParse(request.body)
    if (!b.success)
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'))

    try {
      await updateConversationTitle(p.data.id, userId, b.data.title)
      return reply.send(success({ id: p.data.id, title: b.data.title }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : '更新标题失败'
      const status = msg.includes('无权') || msg.includes('不存在') ? 404 : 500
      request.log.error(e)
      return reply.status(status).send(error(status, msg))
    }
  })

  // ===== 4. DELETE /developer/conversations/:id — 删除会话 =====
  server.delete('/developer/conversations/:id', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const p = conversationIdParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))

    try {
      await deleteConversation(p.data.id, userId)
      return reply.send(success({ id: p.data.id, deleted: true }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : '删除会话失败'
      const status = msg.includes('无权') || msg.includes('不存在') ? 404 : 500
      request.log.error(e)
      return reply.status(status).send(error(status, msg))
    }
  })
}

export default relayConversationsRoutes
