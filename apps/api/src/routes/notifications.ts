import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { users } from '@ihui/database';
import { authenticate } from '../plugins/auth.js';
import { db } from '../db/index.js';
import {
  findNotificationsByUser,
  countUnread,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  findConversations,
  findMessagesBetween,
  createMessage,
  findAllNotificationsForAdmin,
  broadcastNotification,
} from '../db/notification-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

const NOTIFICATION_TYPES = ['system', 'order', 'project', 'comment', 'mention', 'follow'] as const;

// =============================================================================
// Zod schemas
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

const listNotificationsQuery = z.object({
  ...paginationQuery,
  type: z.preprocess(emptyToUndefined, z.enum(NOTIFICATION_TYPES).optional()),
  unread: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v === 'true'),
    z.boolean().optional(),
  ),
});

const listMessagesQuery = z.object(paginationQuery);

const adminListNotificationsQuery = z.object({
  ...paginationQuery,
  type: z.preprocess(emptyToUndefined, z.enum(NOTIFICATION_TYPES).optional()),
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') });
const userIdParamSchema = z.object({ userId: z.string().uuid('无效的用户 ID') });

const sendMessageSchema = z.object({
  receiverId: z.string().uuid('无效的接收者 ID'),
  content: z.string().min(1, '内容不能为空').max(5000, '内容过长'),
});

const broadcastSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(5000),
  type: z.enum(NOTIFICATION_TYPES).default('system'),
});

// =============================================================================
// 路由
// =============================================================================

export const notificationRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有 notification / message 路由均需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      const message = (e as Error).message || 'Authentication required';
      return reply.status(statusCode).send(error(statusCode, message));
    }
  });

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
    const parsed = listNotificationsQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, type, unread } = parsed.data;
    const { list, total } = await findNotificationsByUser(request.userId!, {
      page,
      pageSize,
      type,
      unreadOnly: unread,
    });
    const unreadCount = await countUnread(request.userId!);
    return reply.send(success({ list, total, page, pageSize, unread: unreadCount }));
    },
  );

  // GET /notifications/unread-count - 未读通知数
  server.get('/notifications/unread-count', async (request, reply) => {
    const count = await countUnread(request.userId!);
    return reply.send(success({ count }));
  });

  // PATCH /notifications/:id/read - 标记单条已读（仅本人）
  server.patch('/notifications/:id/read', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const updated = await markAsRead(parsed.data.id, request.userId!);
    if (!updated) {
      return reply.status(404).send(error(404, '通知不存在'));
    }
    return reply.send(success({ notification: updated }));
  });

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
      const updatedCount = await markAllAsRead(request.userId!);
      return reply.send(success({ updatedCount }));
    },
  );

  // DELETE /notifications/:id - 删除通知（仅本人）
  server.delete('/notifications/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const deleted = await deleteNotification(parsed.data.id, request.userId!);
    if (!deleted) {
      return reply.status(404).send(error(404, '通知不存在'));
    }
    return reply.send(success({ id: parsed.data.id }));
  });

  // GET /conversations - 会话列表（每个对方最近一条 + 对方用户信息）
  server.get('/conversations', async (request, reply) => {
    const parsed = listMessagesQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize } = parsed.data;
    const { list, total } = await findConversations(request.userId!, page, pageSize);
    return reply.send(success({ list, total, page, pageSize }));
  });

  // GET /conversations/:userId - 与某用户的消息历史（分页，时间正序）
  server.get('/conversations/:userId', async (request, reply) => {
    const parsed = userIdParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    if (parsed.data.userId === request.userId) {
      return reply.status(400).send(error(400, '不能查询与自己的会话'));
    }
    const parsedQ = listMessagesQuery.safeParse(request.query);
    if (!parsedQ.success) {
      return reply.status(400).send(error(400, parsedQ.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize } = parsedQ.data;
    const { list, total } = await findMessagesBetween(
      request.userId!,
      parsed.data.userId,
      page,
      pageSize,
    );
    return reply.send(success({ list, total, page, pageSize }));
  });

  // POST /messages - 发送消息
  server.post('/conversations', async (request, reply) => {
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { receiverId, content } = parsed.data;
    if (receiverId === request.userId) {
      return reply.status(400).send(error(400, '不能给自己发消息'));
    }
    const message = await createMessage(request.userId!, receiverId, content);
    return reply.status(201).send(success({ message }));
  });

  // ===== Admin =====

  // GET /admin/notifications - 管理员分页查询所有通知
  server.get('/admin/notifications', async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0;
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'));
    }
    const parsed = adminListNotificationsQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, type, userId } = parsed.data;
    const { list, total } = await findAllNotificationsForAdmin(page, pageSize, { type, userId });
    return reply.send(success({ list, total, page, pageSize }));
  });

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
      const roleId = request.jwtPayload?.roleId ?? 0;
      if (roleId < ADMIN_ROLE_ID) {
        return reply.status(403).send(error(403, '需要管理员权限'));
      }
      const parsed = broadcastSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }

      // 异步广播策略:先查出所有用户,然后批量入队 notification 队列
      // 由 Worker 异步完成 DB 落库 + WebSocket 推送,避免大用户量时阻塞请求
      // 队列不可用时降级为同步直写(向后兼容)
      try {
        const allUsers = await db.select({ id: users.id, email: users.email, nickname: users.nickname }).from(users);
        if (allUsers.length === 0) {
          return reply.send(success({ sentCount: 0 }));
        }

        // 尝试异步入队(生产者)
        const notificationQueue = (server as unknown as { notificationQueue?: { addBulk: (jobs: { name: string; data: unknown }[]) => Promise<unknown> } }).notificationQueue;
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
          );
          return reply.send(success({ sentCount: allUsers.length, async: true }));
        }

        // 降级:队列不可用时同步直写(原逻辑)
        const created = await broadcastNotification(parsed.data);
        for (const n of created) {
          server.pushNotification(n.userId, n);
        }
        return reply.send(success({ sentCount: created.length, async: false }));
      } catch (e) {
        request.log.warn({ err: e }, 'broadcast notification failed, fallback to sync');
        // 最终降级:同步直写
        const created = await broadcastNotification(parsed.data);
        for (const n of created) {
          server.pushNotification(n.userId, n);
        }
        return reply.send(success({ sentCount: created.length, async: false, fallback: true }));
      }
    },
  );
};
