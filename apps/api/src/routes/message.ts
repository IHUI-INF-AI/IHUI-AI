import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { db } from '../db/index.js'
import {
  messagePrivateLetter,
  messageSystemNotice,
  messageTemplates,
  eduMessages,
} from '@ihui/database'
import { eq, sql, and, or, desc, inArray } from 'drizzle-orm'
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
// 鉴权辅助
// =============================================================================

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

// =============================================================================
// 公共路由（前缀 /api，需登录）
// =============================================================================

export const messageRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // GET /messages/announcements - 已发布公告列表
  server.get('/messages/announcements', async (request, reply) => {
    const parsed = announcementListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findAnnouncements({ ...parsed.data, publishedOnly: true })
    return reply.send(success(result))
  })

  // GET /messages/announcements/:id - 公告详情
  server.get('/messages/announcements/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const ann = await findAnnouncementById(parsed.data.id)
    if (!ann || !ann.isPublished || ann.status !== 1) {
      return reply.status(404).send(error(404, '公告不存在'))
    }
    return reply.send(success({ announcement: ann }))
  })

  // GET /messages - 当前用户站内消息列表
  server.get('/messages', async (request, reply) => {
    const parsed = messageListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const result = await findEduMessages({ ...parsed.data, memberId: userId })
    return reply.send(success(result))
  })

  // GET /messages/unread-count - 未读消息数
  server.get('/messages/unread-count', async (request, reply) => {
    const userId = request.userId!
    const count = await countUnreadEduMessages(userId)
    return reply.send(success({ count }))
  })

  // PUT /messages/:id/read - 标记消息已读
  server.put('/messages/:id/read', async (request, reply) => {
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
  })

  // POST /messages/read-all - 全部标记已读
  server.post('/messages/read-all', async (request, reply) => {
    const userId = request.userId!
    await db
      .update(eduMessages)
      .set({ isRead: true })
      .where(and(eq(eduMessages.memberId, userId), eq(eduMessages.isRead, false)))
    return reply.send(success({ ok: true }))
  })

  // DELETE /messages/:id - 删除消息
  server.delete('/messages/:id', async (request, reply) => {
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
  })

  // DELETE /messages/batch-delete - 批量删除消息
  server.delete('/messages/batch-delete', async (request, reply) => {
    const body = z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(request.body)
    const userId = request.userId!
    await db
      .delete(eduMessages)
      .where(and(eq(eduMessages.memberId, userId), inArray(eduMessages.id, body.ids)))
    return reply.send(success({ deleted: body.ids.length }))
  })

  // ----- Private messages 私信 -----

  // GET /messages/private/list - 我的私信列表
  server.get('/messages/private/list', async (request, reply) => {
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
        or(eq(messagePrivateLetter.senderId, peerId), eq(messagePrivateLetter.receiverId, peerId)),
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
  })

  // GET /messages/private/conversation/list - 会话列表（去重的对话伙伴）
  server.get('/messages/private/conversation/list', async (request, reply) => {
    const userId = request.userId!
    const rows = await db.execute(
      sql`SELECT DISTINCT
        CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END AS peer_id
      FROM message_private_letter
      WHERE sender_id = ${userId} OR receiver_id = ${userId}
      ORDER BY peer_id`,
    )
    return reply.send(success({ list: rows as Record<string, unknown>[] }))
  })

  // POST /messages/private - 发送私信
  server.post('/messages/private', async (request, reply) => {
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
  })

  // POST /messages/private/:pid/read - 标记私信已读
  server.post('/messages/private/:pid/read', async (request, reply) => {
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
        and(eq(messagePrivateLetter.id, Number(pid)), eq(messagePrivateLetter.receiverId, userId)),
      )
      .returning()
    if (!updated) return reply.status(404).send(error(404, '私信不存在'))
    return reply.send(success({ message: updated }))
  })

  // DELETE /messages/private/:pid - 删除私信
  server.delete('/messages/private/:pid', async (request, reply) => {
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
  })

  // ----- System notices 系统通知 -----

  // GET /messages/system-notice/list - 系统通知列表
  server.get('/messages/system-notice/list', async (request, reply) => {
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
  })
}

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminMessageRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /messages/announcements - 公告列表（含未发布）
  server.get('/messages/announcements', async (request, reply) => {
    const parsed = announcementListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findAnnouncements(parsed.data)
    return reply.send(success(result))
  })

  // GET /messages/announcements/:id - 公告详情
  server.get('/messages/announcements/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const ann = await findAnnouncementById(parsed.data.id)
    if (!ann) {
      return reply.status(404).send(error(404, '公告不存在'))
    }
    return reply.send(success({ announcement: ann }))
  })

  // POST /messages/announcements - 新建公告
  server.post('/messages/announcements', async (request, reply) => {
    const parsed = createAnnouncementSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const announcement = await createAnnouncement({
      ...parsed.data,
      publishTime: parsed.data.publishTime ? new Date(parsed.data.publishTime) : null,
    })
    return reply.status(201).send(success({ announcement }))
  })

  // PUT /messages/announcements/:id - 更新公告
  server.put('/messages/announcements/:id', async (request, reply) => {
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
  })

  // DELETE /messages/announcements/:id - 删除公告
  server.delete('/messages/announcements/:id', async (request, reply) => {
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
  })

  // GET /messages - 站内消息列表（admin 可按 memberId 筛选）
  server.get('/messages', async (request, reply) => {
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
  })

  // ----- System notice admin 系统通知管理 -----

  // POST /messages/system-notice - 发布系统通知
  server.post('/messages/system-notice', async (request, reply) => {
    const body = z.object({ content: z.string().min(1) }).parse(request.body)
    const [created] = await db
      .insert(messageSystemNotice)
      .values({ content: body.content })
      .returning()
    return reply.status(201).send(success({ notice: created }))
  })

  // DELETE /messages/system-notice/:nid - 删除系统通知
  server.delete('/messages/system-notice/:nid', async (request, reply) => {
    const { nid } = z.object({ nid: z.string() }).parse(request.params)
    await db.delete(messageSystemNotice).where(eq(messageSystemNotice.id, Number(nid)))
    return reply.send(success({ ok: true }))
  })

  // ----- Message templates 消息模板管理 -----

  // GET /messages/template/list - 消息模板列表
  server.get('/messages/template/list', async (request, reply) => {
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
  })

  // POST /messages/template - 新增消息模板
  server.post('/messages/template', async (request, reply) => {
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
  })
}
