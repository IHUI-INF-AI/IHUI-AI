import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { db } from '../db/index.js'
import {
  createConversation,
  findConversationsByUser,
  findConversationById,
  updateConversation,
  deleteConversation,
  findMessages,
  createMessage,
  findMessageById,
  deleteMessage,
  clearMessages,
  favoriteConversation,
  unfavoriteConversation,
  findFavoriteConversations,
} from '../db/chat-queries.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// Coze conversation_id 自动管理（迁移自 coze_zhs_py/api/chat.py）
// =============================================================================

const cozeStreamSchema = z.object({
  botId: z.string().min(1),
  userId: z.string().min(1),
  query: z.string().min(1),
  conversationId: z.string().optional().default(''),
})

async function getCozeConversationId(uuid: string, botId: string): Promise<string> {
  const rows = await db.execute(
    sql`SELECT conversation_id FROM coze_chat_history WHERE uuid = ${uuid} AND bot_id = ${botId} ORDER BY created_at DESC LIMIT 1`,
  )
  const row = rows[0] as { conversation_id?: string } | undefined
  return row?.conversation_id ?? ''
}

async function saveCozeConversationId(
  uuid: string,
  botId: string,
  conversationId: string,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO coze_chat_history (uuid, bot_id, conversation_id, created_at)
    VALUES (${uuid}, ${botId}, ${conversationId}, now())
    ON CONFLICT DO NOTHING
  `)
}

function extractConversationId(data: unknown): string | null {
  if (data === null || data === undefined) return null
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (typeof obj.conversation_id === 'string' && obj.conversation_id) return obj.conversation_id
    for (const value of Object.values(obj)) {
      const found = extractConversationId(value)
      if (found) return found
    }
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractConversationId(item)
      if (found) return found
    }
  }
  return null
}

// =============================================================================
// Zod schemas
// =============================================================================

const createConversationSchema = z.object({
  title: z.string().max(255).optional(),
  model: z.string().max(64).optional(),
  systemPrompt: z.string().optional(),
  metadata: z.unknown().optional(),
})

const updateConversationSchema = z.object({
  title: z.string().max(255).optional(),
  model: z.string().max(64).optional(),
  systemPrompt: z.string().optional(),
  metadata: z.unknown().optional(),
})

const createMessageSchema = z
  .object({
    content: z.string().min(1, '消息内容不能为空'),
    // 客户端只能创建 user 消息,assistant/system 由后端 Worker/AI 创建
    // 兼容旧前端:未传 role 默认 user,传 assistant/system 则忽略改为 user
    role: z.enum(['user', 'assistant', 'system']).optional(),
    tokens: z.number().int().nonnegative().optional(),
    metadata: z.unknown().optional(),
  })
  .refine(
    (data) => {
      // 强制客户端只能写 user 消息
      if (data.role && data.role !== 'user') {
        return false
      }
      return true
    },
    { message: '客户端只能创建 user 消息,assistant 消息由 AI 自动创建' },
  )

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(255).optional(),
})

const messageListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  before: z.string().uuid().optional(),
  after: z.string().uuid().optional(),
})

// =============================================================================
// 序列化辅助
// =============================================================================

function serializeConversation(c: {
  id: string
  userId: string
  title: string
  model: string
  systemPrompt: string | null
  metadata: unknown
  lastMessageAt: Date | null
  createdAt: Date
  updatedAt: Date
  messageCount?: number
  favorite?: boolean
}) {
  return {
    id: c.id,
    userId: c.userId,
    title: c.title,
    model: c.model,
    systemPrompt: c.systemPrompt,
    metadata: c.metadata,
    lastMessageAt: c.lastMessageAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    ...(c.messageCount !== undefined && { messageCount: c.messageCount }),
    ...(c.favorite !== undefined && { favorite: c.favorite }),
  }
}

function serializeMessage(m: {
  id: string
  conversationId: string
  role: string
  content: string
  tokens: number | null
  metadata: unknown
  createdAt: Date
}) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role,
    content: m.content,
    tokens: m.tokens,
    metadata: m.metadata,
    createdAt: m.createdAt,
  }
}

// =============================================================================
// 路由
// =============================================================================

export const chatRoutes: FastifyPluginAsync = async (server) => {
  const idParam = z.object({ id: z.string() })
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // 校验对话归属：存在且属于当前用户
  const ensureOwnedConversation = async (id: string, userId: string, reply: FastifyReply) => {
    const conversation = await findConversationById(id)
    if (!conversation) {
      reply.status(404).send(error(404, '对话不存在'))
      return { conversation: null as null }
    }
    if (conversation.userId !== userId) {
      reply.status(403).send(error(403, '无权访问该对话'))
      return { conversation: null as null }
    }
    return { conversation }
  }

  // POST /conversations - 创建对话
  server.post(
    '/conversations',
    {
      schema: {
        summary: '创建对话',
        description: '已登录用户创建新对话,可指定标题/模型/系统提示词/元数据',
        tags: ['chat'],
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', maxLength: 255, description: '对话标题' },
            model: { type: 'string', maxLength: 64, description: '模型标识' },
            systemPrompt: { type: 'string', description: '系统提示词' },
            metadata: {
              type: 'object',
              additionalProperties: true,
              description: '元数据(任意键值)',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const parsed = createConversationSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const conversation = await createConversation({
        userId,
        title: parsed.data.title,
        model: parsed.data.model,
        systemPrompt: parsed.data.systemPrompt,
        metadata: parsed.data.metadata,
      })

      return reply.status(201).send(success({ conversation: serializeConversation(conversation) }))
    },
  )

  // GET /conversations - 对话列表（分页 + 按 title 搜索）
  server.get(
    '/conversations',
    {
      schema: {
        summary: '对话列表',
        description: '已登录用户对话列表(分页,可按标题搜索)',
        tags: ['chat'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
            pageSize: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: '每页数量(1-100,默认 20)',
            },
            search: { type: 'string', maxLength: 255, description: '按标题搜索' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const parsed = paginationSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const { list, total } = await findConversationsByUser(userId, {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        search: parsed.data.search,
      })

      return reply.send(
        success({
          conversations: list.map(serializeConversation),
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          total,
        }),
      )
    },
  )

  // GET /conversations/:id - 对话详情
  server.get('/conversations/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const { conversation } = await ensureOwnedConversation(id, userId, reply)
    if (!conversation) return

    return reply.send(success({ conversation: serializeConversation(conversation) }))
  })

  // PATCH /conversations/:id - 更新对话
  server.patch('/conversations/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const parsed = updateConversationSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const updated = await updateConversation(id, parsed.data)
    return reply.send(success({ conversation: serializeConversation(updated) }))
  })

  // DELETE /conversations/:id - 删除对话（级联删除消息）
  server.delete('/conversations/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    await deleteConversation(id)
    return reply.send(success({ deleted: true }))
  })

  // GET /conversations/:id/messages - 消息列表（分页/游标，按时间正序）
  server.get(
    '/conversations/:id/messages',
    {
      schema: {
        summary: '消息列表',
        description: '获取指定对话的消息列表(分页/游标,按时间正序)',
        tags: ['chat'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: '对话 ID' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
            pageSize: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: '每页数量(1-100,默认 20)',
            },
            before: {
              type: 'string',
              format: 'uuid',
              description: '游标:返回该消息 ID 之前的记录',
            },
            after: { type: 'string', format: 'uuid', description: '游标:返回该消息 ID 之后的记录' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const { id } = idParam.parse(request.params)
      const owned = await ensureOwnedConversation(id, userId, reply)
      if (!owned.conversation) return

      const parsed = messageListSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const { list, total, hasMore, nextCursor } = await findMessages(id, {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        before: parsed.data.before,
        after: parsed.data.after,
      })

      return reply.send(
        success({
          messages: list.map(serializeMessage),
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          total,
          hasMore,
          nextCursor,
        }),
      )
    },
  )

  // POST /conversations/:id/messages - 发送消息（更新 last_message_at）
  server.post('/conversations/:id/messages', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const parsed = createMessageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const message = await createMessage({
      conversationId: id,
      role: parsed.data.role,
      content: parsed.data.content,
      tokens: parsed.data.tokens,
      metadata: parsed.data.metadata,
    })

    // WebSocket 实时推送：新消息即时通知客户端刷新（多端同步）
    // 通过 server.pushNotification 自动处理本机 + 多实例广播
    try {
      server.pushNotification(userId, {
        type: 'chat_message',
        conversationId: id,
        message: serializeMessage(message),
      })
    } catch {
      // 推送失败不阻塞消息创建
    }

    return reply.status(201).send(success({ message: serializeMessage(message) }))
  })

  // DELETE /messages/:id - 删除单条消息
  server.delete('/messages/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const message = await findMessageById(id)
    if (!message) {
      return reply.status(404).send(error(404, '消息不存在'))
    }

    // 校验消息所属对话属于当前用户
    const conversation = await findConversationById(message.conversationId)
    if (!conversation || conversation.userId !== userId) {
      return reply.status(403).send(error(403, '无权删除该消息'))
    }

    await deleteMessage(id)
    return reply.send(success({ deleted: true }))
  })

  // POST /conversations/:id/favorite - 收藏对话
  server.post('/conversations/:id/favorite', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const created = await favoriteConversation(userId, id)
    return reply.status(created ? 201 : 200).send(success({ favorited: true, created }))
  })

  // DELETE /conversations/:id/favorite - 取消收藏
  server.delete('/conversations/:id/favorite', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    // 取消收藏前仍校验对话归属，避免越权操作
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    await unfavoriteConversation(userId, id)
    return reply.send(success({ unfavorited: true }))
  })

  // GET /favorites - 收藏对话列表
  server.get('/favorites', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const parsed = paginationSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { list, total } = await findFavoriteConversations(userId, {
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    })

    return reply.send(
      success({
        favorites: list.map((row) => ({
          ...serializeConversation(row),
          favoriteId: row.favoriteId,
          favoriteCreatedAt: row.favoriteCreatedAt,
        })),
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total,
      }),
    )
  })

  // POST /conversations/:id/clear - 清空对话消息（保留对话）
  server.post('/conversations/:id/clear', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    await clearMessages(id)
    return reply.send(success({ cleared: true }))
  })

  // POST /coze/stream — Coze 流式聊天 + conversation_id 自动管理
  // 迁移自 coze_zhs_py/api/chat.py stream_generator
  server.post('/coze/stream', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = cozeStreamSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { botId, userId: targetUserId, query, conversationId } = parsed.data

    const cozeKey = process.env.COZE_API_KEY
    if (!cozeKey) return reply.status(503).send(error(503, 'Coze 服务未配置'))

    const existingConvId = conversationId || (await getCozeConversationId(targetUserId, botId))

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    let newConversationId: string | null = null
    try {
      const resp = await fetch('https://api.coze.cn/v1/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cozeKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bot_id: botId,
          user_id: targetUserId,
          query,
          conversation_id: existingConvId,
          stream: true,
        }),
      })
      if (!resp.ok || !resp.body) {
        reply.raw.write(`data: ${JSON.stringify({ error: `Coze API ${resp.status}` })}\n\n`)
        reply.raw.end()
        return
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const jsonStr = line.slice(5).trim()
          if (!jsonStr) continue
          try {
            const evt = JSON.parse(jsonStr) as unknown
            const extracted = extractConversationId(evt)
            if (extracted && extracted !== newConversationId) {
              newConversationId = extracted
              if (extracted !== existingConvId) {
                await saveCozeConversationId(targetUserId, botId, extracted).catch(() => {})
              }
            }
            reply.raw.write(`data: ${jsonStr}\n\n`)
          } catch {
            reply.raw.write(`data: ${jsonStr}\n\n`)
          }
        }
      }
      if (newConversationId) {
        await saveCozeConversationId(targetUserId, botId, newConversationId).catch(() => {})
      }
    } catch (e) {
      reply.raw.write(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`)
    } finally {
      reply.raw.end()
    }
  })
}
