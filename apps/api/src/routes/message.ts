import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
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
} from '../db/message-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

// =============================================================================
// Zod schemas
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

const announcementListQuery = z.object({
  ...paginationQuery,
  title: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  isPublished: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
});

const messageListQuery = z.object({
  ...paginationQuery,
  msgType: z.preprocess(emptyToUndefined, z.string().min(1).max(32).optional()),
  isRead: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
});

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

const createAnnouncementSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长'),
  content: z.string().max(20000).nullable().optional(),
  isPublished: z.boolean().optional(),
  isTop: z.boolean().optional(),
  publishTime: z.string().datetime().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
});

const updateAnnouncementSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长').optional(),
  content: z.string().max(20000).nullable().optional(),
  isPublished: z.boolean().optional(),
  isTop: z.boolean().optional(),
  publishTime: z.string().datetime().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
});

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    await authenticate(request);
    return true;
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
    const message = (e as Error).message || 'Authentication required';
    reply.status(statusCode).send(error(statusCode, message));
    return false;
  }
}

async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    await authenticate(request);
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
    const message = (e as Error).message || 'Authentication required';
    reply.status(statusCode).send(error(statusCode, message));
    return false;
  }
  const roleId = request.jwtPayload?.roleId ?? 0;
  if (roleId < ADMIN_ROLE_ID) {
    reply.status(403).send(error(403, '需要管理员权限'));
    return false;
  }
  return true;
}

// =============================================================================
// 公共路由（前缀 /api，需登录）
// =============================================================================

export const messageRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // GET /messages/announcements - 已发布公告列表
  server.get('/messages/announcements', async (request, reply) => {
    const parsed = announcementListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findAnnouncements({ ...parsed.data, publishedOnly: true });
    return reply.send(success(result));
  });

  // GET /messages/announcements/:id - 公告详情
  server.get('/messages/announcements/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const ann = await findAnnouncementById(parsed.data.id);
    if (!ann || !ann.isPublished || ann.status !== 1) {
      return reply.status(404).send(error(404, '公告不存在'));
    }
    return reply.send(success({ announcement: ann }));
  });

  // GET /messages - 当前用户站内消息列表
  server.get('/messages', async (request, reply) => {
    const parsed = messageListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const userId = request.userId!;
    const result = await findEduMessages({ ...parsed.data, memberId: userId });
    return reply.send(success(result));
  });

  // GET /messages/unread-count - 未读消息数
  server.get('/messages/unread-count', async (request, reply) => {
    const userId = request.userId!;
    const count = await countUnreadEduMessages(userId);
    return reply.send(success({ count }));
  });

  // PUT /messages/:id/read - 标记消息已读
  server.put('/messages/:id/read', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const msg = await findEduMessageById(parsed.data.id);
    if (!msg || msg.memberId !== request.userId) {
      return reply.status(404).send(error(404, '消息不存在'));
    }
    const updated = await markEduMessageRead(parsed.data.id);
    return reply.send(success({ message: updated }));
  });
};

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminMessageRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return;
  });

  // GET /messages/announcements - 公告列表（含未发布）
  server.get('/messages/announcements', async (request, reply) => {
    const parsed = announcementListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findAnnouncements(parsed.data);
    return reply.send(success(result));
  });

  // GET /messages/announcements/:id - 公告详情
  server.get('/messages/announcements/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const ann = await findAnnouncementById(parsed.data.id);
    if (!ann) {
      return reply.status(404).send(error(404, '公告不存在'));
    }
    return reply.send(success({ announcement: ann }));
  });

  // POST /messages/announcements - 新建公告
  server.post('/messages/announcements', async (request, reply) => {
    const parsed = createAnnouncementSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const announcement = await createAnnouncement({
      ...parsed.data,
      publishTime: parsed.data.publishTime ? new Date(parsed.data.publishTime) : null,
    });
    return reply.status(201).send(success({ announcement }));
  });

  // PUT /messages/announcements/:id - 更新公告
  server.put('/messages/announcements/:id', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateAnnouncementSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findAnnouncementById(idParsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '公告不存在'));
    }
    const announcement = await updateAnnouncement(idParsed.data.id, {
      ...parsed.data,
      publishTime: parsed.data.publishTime ? new Date(parsed.data.publishTime) : null,
    });
    return reply.send(success({ announcement }));
  });

  // DELETE /messages/announcements/:id - 删除公告
  server.delete('/messages/announcements/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findAnnouncementById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '公告不存在'));
    }
    await deleteAnnouncement(parsed.data.id);
    return reply.send(success({ ok: true }));
  });

  // GET /messages - 站内消息列表（admin 可按 memberId 筛选）
  server.get('/messages', async (request, reply) => {
    const parsed = z
      .object({
        ...paginationQuery,
        memberId: z.preprocess(emptyToUndefined, z.string().uuid('无效的用户 ID').optional()),
        msgType: z.preprocess(emptyToUndefined, z.string().min(1).max(32).optional()),
        isRead: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
      })
      .safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findEduMessages(parsed.data);
    return reply.send(success(result));
  });
};
