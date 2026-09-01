// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import {
  compressContextIfNeeded,
  estimateMessagesTokens,
  type ChatMessage,
} from '@ihui/context-compaction'
import { authenticate } from '../plugins/auth.js'
import { db } from '../db/index.js'
import {
  createConversation,
  findConversationsByUser,
  findConversationById,
  updateConversation,
  deleteConversation,
  deleteConversationsBatch,
  favoriteConversationsBatch,
  unfavoriteConversationsBatch,
  setConversationsArchivedBatch,
  findMessages,
  createMessage,
  findMessageById,
  deleteMessage,
  clearMessages,
  favoriteConversation,
  unfavoriteConversation,
  findFavoriteConversations,
  archiveConversation,
  unarchiveConversation,
  findMessagesForExport,
  findMessagesForShare,
  saveCompressedContext,
  setConversationShareToken,
  findConversationByShareToken,
  regenerateConversationMessages,
  branchConversationFrom,
  replaceMessages,
} from '../db/chat-queries.js'
import { success, error } from '../utils/response.js'
import { generateSemanticSummary, getCachedSemanticSummary } from '../utils/semantic-summary.js'
import {
  listMessageArchives,
  findMessageArchive,
  persistMessageArchive,
} from '../utils/conversation-archive.js'
import { config } from '../config/index.js'

// =============================================================================
// Coze conversation_id 自动管理（迁移自 coze_zhs_py/api/chat.py）
// =============================================================================

const cozeStreamSchema = z.object({
  botId: z.string().min(1),
  userId: z.string().min(1),
  query: z.string().min(1),
  conversationId: z.string().optional().default(''),
})
import { buildResponseSchema, paginationQuerySchema } from '../utils/api-schemas.js'

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
  pinned: z.boolean().optional(),
})

const createMessageSchema = z
  .object({
    content: z.string().min(1, '消息内容不能为空'),
    // role 白名单:user(用户输入)/ assistant(斜杠命令 skill 结果等本地生成的 AI 文本)。
    // 主 chat 流的 assistant 消息由 ai-callback worker 权威持久化(带扣费/幂等),
    // 前端只在无 LLM 流的 skill 场景(如 /wechat-article)直接写 assistant,需登录 + 会话归属校验。
    // system 仍被拒绝:允许客户端持久化 system 消息等于开放历史上下文注入通道(见下方 refine)。
    role: z.enum(['user', 'assistant', 'system']).optional(),
    tokens: z.number().int().nonnegative().optional(),
    metadata: z.unknown().optional(),
    reasoning: z.string().optional(),
  })
  .refine(
    (data) => {
      // 强制拒绝 system:system 消息会进入后续 LLM 上下文(repairMessages 历史),
      // 客户端可持久化 system 即可实施 prompt 注入,必须服务端独占。
      if (data.role === 'system') {
        return false
      }
      return true
    },
    { message: '客户端不能创建 system 消息' },
  )

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(255).optional(),
})

const messageListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  before: z.uuid().optional(),
  after: z.uuid().optional(),
})

// POST /compact 请求体(2026-09-02 立):最简契约,仅 conversationId,无 messageRange 等可选参数
const compactSchema = z.object({
  conversationId: z.string().min(1),
})

const COMPRESS_TARGETS = (() => {
  const raw = process.env.COMPRESS_TARGET_CHARS
  if (!raw) return [200000, 1000000]
  const parsed = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
  return parsed.length > 0 ? parsed : [200000, 1000000]
})()

const compressSchema = z.object({
  targetChars: z
    .number()
    .int()
    .positive()
    .refine((n) => COMPRESS_TARGETS.includes(n), {
      message: `targetChars 必须是以下值之一: ${COMPRESS_TARGETS.join(', ')}`,
    }),
})

// 重新生成(2026-08-30 立):指定要重新生成的 AI 消息 id
const regenerateSchema = z.object({
  messageId: z.uuid('messageId 必须是有效的 UUID'),
})

// 分支(2026-08-30 立):指定从哪条消息开始分叉,可选覆盖新会话标题/模型
const branchSchema = z.object({
  messageId: z.uuid('messageId 必须是有效的 UUID'),
  title: z.string().max(255).optional(),
  model: z.string().max(64).optional(),
})

// 批量操作 schema(2026-07-31 立,对话历史批量删除/收藏/归档)
const batchActionSchema = z.object({
  action: z.enum(['delete', 'favorite', 'unfavorite', 'archive', 'unarchive']),
  ids: z.array(z.uuid()).min(1, '至少选择一个对话').max(100, '单次最多 100 个对话'),
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
  archivedAt: Date | null
  compressedAt: Date | null
  compressedContext: string | null
  pinned?: boolean
  pinnedAt?: Date | null
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
    archivedAt: c.archivedAt,
    compressedAt: c.compressedAt,
    compressedContext: c.compressedContext,
    ...(c.pinned !== undefined && { pinned: c.pinned }),
    ...(c.pinnedAt !== undefined && { pinnedAt: c.pinnedAt }),
    ...(c.messageCount !== undefined && { messageCount: c.messageCount }),
    ...(c.favorite !== undefined && { favorite: c.favorite }),
  }
}

// 公开分享用：不暴露 userId，避免隐私泄露
function serializeConversationPublic(c: {
  id: string
  title: string
  model: string
  systemPrompt: string | null
  metadata: unknown
  lastMessageAt: Date | null
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
  compressedAt: Date | null
  compressedContext: string | null
  pinned?: boolean
  pinnedAt?: Date | null
  messageCount?: number
  favorite?: boolean
}) {
  return {
    id: c.id,
    title: c.title,
    model: c.model,
    systemPrompt: c.systemPrompt,
    metadata: c.metadata,
    lastMessageAt: c.lastMessageAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    archivedAt: c.archivedAt,
    compressedAt: c.compressedAt,
    compressedContext: c.compressedContext,
    ...(c.pinned !== undefined && { pinned: c.pinned }),
    ...(c.pinnedAt !== undefined && { pinnedAt: c.pinnedAt }),
    ...(c.messageCount !== undefined && { messageCount: c.messageCount }),
    ...(c.favorite !== undefined && { favorite: c.favorite }),
  }
}

function serializeMessage(m: {
  id: string
  conversationId: string
  role: string
  content: string
  reasoning?: string | null
  tokens: number | null
  metadata: unknown
  createdAt: Date
}) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role,
    content: m.content,
    reasoning: m.reasoning,
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
      // 统一返回中文消息:authenticate() 内部大部分已是中文(封禁/注销/CSRF),
      // 仅 Authentication required / Invalid or expired token / Challenge token 是英文,
      // 统一兜底为"操作失败,请稍后重试",避免英文错误消息到达前端用户。
      return reply.status(statusCode).send(error(statusCode, '操作失败,请稍后重试'))
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
          500: {
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

      try {
        const conversation = await createConversation({
          userId,
          title: parsed.data.title,
          model: parsed.data.model,
          systemPrompt: parsed.data.systemPrompt,
          metadata: parsed.data.metadata,
        })

        return reply
          .status(201)
          .send(success({ conversation: serializeConversation(conversation) }))
      } catch (err) {
        // 2026-07-27 修复:500 空 body 不友好,打印堆栈 + 返回错误消息
        request.log.error({ err }, '创建对话失败')
        const msg = err instanceof Error ? err.message : '创建对话失败'
        return reply.code(500).send(error(500, msg))
      }
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
            ...paginationQuerySchema,
            search: { type: 'string', maxLength: 255, description: '按标题搜索' },
          },
        },
        response: buildResponseSchema(400, 401),
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

  // POST /conversations/batch - 批量操作对话(删除/收藏/取消收藏/归档/取消归档)
  // 用户归属校验由 DB 层 userId + inArray(ids) 一次过滤,防越权
  // 批量导出由前端循环单条 export + 逐个下载,不在此接口
  server.post('/conversations/batch', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const parsed = batchActionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { action, ids } = parsed.data

    try {
      let affected = 0
      switch (action) {
        case 'delete':
          affected = await deleteConversationsBatch(userId, ids)
          break
        case 'favorite':
          affected = await favoriteConversationsBatch(userId, ids)
          break
        case 'unfavorite':
          affected = await unfavoriteConversationsBatch(userId, ids)
          break
        case 'archive':
          affected = await setConversationsArchivedBatch(userId, ids, true)
          break
        case 'unarchive':
          affected = await setConversationsArchivedBatch(userId, ids, false)
          break
      }
      return reply.send(success({ action, affected }))
    } catch (err) {
      request.log.error({ err }, '批量操作失败')
      const msg = err instanceof Error ? err.message : '批量操作失败'
      return reply.code(500).send(error(500, msg))
    }
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
            ...paginationQuerySchema,
            before: {
              type: 'string',
              format: 'uuid',
              description: '游标:返回该消息 ID 之前的记录',
            },
            after: { type: 'string', format: 'uuid', description: '游标:返回该消息 ID 之后的记录' },
          },
        },
        response: buildResponseSchema(400, 401, 403, 404),
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
      reasoning: parsed.data.reasoning,
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

  // POST /conversations/:id/regenerate - 重新生成
  // 2026-08-30 立:删除指定 AI 消息及其之后的所有消息(事务),前端截断历史后重新发送前一条用户问题。
  // 不删除该 AI 消息之前的内容 —— 重新生成 = 保留上下文,重新生成目标回复。
  server.post('/conversations/:id/regenerate', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const parsed = regenerateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const result = await regenerateConversationMessages(id, parsed.data.messageId)
      return reply.send(success(result))
    } catch (err) {
      request.log.error({ err }, '重新生成失败')
      const msg = err instanceof Error ? err.message : '重新生成失败'
      return reply.code(500).send(error(500, msg))
    }
  })

  // POST /conversations/:id/branch - 分支/回退
  // 2026-08-30 立:基于指定消息(含该消息)之前的内容创建新会话,旧会话原样保留。
  // 相当于 Git 分支:从历史某条消息处"重新分叉",而非删除旧内容。
  server.post('/conversations/:id/branch', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const parsed = branchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const conversation = await branchConversationFrom(id, parsed.data.messageId, {
        userId,
        title: parsed.data.title,
        model: parsed.data.model,
      })
      return reply.status(201).send(success({ conversation: serializeConversation(conversation) }))
    } catch (err) {
      request.log.error({ err }, '创建分支失败')
      const msg = err instanceof Error ? err.message : '创建分支失败'
      return reply.code(500).send(error(500, msg))
    }
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

  // POST /conversations/:id/archive - 归档对话
  server.post('/conversations/:id/archive', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const updated = await archiveConversation(id)
    return reply.send(success({ conversation: serializeConversation(updated) }))
  })

  // DELETE /conversations/:id/archive - 取消归档
  server.delete('/conversations/:id/archive', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const updated = await unarchiveConversation(id)
    return reply.send(success({ conversation: serializeConversation(updated) }))
  })

  // GET /conversations/:id/export - 导出对话消息(md/txt)
  server.get('/conversations/:id/export', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const formatQuery = z.object({ format: z.enum(['txt', 'md']).default('md') })
    const parsed = formatQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const fmt = parsed.data.format

    const messages = await findMessagesForExport(id)
    const title = owned.conversation.title

    if (fmt === 'md') {
      const parts = [`# ${title}\n`]
      for (const m of messages) {
        parts.push(`## ${m.role} - ${new Date(m.createdAt).toISOString()}\n\n${m.content}\n`)
      }
      const content = parts.join('\n')
      reply
        .header('Content-Disposition', `attachment; filename="conversation-${id}.md"`)
        .type('text/markdown')
        .send(content)
    } else {
      const parts: string[] = []
      for (const m of messages) {
        parts.push(`[${m.role}] ${new Date(m.createdAt).toISOString()}\n${m.content}\n`)
      }
      const content = parts.join('\n')
      reply
        .header('Content-Disposition', `attachment; filename="conversation-${id}.txt"`)
        .type('text/plain')
        .send(content)
    }
  })

  // POST /conversations/:id/compress - 压缩对话上下文(调用 ai-service)
  server.post('/conversations/:id/compress', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const owned = await ensureOwnedConversation(id, userId, reply)
    if (!owned.conversation) return

    const parsed = compressSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { targetChars } = parsed.data

    const messages = await findMessagesForExport(id)
    const conversationText = messages.map((m) => `[${m.role}] ${m.content}`).join('\n\n')
    const llmMessages = [
      {
        role: 'system',
        content: `你是对话压缩助手。请把以下对话压缩到 ${targetChars} 字符以内,保留关键信息、用户意图、AI 回答要点,不要丢失重要上下文。直接输出压缩后的对话内容,不要附加说明。`,
      },
      { role: 'user', content: conversationText },
    ]

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000)
    let aiResult: {
      content?: string
      model?: string
      usage?: unknown
      stub?: boolean
      error?: string
    }
    try {
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: llmMessages, model: 'stepfun/step-3.7-flash' }),
        signal: controller.signal,
      })
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        return reply
          .status(502)
          .send(error(502, `AI service error: HTTP ${resp.status} ${errText}`))
      }
      aiResult = (await resp.json()) as typeof aiResult
    } catch (e) {
      return reply.status(502).send(error(502, `AI service error: ${(e as Error).message}`))
    } finally {
      clearTimeout(timeout)
    }

    if (aiResult.error) {
      return reply.status(502).send(error(502, `AI service error: ${aiResult.error}`))
    }

    const content = aiResult.content ?? ''
    await saveCompressedContext(id, content)

    return reply.send(
      success({
        content,
        model: aiResult.model,
        usage: aiResult.usage,
        originalChars: conversationText.length,
        compressedChars: content.length,
      }),
    )
  })

  // POST /compact — API 端手动压缩上下文(2026-09-02 立,对标 CLI /compact + /chat/stream 自动压缩)
  // 契约:POST /api/chat/compact,body { conversationId }(web 端代理同构,字段命名保持驼峰)。
  // 语义:无视 88% 自动压缩触发阈值立即压缩,复用 /chat/stream 自动压缩同一套管线:
  // LLM 语义摘要(缓存命中优先)→ compressContextIfNeeded → 归档落库 → replaceMessages 持久化。
  // 手动压缩触发方式(CLI /compact 同构):伪造 contextLimit = max(2000, ceil(tokens / 0.87))
  // 并显式传 triggerRatio = 0.87 —— ceil(t/0.87)*0.87 ∈ [t, t+0.87) ⊂ [t, t+1),floor 后恰为 t,
  // 触发检查 originalTokens < triggerThreshold 恒不成立 → 必然进入压缩;
  // 压缩目标 targetRatio(0.6) × 伪造 limit ≈ 当前 ~69% tokens。
  // 响应 schema(success.data):
  //   - 压缩成功:{ compressed: true, originalTokens, compressedTokens, removedCount, trigger }
  //   - 消息太少:{ compressed: false, reason: 'too_few_messages', ... }(200,前端据此提示不报错)
  //   - 压不动:  { compressed: false, reason: 'incompressible', originalTokens, compressedTokens, ... }
  //   - 会话不存在/无权限:404(不泄露资源存在性);归档落库失败仅 console.warn 降级不阻塞。
  server.post('/compact', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const parsed = compactSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const conversationId = parsed.data.conversationId

    // 会话归属校验:不存在或非本人会话一律 404(与现有会话端点语义一致,不泄露存在性)
    const conversation = await findConversationById(conversationId)
    if (!conversation || conversation.userId !== userId) {
      return reply.status(404).send(error(404, '对话不存在或无权限'))
    }

    // 全量消息(findMessagesForExport 无分页上限),映射为压缩包 ChatMessage,
    // 与 /chat/stream 自动压缩的输入形态一致(仅 role/content,metadata 随压缩丢弃)
    const rows = await findMessagesForExport(conversationId)
    const messages: ChatMessage[] = rows.map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
    }))

    // ① 消息太少,无压缩价值:200 + reason(不报错),token 字段保持响应 schema 统一
    if (messages.length < 3) {
      const tokens = Math.floor(estimateMessagesTokens(messages))
      return reply.send(
        success({
          compressed: false,
          reason: 'too_few_messages',
          originalTokens: tokens,
          compressedTokens: tokens,
          removedCount: 0,
        }),
      )
    }

    const conversationTail = conversationId.slice(-4)
    const forcedLimit = Math.max(2000, Math.ceil(Math.floor(estimateMessagesTokens(messages)) / 0.87))

    // ② LLM 语义摘要(缓存命中优先,未命中实时生成;失败返回 null → 共享包静默降级规则摘要),
    //    与 /chat/stream 自动压缩同一套 [SemanticSummary] 管线。手动压缩立即执行,无需 70% 预热。
    let customSummary = getCachedSemanticSummary(conversationId, messages)
    if (customSummary !== null) {
      console.warn('[SemanticSummary] cache hit:', {
        conversationTail,
        summaryLength: customSummary.length,
      })
    } else {
      customSummary = await generateSemanticSummary(
        request,
        messages,
        conversation.model ?? undefined,
        conversationId,
      )
      console.warn(
        customSummary !== null ? '[SemanticSummary] generated:' : '[SemanticSummary] degraded:',
        { conversationTail, model: conversation.model ?? undefined },
      )
    }

    // ③ 手动压缩:伪造 contextLimit + triggerRatio 0.87 使触发检查自然通过(见函数头注释)
    const result = compressContextIfNeeded(messages, {
      contextLimit: forcedLimit,
      triggerRatio: 0.87,
      customSummary: customSummary ?? undefined,
    })
    console.warn('[Compaction][manual] result:', {
      conversationTail,
      compressed: result.compressed,
      trigger: result.trigger,
      originalTokens: result.originalTokens,
      compressedTokens: result.compressedTokens,
      removedCount: result.removedCount,
    })

    // ④ 无可压缩空间(trigger 'none':伪造阈值下 tokens 仍不足,如上下文本身很小;
    //    'incompressible':摘要/截断降级后仍压不动):200 + reason,保持原样
    if (!result.compressed) {
      return reply.send(
        success({
          compressed: false,
          reason: 'incompressible',
          originalTokens: result.originalTokens,
          compressedTokens: result.compressedTokens,
          removedCount: result.removedCount,
          trigger: result.trigger,
        }),
      )
    }

    // ⑤ 原子性持久化压缩结果(与 /chat/stream 自动压缩同一套 replaceMessages 管线):
    //    删除旧消息 + 批量插入压缩后消息。失败视为压缩未生效,返回 500 由前端提示重试
    try {
      await replaceMessages(conversationId, result.messages)
    } catch (e) {
      request.log.error({ err: e, conversationId }, '手动压缩持久化失败')
      return reply.status(500).send(error(500, '压缩结果持久化失败'))
    }

    // ⑥ 归档记忆:被压缩的原始消息落库 conversation_message_archives,前端"查看原始消息"可查。
    //    旁路降级:persistMessageArchive 内部吞掉一切失败(console.warn),绝不阻塞压缩返回
    void persistMessageArchive(conversationId, messages)

    return reply.send(
      success({
        compressed: true,
        originalTokens: result.originalTokens,
        compressedTokens: result.compressedTokens,
        removedCount: result.removedCount,
        trigger: result.trigger,
      }),
    )
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

    // 安全校验:客户端可控的 targetUserId 必须与登录用户一致,防止越权访问他人 Coze 会话
    if (targetUserId !== request.userId)
      return reply.status(403).send(error(403, '无权操作其他用户的会话'))

    const cozeKey = process.env.COZE_API_KEY
    if (!cozeKey) return reply.status(503).send(error(503, 'Coze 服务未配置'))

    const existingConvId = conversationId || (await getCozeConversationId(targetUserId, botId))

    // P1 修复:补齐 SSE 连接清理 — hijack + AbortController + close 监听 + 超时兜底
    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const controller = new AbortController()
    const onClose = () => controller.abort()
    request.raw.on('close', onClose)

    // 5 分钟兜底超时,防止上游挂住导致连接泄漏
    const timeoutGuard = setTimeout(() => controller.abort(), 5 * 60 * 1000)

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
        signal: controller.signal,
      })
      if (!resp.ok || !resp.body) {
        reply.raw.write(`data: ${JSON.stringify({ error: `Coze API ${resp.status}` })}\n\n`)
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
      // 客户端断开导致的 AbortError 不写错误帧
      if (!(e instanceof Error && e.name === 'AbortError')) {
        reply.raw.write(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`)
      }
    } finally {
      clearTimeout(timeoutGuard)
      request.raw.removeListener('close', onClose)
      reply.raw.end()
    }
  })

  // POST /conversations/:id/share - 生成/获取分享token
  server.post('/conversations/:id/share', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId
    const { id } = idParam.parse(request.params)
    const conversation = await findConversationById(id)
    if (!conversation) {
      return reply.status(404).send(error(404, '对话不存在'))
    }
    if (conversation.userId !== userId) {
      return reply.status(403).send(error(403, '无权访问该对话'))
    }
    // 跳过响应脱敏：share token 字段名为 token，会被 response-sanitizer 改写为 ***
    request.skipResponseSanitization = true
    const result = await setConversationShareToken(id, userId)
    return reply.send(success({ token: result.token }))
  })

  // GET /conversations/share/:token - 公开查看分享对话
  server.get('/conversations/share/:token', async (request, reply) => {
    const { token } = z.object({ token: z.string() }).parse(request.params)
    const conversation = await findConversationByShareToken(token)
    if (!conversation) {
      return reply.status(404).send(error(404, '对话不存在或已删除'))
    }
    const messages = await findMessagesForShare(conversation.id)
    return reply.send(
      success({ conversation: serializeConversationPublic(conversation), messages }),
    )
  })

  // GET /conversations/:id/archives - 压缩归档列表(2026-09-01 立,"归档记忆"能力)
  // 列出该会话每次自动压缩落库的原始消息归档(id/message_count/created_at,不含 messages 大字段)。
  // 归属校验:不存在或不属于当前用户一律 404(不泄露会话存在性)。
  server.get('/conversations/:id/archives', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const conversation = await findConversationById(id)
    if (!conversation || conversation.userId !== userId) {
      return reply.status(404).send(error(404, '对话不存在'))
    }

    const archives = await listMessageArchives(id)
    return reply.send(success({ archives }))
  })

  // GET /conversations/:id/archives/:archiveId - 压缩归档详情(含被压缩的原始消息 messages)
  // 查询限定 conversationId + archiveId 双条件,防跨会话越权读取归档。
  server.get('/conversations/:id/archives/:archiveId', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id, archiveId } = z
      .object({ id: z.string(), archiveId: z.string() })
      .parse(request.params)
    const conversation = await findConversationById(id)
    if (!conversation || conversation.userId !== userId) {
      return reply.status(404).send(error(404, '对话不存在'))
    }

    const archive = await findMessageArchive(id, archiveId)
    if (!archive) {
      return reply.status(404).send(error(404, '归档不存在'))
    }
    return reply.send(success({ archive }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
