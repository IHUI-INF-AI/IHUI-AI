import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { inArray, sql } from 'drizzle-orm'
import { users } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { db } from '../db/index.js'
import {
  findNotificationsByUser,
  countUnread,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  findConversations,
  findMessagesBetween,
  createMessage,
  createNotification,
  findAllNotificationsForAdmin,
  broadcastNotification,
  attachTopicToList,
} from '../db/notification-queries.js'
import { sendEmail } from '../services/email-service.js'
import { sendSmsMessage } from '../services/sms.js'
import { logAction } from '../services/audit-service.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

const ADMIN_ROLE_ID = 1

const NOTIFICATION_TYPES = ['system', 'order', 'project', 'comment', 'mention', 'follow'] as const

// =============================================================================
// Zod schemas
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const listNotificationsQuery = z.object({
  ...paginationQuery,
  type: z.preprocess(emptyToUndefined, z.enum(NOTIFICATION_TYPES).optional()),
  unread: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v === 'true'),
    z.boolean().optional(),
  ),
})

const listMessagesQuery = z.object(paginationQuery)

const adminListNotificationsQuery = z.object({
  ...paginationQuery,
  type: z.preprocess(emptyToUndefined, z.enum(NOTIFICATION_TYPES).optional()),
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
})

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })
const userIdParamSchema = z.object({ userId: z.string().uuid('无效的用户 ID') })

const sendMessageSchema = z.object({
  receiverId: z.string().uuid('无效的接收者 ID'),
  content: z.string().min(1, '内容不能为空').max(5000, '内容过长'),
})

const broadcastSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(5000),
  type: z.enum(NOTIFICATION_TYPES).default('system'),
})

const sendTargetedSchema = z
  .object({
    title: z.string().min(1).max(255),
    content: z.string().min(1).max(5000),
    userIds: z.array(z.string().uuid()).nullable(),
    roleFilter: z.array(z.string().min(1)).nullable(),
    channels: z.array(z.enum(['in_app', 'email', 'sms'])).min(1),
    msgType: z.enum(NOTIFICATION_TYPES),
  })
  .refine(
    (data) =>
      (data.userIds !== null && data.userIds.length > 0) ||
      (data.roleFilter !== null && data.roleFilter.length > 0),
    { message: 'userIds 和 roleFilter 至少提供一个非空数组' },
  )

// =============================================================================
// 路由
// =============================================================================

export const notificationRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有 notification / message 路由均需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  })

  // GET /notifications - 当前用户通知列表（分页 / type 筛选 / unread 只看未读）
  server.get(
    '/notifications',
    {
      schema: {
        summary: '通知列表',
        description: '分页查询当前用户通知列表,支持 type 筛选和 unread 只看未读',
        tags: ['notifications'],
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
            type: {
              type: 'string',
              enum: ['system', 'order', 'project', 'comment', 'mention', 'follow'],
              description: '通知类型筛选(可选)',
            },
            unread: { type: 'boolean', description: '仅查看未读(可选)' },
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
      const parsed = listNotificationsQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { page, pageSize, type, unread } = parsed.data
      const { list, total } = await findNotificationsByUser(request.userId!, {
        page,
        pageSize,
        type,
        unreadOnly: unread,
      })
      const unreadCount = await countUnread(request.userId!)
      const listWithTopic = await attachTopicToList(list)
      return reply.send(
        success({ list: listWithTopic, total, page, pageSize, unread: unreadCount }),
      )
    },
  )

  // GET /notifications/unread-count - 未读通知数
  server.get('/notifications/unread-count', async (request, reply) => {
    const count = await countUnread(request.userId!)
    return reply.send(success({ count }))
  })

  // PATCH /notifications/:id/read - 标记单条已读（仅本人）
  server.patch('/notifications/:id/read', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const updated = await markAsRead(parsed.data.id, request.userId!)
    if (!updated) {
      return reply.status(404).send(error(404, '通知不存在'))
    }
    return reply.send(success({ notification: updated }))
  })

  // POST /notifications/read-all - 标记全部已读
  server.post(
    '/notifications/read-all',
    {
      schema: {
        summary: '标记全部通知已读',
        description: '将当前用户所有未读通知标记为已读',
        tags: ['notifications'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const updatedCount = await markAllAsRead(request.userId!)
      return reply.send(success({ updatedCount }))
    },
  )

  // DELETE /notifications/:id - 删除通知（仅本人）
  server.delete('/notifications/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const deleted = await deleteNotification(parsed.data.id, request.userId!)
    if (!deleted) {
      return reply.status(404).send(error(404, '通知不存在'))
    }
    return reply.send(success({ id: parsed.data.id }))
  })

  // GET /conversations - 会话列表（每个对方最近一条 + 对方用户信息）
  server.get('/conversations', async (request, reply) => {
    const parsed = listMessagesQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const { list, total } = await findConversations(request.userId!, page, pageSize)
    return reply.send(success({ list, total, page, pageSize }))
  })

  // GET /conversations/:userId - 与某用户的消息历史（分页，时间正序）
  server.get('/conversations/:userId', async (request, reply) => {
    const parsed = userIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (parsed.data.userId === request.userId) {
      return reply.status(400).send(error(400, '不能查询与自己的会话'))
    }
    const parsedQ = listMessagesQuery.safeParse(request.query)
    if (!parsedQ.success) {
      return reply.status(400).send(error(400, parsedQ.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsedQ.data
    const { list, total } = await findMessagesBetween(
      request.userId!,
      parsed.data.userId,
      page,
      pageSize,
    )
    return reply.send(success({ list, total, page, pageSize }))
  })

  // POST /messages - 发送消息
  server.post('/conversations', async (request, reply) => {
    const parsed = sendMessageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { receiverId, content } = parsed.data
    if (receiverId === request.userId) {
      return reply.status(400).send(error(400, '不能给自己发消息'))
    }
    const message = await createMessage(request.userId!, receiverId, content)
    return reply.status(201).send(success({ message }))
  })

  // ===== Admin =====

  // GET /admin/notifications - 管理员分页查询所有通知
  server.get('/admin/notifications', async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'))
    }
    const parsed = adminListNotificationsQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, type, userId } = parsed.data
    const { list, total } = await findAllNotificationsForAdmin(page, pageSize, { type, userId })
    return reply.send(success({ list, total, page, pageSize }))
  })

  // POST /admin/notifications/broadcast - 管理员群发系统通知
  server.post(
    '/admin/notifications/broadcast',
    {
      schema: {
        summary: '群发系统通知',
        description: '管理员向所有用户群发系统通知(需 admin)',
        tags: ['notifications'],
        body: {
          type: 'object',
          required: ['title', 'content'],
          properties: {
            type: {
              type: 'string',
              enum: ['system', 'order', 'project', 'comment', 'mention', 'follow'],
              default: 'system',
              description: '通知类型(默认 system)',
            },
            title: { type: 'string', maxLength: 255, description: '通知标题' },
            content: { type: 'string', maxLength: 5000, description: '通知内容' },
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
        },
      },
    },
    async (request, reply) => {
      const roleId = request.jwtPayload?.roleId ?? 0
      if (roleId < ADMIN_ROLE_ID) {
        return reply.status(403).send(error(403, '需要管理员权限'))
      }
      const parsed = broadcastSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      // 异步广播策略:先查出所有用户,然后批量入队 notification 队列
      // 由 Worker 异步完成 DB 落库 + WebSocket 推送,避免大用户量时阻塞请求
      // 队列不可用时降级为同步直写(向后兼容)
      try {
        const allUsers = await db
          .select({ id: users.id, email: users.email, nickname: users.nickname })
          .from(users)
        if (allUsers.length === 0) {
          return reply.send(success({ sentCount: 0 }))
        }

        // 尝试异步入队(生产者)
        const notificationQueue = (
          server as unknown as {
            notificationQueue?: {
              addBulk: (jobs: { name: string; data: unknown }[]) => Promise<unknown>
            }
          }
        ).notificationQueue
        if (notificationQueue) {
          // 批量入队,Worker 会异步完成 DB 落库 + WebSocket 推送
          await notificationQueue.addBulk(
            allUsers.map((u) => ({
              name: 'broadcast',
              data: {
                userId: u.id,
                type: parsed.data.type,
                title: parsed.data.title,
                content: parsed.data.content,
                email: u.email ?? undefined,
                userName: u.nickname ?? u.email ?? '',
              },
            })),
          )
          return reply.send(success({ sentCount: allUsers.length, async: true }))
        }

        // 降级:队列不可用时同步直写(原逻辑)
        const created = await broadcastNotification(parsed.data)
        for (const n of created) {
          server.pushNotification(n.userId, n)
        }
        return reply.send(success({ sentCount: created.length, async: false }))
      } catch (e) {
        request.log.warn({ err: e }, 'broadcast notification failed, fallback to sync')
        // 最终降级:同步直写
        const created = await broadcastNotification(parsed.data)
        for (const n of created) {
          server.pushNotification(n.userId, n)
        }
        return reply.send(success({ sentCount: created.length, async: false, fallback: true }))
      }
    },
  )

  // POST /admin/notifications/send-targeted - 定向分群多渠道派发通知
  server.distributedRateLimit.addRule({
    name: 'notification-send-targeted',
    limit: 1,
    windowSec: 60,
    scope: 'user',
  })
  server.post(
    '/admin/notifications/send-targeted',
    {
      preHandler: [server.distributedRateLimit.preHandler('notification-send-targeted')],
      schema: {
        summary: '定向分群多渠道派发通知',
        description: '管理员向指定用户或按角色筛选的用户派发通知,支持 in_app/email/sms 多渠道',
        tags: ['notifications'],
        body: {
          type: 'object',
          required: ['title', 'content', 'channels', 'msgType'],
          properties: {
            title: { type: 'string', maxLength: 255 },
            content: { type: 'string', maxLength: 5000 },
            userIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              nullable: true,
              description: '指定用户 ID 列表(为 null 时按 roleFilter)',
            },
            roleFilter: {
              type: 'array',
              items: { type: 'string' },
              nullable: true,
              description: '按角色筛选(角色名如 admin/teacher,或 legacy 数值角色 ID 字符串)',
            },
            channels: {
              type: 'array',
              items: { type: 'string', enum: ['in_app', 'email', 'sms'] },
              minItems: 1,
            },
            msgType: {
              type: 'string',
              enum: ['system', 'order', 'project', 'comment', 'mention', 'follow'],
            },
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
        },
      },
    },
    async (request, reply) => {
      const roleId = request.jwtPayload?.roleId ?? 0
      if (roleId < ADMIN_ROLE_ID) {
        return reply.status(403).send(error(403, '需要管理员权限'))
      }
      const parsed = sendTargetedSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { title, content, userIds, roleFilter, channels, msgType } = parsed.data

      // 1. 确定目标用户列表
      let targetUsers: {
        id: string
        email: string | null
        phone: string | null
        nickname: string | null
      }[]

      if (userIds !== null) {
        targetUsers = await db
          .select({
            id: users.id,
            email: users.email,
            phone: users.phone,
            nickname: users.nickname,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      } else {
        const rolesList = roleFilter!
        const numericRoleIds = rolesList.filter((r) => /^\d+$/.test(r)).map(Number)
        const roleNames = rolesList.filter((r) => !/^\d+$/.test(r))
        const rows = await db.execute(sql`
          SELECT DISTINCT u.id, u.email, u.phone, u.nickname
          FROM users u
          WHERE u.status = 1
            AND (
              ${numericRoleIds.length > 0 ? sql`u.role_id = ANY(${numericRoleIds}::int[])` : sql`FALSE`}
              OR EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = u.id AND r.name = ANY(${roleNames}::text[])
              )
            )
        `)
        targetUsers = rows as unknown as typeof targetUsers
      }

      if (targetUsers.length === 0) {
        return reply.send(success({ sent: 0, failed: 0, skipped: 0, queued: 0 }))
      }

      // 2. 批量查询用户通知偏好(避免 N+1)
      const allUserIds = targetUsers.map((u) => u.id)
      const prefRows = await db.execute(sql`
        SELECT user_id, email_enabled, sms_enabled, in_app_enabled, types
        FROM notification_preferences
        WHERE user_id = ANY(${allUserIds}::uuid[])
      `)
      const prefMap = new Map<
        string,
        {
          emailEnabled: boolean
          smsEnabled: boolean
          inAppEnabled: boolean
          types: string[] | null
        }
      >()
      for (const row of prefRows as Array<Record<string, unknown>>) {
        prefMap.set(row.user_id as string, {
          emailEnabled: row.email_enabled as boolean,
          smsEnabled: row.sms_enabled as boolean,
          inAppEnabled: row.in_app_enabled as boolean,
          types: row.types as string[] | null,
        })
      }

      // 3. 逐用户逐渠道派发
      let sent = 0
      let failed = 0
      let skipped = 0
      let queued = 0
      const dispatchQueue = server.notificationDispatchQueue
      const logEntries: {
        userId: string
        channel: string
        status: string
        errorMessage: string | null
      }[] = []

      for (const user of targetUsers) {
        const pref = prefMap.get(user.id)
        const isTypeAllowed = !pref?.types || pref.types.includes(msgType)

        for (const channel of channels) {
          if (pref) {
            if (channel === 'in_app' && !pref.inAppEnabled) {
              skipped++
              continue
            }
            if (channel === 'email' && !pref.emailEnabled) {
              skipped++
              continue
            }
            if (channel === 'sms' && !pref.smsEnabled) {
              skipped++
              continue
            }
          }
          if (!isTypeAllowed) {
            skipped++
            continue
          }

          try {
            if (channel === 'in_app') {
              const notification = await createNotification({
                userId: user.id,
                type: msgType,
                title,
                content,
              })
              server.pushNotification(user.id, notification)
              sent++
              logEntries.push({
                userId: user.id,
                channel: 'in_app',
                status: 'sent',
                errorMessage: null,
              })
            } else if (channel === 'email') {
              if (!user.email) {
                skipped++
                continue
              }
              if (dispatchQueue) {
                await dispatchQueue.add('send-targeted', {
                  userId: user.id,
                  channel: 'email',
                  email: user.email,
                  phone: user.phone,
                  nickname: user.nickname,
                  title,
                  content,
                  msgType,
                })
                queued++
              } else {
                const result = await sendEmail({
                  to: user.email,
                  subject: title,
                  html: `<h2>Hi ${user.nickname ?? user.email},</h2><p>${content}</p>`,
                  text: content,
                })
                if (result.sent || result.stub) {
                  sent++
                  logEntries.push({
                    userId: user.id,
                    channel: 'email',
                    status: result.stub ? 'stub' : 'sent',
                    errorMessage: null,
                  })
                } else {
                  failed++
                  logEntries.push({
                    userId: user.id,
                    channel: 'email',
                    status: 'failed',
                    errorMessage: result.error ?? null,
                  })
                }
              }
            } else if (channel === 'sms') {
              if (!user.phone) {
                skipped++
                continue
              }
              if (dispatchQueue) {
                await dispatchQueue.add('send-targeted', {
                  userId: user.id,
                  channel: 'sms',
                  email: user.email,
                  phone: user.phone,
                  nickname: user.nickname,
                  title,
                  content,
                  msgType,
                })
                queued++
              } else {
                const result = await sendSmsMessage(user.phone, content)
                if (result.success) {
                  sent++
                  logEntries.push({
                    userId: user.id,
                    channel: 'sms',
                    status: 'sent',
                    errorMessage: null,
                  })
                } else {
                  failed++
                  logEntries.push({
                    userId: user.id,
                    channel: 'sms',
                    status: 'failed',
                    errorMessage: result.error ?? null,
                  })
                }
              }
            }
          } catch (e) {
            failed++
            logEntries.push({
              userId: user.id,
              channel,
              status: 'failed',
              errorMessage: (e as Error).message,
            })
          }
        }
      }

      // 4. 批量记录发送日志(in_app + 降级同步; 队列任务由 Worker 写入)
      if (logEntries.length > 0) {
        try {
          const values = logEntries.map(
            (e) =>
              sql`(${e.userId}::uuid, ${msgType}, ${title}, ${content}, ${e.channel}, ${e.status}, ${e.errorMessage}, NOW())`,
          )
          await db.execute(sql`
            INSERT INTO notification_logs (user_id, type, title, content, channel, status, error_message, created_at)
            VALUES ${sql.join(values, sql`, `)}
          `)
        } catch (e) {
          request.log.warn({ err: e }, '批量写入 notification_logs 失败')
        }
      }

      // 5. 审计日志(业务级,记录管理员定向通知操作)
      await logAction({
        userId: request.userId,
        action: 'notification.send_targeted',
        resourceType: userIds !== null ? 'user' : 'role',
        details: { userIds, roleFilter, title, channels, sent, failed, skipped, queued },
        ip: request.ip,
        userAgent: request.headers['user-agent']?.slice(0, 512),
      })

      return reply.send(success({ sent, failed, skipped, queued }))
    },
  )
}
