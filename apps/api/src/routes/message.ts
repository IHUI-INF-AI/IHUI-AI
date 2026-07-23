import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { db } from '../db/index.js'
import {
  messagePrivateLetter,
  messageSystemNotice,
  messageTemplates,
  eduMessages,
  chatConversations,
  chatMessages,
} from '@ihui/database'
import { eq, sql, and, or, desc, inArray, lt } from 'drizzle-orm'
import {
  findAnnouncements,
  findAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  findEduMessages,
  findEduMessageById,
  markEduMessageRead,
  countUnreadEduMessages,
} from '../db/message-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const announcementListQuery = z.object({
  ...paginationQuery,
  title: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  isPublished: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
})

const messageListQuery = z.object({
  ...paginationQuery,
  msgType: z.preprocess(emptyToUndefined, z.string().min(1).max(32).optional()),
  isRead: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
})

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const createAnnouncementSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长'),
  content: z.string().max(20000).nullable().optional(),
  isPublished: z.boolean().optional(),
  isTop: z.boolean().optional(),
  publishTime: z.string().datetime().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
})

const updateAnnouncementSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长').optional(),
  content: z.string().max(20000).nullable().optional(),
  isPublished: z.boolean().optional(),
  isTop: z.boolean().optional(),
  publishTime: z.string().datetime().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
})

// =============================================================================
// Swagger response schemas (shared)
// =============================================================================

const successSchema = {
  type: 'object',
  properties: {
    code: { type: 'number' },
    message: { type: 'string' },
    data: { type: 'object', additionalProperties: true },
  },
}

const errorSchema = {
  type: 'object',
  properties: {
    code: { type: 'number' },
    message: { type: 'string' },
  },
}

const authMsgResponse = {
  200: successSchema,
  201: successSchema,
  202: successSchema,
  400: errorSchema,
  401: errorSchema,
  404: errorSchema,
  500: errorSchema,
}

const adminMsgResponse = {
  200: successSchema,
  201: successSchema,
  400: errorSchema,
  401: errorSchema,
  403: errorSchema,
  404: errorSchema,
  500: errorSchema,
}

// =============================================================================
// 公共路由（前缀 /api，需登录）
// =============================================================================

export const messageRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /messages/announcements - 已发布公告列表
  server.get(
    '/messages/announcements',
    {
      schema: {
        summary: '已发布公告列表',
        description: '返回已发布公告列表(分页,支持标题筛选)',
        tags: ['message'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            title: { type: 'string' },
            isPublished: { type: 'boolean' },
            status: { type: 'integer' },
          },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const parsed = announcementListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findAnnouncements({ ...parsed.data, publishedOnly: true })
      return reply.send(success(result))
    },
  )

  // GET /messages/announcements/:id - 公告详情
  server.get(
    '/messages/announcements/:id',
    {
      schema: {
        summary: '公告详情',
        description: '返回指定公告详情(仅返回已发布公告)',
        tags: ['message'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const ann = await findAnnouncementById(parsed.data.id)
      if (!ann || !ann.isPublished || ann.status !== 1) {
        return reply.status(404).send(error(404, '公告不存在'))
      }
      return reply.send(success({ announcement: ann }))
    },
  )

  // GET /messages - 当前用户站内消息列表
  server.get(
    '/messages',
    {
      schema: {
        summary: '当前用户站内消息',
        description: '返回当前用户的站内消息列表(分页)',
        tags: ['message'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            msgType: { type: 'string' },
            isRead: { type: 'boolean' },
          },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const parsed = messageListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const userId = request.userId!
      const result = await findEduMessages({ ...parsed.data, memberId: userId })
      return reply.send(success(result))
    },
  )

  // GET /messages/unread-count - 未读消息数
  server.get(
    '/messages/unread-count',
    {
      schema: {
        summary: '未读消息数',
        description: '返回当前用户的未读消息数',
        tags: ['message'],
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const userId = request.userId!
      const count = await countUnreadEduMessages(userId)
      return reply.send(success({ count }))
    },
  )

  // PUT /messages/:id/read - 标记消息已读
  server.put(
    '/messages/:id/read',
    {
      schema: {
        summary: '标记消息已读',
        description: '标记指定站内消息为已读',
        tags: ['message'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const msg = await findEduMessageById(parsed.data.id)
      if (!msg || msg.memberId !== request.userId) {
        return reply.status(404).send(error(404, '消息不存在'))
      }
      const updated = await markEduMessageRead(parsed.data.id)
      return reply.send(success({ message: updated }))
    },
  )

  // POST /messages/read-all - 全部标记已读
  server.post(
    '/messages/read-all',
    {
      schema: {
        summary: '全部标记已读',
        description: '将当前用户的所有未读站内消息标记为已读',
        tags: ['message'],
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const userId = request.userId!
      await db
        .update(eduMessages)
        .set({ isRead: true })
        .where(and(eq(eduMessages.memberId, userId), eq(eduMessages.isRead, false)))
      return reply.send(success({ ok: true }))
    },
  )

  // DELETE /messages/:id - 删除消息
  server.delete(
    '/messages/:id',
    {
      schema: {
        summary: '删除站内消息',
        description: '删除当前用户的指定站内消息',
        tags: ['message'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const msg = await findEduMessageById(parsed.data.id)
      if (!msg || msg.memberId !== request.userId) {
        return reply.status(404).send(error(404, '消息不存在'))
      }
      await db.delete(eduMessages).where(eq(eduMessages.id, parsed.data.id))
      return reply.send(success({ ok: true }))
    },
  )

  // DELETE /messages/batch-delete - 批量删除消息
  server.delete(
    '/messages/batch-delete',
    {
      schema: {
        summary: '批量删除站内消息',
        description: '批量删除当前用户的指定站内消息',
        tags: ['message'],
        body: {
          type: 'object',
          required: ['ids'],
          properties: {
            ids: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              minItems: 1,
            },
          },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const body = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(request.body)
      const userId = request.userId!
      await db
        .delete(eduMessages)
        .where(and(eq(eduMessages.memberId, userId), inArray(eduMessages.id, body.ids)))
      return reply.send(success({ deleted: body.ids.length }))
    },
  )

  // ----- IM Conversations/私聊会话(基于 chat_conversations + chat_messages) -----

  // GET /messages/list - 我的会话列表(每会话附最近一条消息 + 未读数)
  server.get(
    '/messages/list',
    {
      schema: {
        summary: '我的会话列表',
        description: '返回当前用户的会话列表(每会话附最近一条消息)',
        tags: ['message'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, default: 20 },
          },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const userId = request.userId!
      const { page, pageSize } = z
        .object({ page: z.coerce.number().default(1), pageSize: z.coerce.number().default(20) })
        .parse(request.query)
      const conversations = await db
        .select()
        .from(chatConversations)
        .where(eq(chatConversations.userId, userId))
        .orderBy(desc(chatConversations.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)
      if (conversations.length === 0) return reply.send(success({ list: [] }))
      const ids = conversations.map((c) => c.id)
      const lastRows = await db
        .select()
        .from(chatMessages)
        .where(inArray(chatMessages.conversationId, ids))
        .orderBy(desc(chatMessages.createdAt))
      const lastByConv = new Map<string, (typeof lastRows)[number]>()
      for (const m of lastRows) {
        if (!lastByConv.has(m.conversationId)) lastByConv.set(m.conversationId, m)
      }
      const list = conversations.map((c) => {
        const last = lastByConv.get(c.id)
        return {
          id: c.id,
          title: c.title,
          peer: null,
          messages: last
            ? [
                {
                  id: last.id,
                  conversationId: last.conversationId,
                  senderId: last.role === 'user' ? userId : 'assistant',
                  content: last.content,
                  createdAt: last.createdAt?.toISOString?.() ?? new Date().toISOString(),
                  isMine: last.role === 'user',
                },
              ]
            : [],
          unread: 0,
          updatedAt: c.updatedAt,
        }
      })
      return reply.send(success({ list, page, pageSize }))
    },
  )

  // GET /messages/:id/history - 加载会话历史消息(分页)
  server.get(
    '/messages/:id/history',
    {
      schema: {
        summary: '会话历史消息',
        description: '加载指定会话的历史消息(分页,游标式)',
        tags: ['message'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        querystring: {
          type: 'object',
          properties: {
            cursor: { type: 'string', format: 'date-time' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const userId = request.userId!
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
      const { cursor, limit } = z
        .object({
          cursor: z.string().datetime().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(20),
        })
        .parse(request.query)
      const conv = await db
        .select()
        .from(chatConversations)
        .where(and(eq(chatConversations.id, id), eq(chatConversations.userId, userId)))
        .limit(1)
      if (conv.length === 0) return reply.status(404).send(error(404, '会话不存在'))
      const conds = [eq(chatMessages.conversationId, id)]
      if (cursor) conds.push(lt(chatMessages.createdAt, new Date(cursor)))
      const rows = await db
        .select()
        .from(chatMessages)
        .where(and(...conds))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit)
      const list = rows
        .map((m) => ({
          id: m.id,
          conversationId: m.conversationId,
          senderId: m.role === 'user' ? userId : 'assistant',
          content: m.content,
          createdAt: m.createdAt?.toISOString?.() ?? new Date().toISOString(),
          isMine: m.role === 'user',
        }))
        .reverse()
      const oldest = rows[rows.length - 1]
      return reply.send(
        success({
          list,
          hasMore: rows.length === limit,
          nextCursor: oldest ? (oldest.createdAt?.toISOString?.() ?? null) : null,
        }),
      )
    },
  )

  // POST /messages/send - 发送消息(写入用户消息,自动标记已读)
  server.post(
    '/messages/send',
    {
      schema: {
        summary: '发送消息',
        description: '向指定会话发送消息',
        tags: ['message'],
        body: {
          type: 'object',
          required: ['conversationId', 'content'],
          properties: {
            conversationId: { type: 'string', format: 'uuid' },
            content: { type: 'string', minLength: 1, maxLength: 5000 },
          },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const userId = request.userId!
      const { conversationId, content } = z
        .object({ conversationId: z.string().uuid(), content: z.string().min(1).max(5000) })
        .parse(request.body)
      const conv = await db
        .select()
        .from(chatConversations)
        .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)))
        .limit(1)
      if (conv.length === 0) return reply.status(404).send(error(404, '会话不存在'))
      const [created] = await db
        .insert(chatMessages)
        .values({ conversationId, role: 'user', content })
        .returning()
      if (!created) return reply.status(500).send(error(500, '消息发送失败'))
      await db
        .update(chatConversations)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(chatConversations.id, conversationId))
      return reply.status(201).send(
        success({
          message: {
            id: created.id,
            conversationId: created.conversationId,
            senderId: userId,
            content: created.content,
            createdAt: created.createdAt?.toISOString?.() ?? new Date().toISOString(),
            isMine: true,
          },
        }),
      )
    },
  )

  // POST /messages/:id/read - 占位:会话已读标记
  // TODO: chatConversations 表无 lastReadAt 字段(现有: lastMessageAt/createdAt/updatedAt/archivedAt/compressedAt),
  // 持久化已读状态需扩展 schema 增加 last_read_at 字段 + 配套 migration。当前仅校验会话归属后返回 202 Accepted,
  // 明确告知客户端"已读标记已接收但未持久化"。
  server.post(
    '/messages/:id/read',
    {
      schema: {
        summary: '标记会话已读',
        description:
          '标记指定会话为已读(占位:chatConversations 无 lastReadAt 字段,返回 202 已接收但未持久化)',
        tags: ['message'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const userId = request.userId!
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
      const conv = await db
        .select({ id: chatConversations.id })
        .from(chatConversations)
        .where(and(eq(chatConversations.id, id), eq(chatConversations.userId, userId)))
        .limit(1)
      if (conv.length === 0) return reply.status(404).send(error(404, '会话不存在'))
      // 202 Accepted:已读标记已接收,但 chatConversations 无 lastReadAt 字段,未持久化
      return reply.status(202).send(success({ accepted: true, persisted: false }))
    },
  )

  // ----- Private messages 私信 -----

  // GET /messages/private/list - 我的私信列表
  server.get(
    '/messages/private/list',
    {
      schema: {
        summary: '我的私信列表',
        description: '返回当前用户的私信列表(分页,支持按对话伙伴筛选)',
        tags: ['message'],
        querystring: {
          type: 'object',
          properties: {
            peerId: { type: 'string' },
            isRead: { type: 'string' },
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, default: 20 },
          },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const userId = request.userId!
      const { peerId, isRead, page, pageSize } = z
        .object({
          peerId: z.string().optional(),
          isRead: z.string().optional(),
          page: z.coerce.number().optional().default(1),
          pageSize: z.coerce.number().optional().default(20),
        })
        .parse(request.query)
      const conditions = [
        or(eq(messagePrivateLetter.senderId, userId), eq(messagePrivateLetter.receiverId, userId)),
      ]
      if (peerId)
        conditions.push(
          or(
            eq(messagePrivateLetter.senderId, peerId),
            eq(messagePrivateLetter.receiverId, peerId),
          ),
        )
      if (isRead !== undefined) conditions.push(eq(messagePrivateLetter.isRead, isRead === 'true'))
      const list = await db
        .select()
        .from(messagePrivateLetter)
        .where(and(...conditions))
        .orderBy(desc(messagePrivateLetter.id))
        .limit(Number(pageSize))
        .offset((Number(page) - 1) * Number(pageSize))
      return reply.send(success({ list, page: Number(page), pageSize: Number(pageSize) }))
    },
  )

  // GET /messages/private/conversation/list - 会话列表（去重的对话伙伴）
  server.get(
    '/messages/private/conversation/list',
    {
      schema: {
        summary: '私信对话伙伴列表',
        description: '返回当前用户的私信对话伙伴列表(去重)',
        tags: ['message'],
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const userId = request.userId!
      const rows = await db.execute(
        sql`SELECT DISTINCT
        CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END AS peer_id
      FROM message_private_letter
      WHERE sender_id = ${userId} OR receiver_id = ${userId}
      ORDER BY peer_id`,
      )
      return reply.send(success({ list: rows as Record<string, unknown>[] }))
    },
  )

  // POST /messages/private - 发送私信
  server.post(
    '/messages/private',
    {
      schema: {
        summary: '发送私信',
        description: '向指定用户发送私信',
        tags: ['message'],
        body: {
          type: 'object',
          required: ['receiverId', 'content'],
          properties: {
            receiverId: { type: 'string', description: '接收者 ID' },
            content: { type: 'string', minLength: 1 },
          },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const body = z
        .object({
          receiverId: z.string().min(1).max(100),
          content: z.string().min(1),
        })
        .parse(request.body)
      const senderId = request.userId!
      const [created] = await db
        .insert(messagePrivateLetter)
        .values({
          senderId,
          receiverId: body.receiverId,
          content: body.content,
        })
        .returning()
      return reply.status(201).send(success({ message: created }))
    },
  )

  // POST /messages/private/:pid/read - 标记私信已读
  server.post(
    '/messages/private/:pid/read',
    {
      schema: {
        summary: '标记私信已读',
        description: '标记指定私信为已读',
        tags: ['message'],
        params: {
          type: 'object',
          required: ['pid'],
          properties: { pid: { type: 'string' } },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const { pid } = z.object({ pid: z.string() }).parse(request.params)
      const userId = request.userId!
      const [updated] = await db
        .update(messagePrivateLetter)
        .set({
          isRead: true,
          readTime: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(messagePrivateLetter.id, Number(pid)),
            eq(messagePrivateLetter.receiverId, userId),
          ),
        )
        .returning()
      if (!updated) return reply.status(404).send(error(404, '私信不存在'))
      return reply.send(success({ message: updated }))
    },
  )

  // DELETE /messages/private/:pid - 删除私信
  server.delete(
    '/messages/private/:pid',
    {
      schema: {
        summary: '删除私信',
        description: '删除指定私信(发送者或接收者均可操作)',
        tags: ['message'],
        params: {
          type: 'object',
          required: ['pid'],
          properties: { pid: { type: 'string' } },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const { pid } = z.object({ pid: z.string() }).parse(request.params)
      const userId = request.userId!
      await db
        .delete(messagePrivateLetter)
        .where(
          and(
            eq(messagePrivateLetter.id, Number(pid)),
            or(
              eq(messagePrivateLetter.senderId, userId),
              eq(messagePrivateLetter.receiverId, userId),
            ),
          ),
        )
      return reply.send(success({ ok: true }))
    },
  )

  // ----- System notices 系统通知 -----

  // GET /messages/system-notice/list - 系统通知列表
  server.get(
    '/messages/system-notice/list',
    {
      schema: {
        summary: '系统通知列表',
        description: '返回系统通知列表(分页)',
        tags: ['message'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, default: 20 },
          },
        },
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const { page, pageSize } = z
        .object({
          page: z.coerce.number().optional().default(1),
          pageSize: z.coerce.number().optional().default(20),
        })
        .parse(request.query)
      const list = await db
        .select()
        .from(messageSystemNotice)
        .orderBy(desc(messageSystemNotice.createdAt))
        .limit(Number(pageSize))
        .offset((Number(page) - 1) * Number(pageSize))
      return reply.send(success({ list, page: Number(page), pageSize: Number(pageSize) }))
    },
  )

  // GET /messages/aggregate - 聚合消息(公告 + 私信 + 系统通知 + 未读数)
  server.get(
    '/messages/aggregate',
    {
      schema: {
        summary: '聚合消息',
        description: '返回聚合消息(公告 + 私信 + 系统通知 + 未读数)',
        tags: ['message'],
        response: authMsgResponse,
      },
    },
    async (request, reply) => {
      const userId = request.userId!
      const [
        announcementsResult,
        privateMessages,
        systemNotices,
        unreadAnnRows,
        unreadPrivRows,
        unreadSysRows,
      ] = await Promise.all([
        findAnnouncements({ page: 1, pageSize: 5, publishedOnly: true }),
        db
          .select()
          .from(messagePrivateLetter)
          .where(
            or(
              eq(messagePrivateLetter.senderId, userId),
              eq(messagePrivateLetter.receiverId, userId),
            ),
          )
          .orderBy(desc(messagePrivateLetter.id))
          .limit(5),
        db.select().from(messageSystemNotice).orderBy(desc(messageSystemNotice.createdAt)).limit(5),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(eduMessages)
          .where(
            and(
              eq(eduMessages.memberId, userId),
              eq(eduMessages.isRead, false),
              eq(eduMessages.msgType, 'announcement'),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(messagePrivateLetter)
          .where(
            and(
              eq(messagePrivateLetter.receiverId, userId),
              eq(messagePrivateLetter.isRead, false),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(eduMessages)
          .where(
            and(
              eq(eduMessages.memberId, userId),
              eq(eduMessages.isRead, false),
              eq(eduMessages.msgType, 'system'),
            ),
          ),
      ])
      const annUnread = unreadAnnRows[0]?.count ?? 0
      const privUnread = unreadPrivRows[0]?.count ?? 0
      const sysUnread = unreadSysRows[0]?.count ?? 0
      return reply.send(
        success({
          announcements: announcementsResult.list,
          privateMessages,
          systemNotices,
          unreadCount: {
            total: annUnread + privUnread + sysUnread,
            announcements: annUnread,
            private: privUnread,
            system: sysUnread,
          },
        }),
      )
    },
  )
}

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminMessageRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /messages/announcements - 公告列表（含未发布）
  server.get(
    '/messages/announcements',
    {
      schema: {
        summary: '公告列表(管理员)',
        description: '返回公告列表(含未发布,管理员专用)',
        tags: ['message', 'admin'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            title: { type: 'string' },
            isPublished: { type: 'boolean' },
            status: { type: 'integer' },
          },
        },
        response: adminMsgResponse,
      },
    },
    async (request, reply) => {
      const parsed = announcementListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findAnnouncements(parsed.data)
      return reply.send(success(result))
    },
  )

  // GET /messages/announcements/:id - 公告详情
  server.get(
    '/messages/announcements/:id',
    {
      schema: {
        summary: '公告详情(管理员)',
        description: '返回指定公告详情(含未发布,管理员专用)',
        tags: ['message', 'admin'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: adminMsgResponse,
      },
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const ann = await findAnnouncementById(parsed.data.id)
      if (!ann) {
        return reply.status(404).send(error(404, '公告不存在'))
      }
      return reply.send(success({ announcement: ann }))
    },
  )

  // POST /messages/announcements - 新建公告
  server.post(
    '/messages/announcements',
    {
      schema: {
        summary: '新建公告',
        description: '创建新公告(管理员专用)',
        tags: ['message', 'admin'],
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 200 },
            content: { type: 'string', maxLength: 20000, nullable: true },
            isPublished: { type: 'boolean' },
            isTop: { type: 'boolean' },
            publishTime: { type: 'string', format: 'date-time', nullable: true },
            sort: { type: 'integer', minimum: 0 },
            status: { type: 'integer', minimum: 0 },
          },
        },
        response: adminMsgResponse,
      },
    },
    async (request, reply) => {
      const parsed = createAnnouncementSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const announcement = await createAnnouncement({
        ...parsed.data,
        publishTime: parsed.data.publishTime ? new Date(parsed.data.publishTime) : null,
      })
      return reply.status(201).send(success({ announcement }))
    },
  )

  // PUT /messages/announcements/:id - 更新公告
  server.put(
    '/messages/announcements/:id',
    {
      schema: {
        summary: '更新公告',
        description: '更新指定公告(管理员专用)',
        tags: ['message', 'admin'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 200 },
            content: { type: 'string', maxLength: 20000, nullable: true },
            isPublished: { type: 'boolean' },
            isTop: { type: 'boolean' },
            publishTime: { type: 'string', format: 'date-time', nullable: true },
            sort: { type: 'integer', minimum: 0 },
            status: { type: 'integer', minimum: 0 },
          },
        },
        response: adminMsgResponse,
      },
    },
    async (request, reply) => {
      const idParsed = uuidParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updateAnnouncementSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findAnnouncementById(idParsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '公告不存在'))
      }
      const announcement = await updateAnnouncement(idParsed.data.id, {
        ...parsed.data,
        publishTime: parsed.data.publishTime ? new Date(parsed.data.publishTime) : null,
      })
      return reply.send(success({ announcement }))
    },
  )

  // DELETE /messages/announcements/:id - 删除公告
  server.delete(
    '/messages/announcements/:id',
    {
      schema: {
        summary: '删除公告',
        description: '删除指定公告(管理员专用)',
        tags: ['message', 'admin'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: adminMsgResponse,
      },
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findAnnouncementById(parsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '公告不存在'))
      }
      await deleteAnnouncement(parsed.data.id)
      return reply.send(success({ ok: true }))
    },
  )

  // GET /messages - 站内消息列表（admin 可按 memberId 筛选）
  server.get(
    '/messages',
    {
      schema: {
        summary: '站内消息列表(管理员)',
        description: '返回站内消息列表(管理员可按 memberId 筛选)',
        tags: ['message', 'admin'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            memberId: { type: 'string', format: 'uuid' },
            msgType: { type: 'string' },
            isRead: { type: 'boolean' },
          },
        },
        response: adminMsgResponse,
      },
    },
    async (request, reply) => {
      const parsed = z
        .object({
          ...paginationQuery,
          memberId: z.preprocess(emptyToUndefined, z.string().uuid('无效的用户 ID').optional()),
          msgType: z.preprocess(emptyToUndefined, z.string().min(1).max(32).optional()),
          isRead: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
        })
        .safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findEduMessages(parsed.data)
      return reply.send(success(result))
    },
  )

  // ----- System notice admin 系统通知管理 -----

  // POST /messages/system-notice - 发布系统通知
  server.post(
    '/messages/system-notice',
    {
      schema: {
        summary: '发布系统通知',
        description: '发布新的系统通知(管理员专用)',
        tags: ['message', 'admin'],
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 1 },
          },
        },
        response: adminMsgResponse,
      },
    },
    async (request, reply) => {
      const body = z.object({ content: z.string().min(1) }).parse(request.body)
      const [created] = await db
        .insert(messageSystemNotice)
        .values({ content: body.content })
        .returning()
      return reply.status(201).send(success({ notice: created }))
    },
  )

  // DELETE /messages/system-notice/:nid - 删除系统通知
  server.delete(
    '/messages/system-notice/:nid',
    {
      schema: {
        summary: '删除系统通知',
        description: '删除指定系统通知(管理员专用)',
        tags: ['message', 'admin'],
        params: {
          type: 'object',
          required: ['nid'],
          properties: { nid: { type: 'string' } },
        },
        response: adminMsgResponse,
      },
    },
    async (request, reply) => {
      const { nid } = z.object({ nid: z.string() }).parse(request.params)
      await db.delete(messageSystemNotice).where(eq(messageSystemNotice.id, Number(nid)))
      return reply.send(success({ ok: true }))
    },
  )

  // ----- Message templates 消息模板管理 -----

  // GET /messages/template/list - 消息模板列表
  server.get(
    '/messages/template/list',
    {
      schema: {
        summary: '消息模板列表',
        description: '返回消息模板列表(分页,支持按渠道与状态筛选)',
        tags: ['message', 'admin'],
        querystring: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            status: { type: 'integer' },
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, default: 20 },
          },
        },
        response: adminMsgResponse,
      },
    },
    async (request, reply) => {
      const { channel, status, page, pageSize } = z
        .object({
          channel: z.string().optional(),
          status: z.coerce.number().optional(),
          page: z.coerce.number().optional().default(1),
          pageSize: z.coerce.number().optional().default(20),
        })
        .parse(request.query)
      const conditions = []
      if (channel) conditions.push(eq(messageTemplates.channel, channel))
      if (status !== undefined) conditions.push(eq(messageTemplates.status, Number(status)))
      const where = conditions.length ? and(...conditions) : sql`TRUE`
      const list = await db
        .select()
        .from(messageTemplates)
        .where(where)
        .orderBy(desc(messageTemplates.createdAt))
        .limit(Number(pageSize))
        .offset((Number(page) - 1) * Number(pageSize))
      return reply.send(success({ list, page: Number(page), pageSize: Number(pageSize) }))
    },
  )

  // POST /messages/template - 新增消息模板
  server.post(
    '/messages/template',
    {
      schema: {
        summary: '新增消息模板',
        description: '创建新的消息模板(管理员专用)',
        tags: ['message', 'admin'],
        body: {
          type: 'object',
          required: ['code', 'channel', 'title', 'content'],
          properties: {
            code: { type: 'string', minLength: 1, maxLength: 64 },
            channel: { type: 'string', minLength: 1, maxLength: 32 },
            title: { type: 'string', minLength: 1, maxLength: 255 },
            content: { type: 'string', minLength: 1 },
            variables: { type: 'object', additionalProperties: true },
            status: { type: 'integer', default: 1 },
          },
        },
        response: adminMsgResponse,
      },
    },
    async (request, reply) => {
      const body = z
        .object({
          code: z.string().min(1).max(64),
          channel: z.string().min(1).max(32),
          title: z.string().min(1).max(255),
          content: z.string().min(1),
          variables: z.unknown().optional(),
          status: z.number().int().default(1),
        })
        .parse(request.body)
      const [created] = await db
        .insert(messageTemplates)
        .values({
          code: body.code,
          channel: body.channel,
          title: body.title,
          content: body.content,
          variables: body.variables,
          status: body.status,
        })
        .returning()
      return reply.status(201).send(success({ template: created }))
    },
  )
}
