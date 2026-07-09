import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  findComments,
  createComment,
  findCommentById,
  updateComment,
  softDeleteComment,
  likeComment,
  unlikeComment,
  findReplies,
  createFeedback,
  findFeedbacksByUser,
  findFeedbackById,
  findAllFeedbacksForAdmin,
  updateFeedback,
} from '../db/comment-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

const RESOURCE_TYPES = ['project', 'file', 'doc', 'post'] as const;
const FEEDBACK_TYPES = ['bug', 'feature', 'improvement', 'other'] as const;
const FEEDBACK_STATUSES = ['pending', 'reviewing', 'resolved', 'closed'] as const;
const FEEDBACK_PRIORITIES = ['low', 'medium', 'high'] as const;

// =============================================================================
// Zod schemas
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

const listCommentsQuery = z.object({
  ...paginationQuery,
  resourceType: z.enum(RESOURCE_TYPES),
  resourceId: z.string().min(1).max(128),
  parentId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

const createCommentSchema = z.object({
  resourceType: z.enum(RESOURCE_TYPES),
  resourceId: z.string().min(1).max(128),
  parentId: z.string().uuid().optional().nullable(),
  content: z.string().min(1, '内容不能为空').max(5000, '内容过长'),
  mentions: z.array(z.string().uuid()).max(50).optional(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1, '内容不能为空').max(5000, '内容过长'),
});

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

const paginationOnlyQuery = z.object(paginationQuery);

const createFeedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  title: z.string().min(1, '标题不能为空').max(255),
  content: z.string().min(1, '内容不能为空').max(10000),
  contact: z.string().max(255).optional().nullable(),
});

const adminListFeedbacksQuery = z.object({
  ...paginationQuery,
  type: z.preprocess(emptyToUndefined, z.enum(FEEDBACK_TYPES).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(FEEDBACK_STATUSES).optional()),
});

const adminUpdateFeedbackSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES).optional(),
  priority: z.enum(FEEDBACK_PRIORITIES).optional(),
  adminReply: z.string().max(10000).optional().nullable(),
});

// =============================================================================
// 路由
// =============================================================================

export const commentRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有 comments / feedbacks 路由均需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      const message = (e as Error).message || 'Authentication required';
      return reply.status(statusCode).send(error(statusCode, message));
    }
  });

  // ===== Comments =====

  // GET /comments - 评论列表（顶级或某父的子评论），带 repliesCount / likeCount / likedByMe
  server.get('/comments', {
    schema: {
      summary: '评论列表',
      tags: ['comments'],
      querystring: {
        type: 'object',
        properties: {
          resourceType: { type: 'string', description: '资源类型(project/file/doc/post)' },
          resourceId: { type: 'string', description: '资源 ID' },
          parentId: { type: 'string', description: '父评论 ID(可选,查询子评论)' },
          page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: '每页数量(1-100,默认 20)' },
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
  }, async (request, reply) => {
    const parsed = listCommentsQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, resourceType, resourceId, parentId } = parsed.data;
    const { list, total } = await findComments({
      resourceType,
      resourceId,
      parentId: parentId ?? null,
      page,
      pageSize,
      currentUserId: request.userId,
    });
    return reply.send(success({ list, total, page, pageSize }));
  });

  // POST /comments - 创建评论
  server.post('/comments', {
    schema: {
      summary: '创建评论',
      tags: ['comments'],
      body: {
        type: 'object',
        properties: {
          resourceType: { type: 'string', description: '资源类型(project/file/doc/post)' },
          resourceId: { type: 'string', description: '资源 ID' },
          parentId: { type: 'string', description: '父评论 ID(可选)' },
          content: { type: 'string', description: '评论内容' },
          mentions: { type: 'array', items: { type: 'string' }, description: '@用户 ID 列表(可选)' },
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
        404: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = createCommentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { resourceType, resourceId, parentId, content, mentions } = parsed.data;
    // 若指定 parentId，校验父评论存在且属于同一资源
    if (parentId) {
      const parent = await findCommentById(parentId);
      if (!parent) {
        return reply.status(404).send(error(404, '父评论不存在'));
      }
      if (parent.resourceType !== resourceType || parent.resourceId !== resourceId) {
        return reply.status(400).send(error(400, '父评论资源不匹配'));
      }
    }
    const comment = await createComment({
      userId: request.userId!,
      resourceType,
      resourceId,
      parentId,
      content,
      mentions,
    });
    return reply.status(201).send(success({ comment }));
  });

  // GET /comments/:id - 单条评论详情
  server.get('/comments/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const comment = await findCommentById(parsed.data.id, request.userId);
    if (!comment) {
      return reply.status(404).send(error(404, '评论不存在'));
    }
    return reply.send(success({ comment }));
  });

  // PATCH /comments/:id - 编辑评论（仅本人，且未删除）
  server.patch('/comments/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const body = updateCommentSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findCommentById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '评论不存在'));
    }
    if (existing.userId !== request.userId) {
      return reply.status(403).send(error(403, '只能编辑自己的评论'));
    }
    if (existing.isDeleted) {
      return reply.status(400).send(error(400, '已删除的评论无法编辑'));
    }
    const updated = await updateComment(parsed.data.id, request.userId!, body.data.content);
    return reply.send(success({ comment: updated }));
  });

  // DELETE /comments/:id - 软删除评论（仅本人或 admin）
  server.delete('/comments/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findCommentById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '评论不存在'));
    }
    const roleId = request.jwtPayload?.roleId ?? 0;
    if (existing.userId !== request.userId && roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '无权删除该评论'));
    }
    if (existing.isDeleted) {
      return reply.send(success({ id: parsed.data.id, isDeleted: true }));
    }
    await softDeleteComment(parsed.data.id);
    return reply.send(success({ id: parsed.data.id, isDeleted: true }));
  });

  // POST /comments/:id/like - 点赞（幂等）
  server.post('/comments/:id/like', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findCommentById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '评论不存在'));
    }
    await likeComment(parsed.data.id, request.userId!);
    return reply.status(201).send(success({ liked: true }));
  });

  // DELETE /comments/:id/like - 取消点赞
  server.delete('/comments/:id/like', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    await unlikeComment(parsed.data.id, request.userId!);
    return reply.send(success({ liked: false }));
  });

  // GET /comments/:id/replies - 回复列表（分页，时间正序）
  server.get('/comments/:id/replies', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsedQ = paginationOnlyQuery.safeParse(request.query);
    if (!parsedQ.success) {
      return reply.status(400).send(error(400, parsedQ.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize } = parsedQ.data;
    const parent = await findCommentById(parsed.data.id);
    if (!parent) {
      return reply.status(404).send(error(404, '评论不存在'));
    }
    const { list, total } = await findReplies(parsed.data.id, {
      page,
      pageSize,
      currentUserId: request.userId,
    });
    return reply.send(success({ list, total, page, pageSize }));
  });

  // ===== Feedbacks =====

  // POST /feedbacks - 提交反馈
  server.post('/feedbacks', {
    schema: {
      summary: '提交反馈',
      tags: ['comments'],
      body: {
        type: 'object',
        properties: {
          type: { type: 'string', description: '反馈类型(bug/feature/improvement/other)' },
          title: { type: 'string', description: '标题' },
          content: { type: 'string', description: '内容' },
          contact: { type: 'string', description: '联系方式(可选)' },
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
  }, async (request, reply) => {
    const parsed = createFeedbackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { type, title, content, contact } = parsed.data;
    const feedback = await createFeedback({
      userId: request.userId!,
      type,
      title,
      content,
      contact,
    });
    return reply.status(201).send(success({ feedback }));
  });

  // GET /feedbacks - 当前用户反馈列表（分页）
  server.get('/feedbacks', {
    schema: {
      summary: '反馈列表',
      tags: ['comments'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: '每页数量(1-100,默认 20)' },
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
  }, async (request, reply) => {
    const parsed = paginationOnlyQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize } = parsed.data;
    const { list, total } = await findFeedbacksByUser(request.userId!, page, pageSize);
    return reply.send(success({ list, total, page, pageSize }));
  });

  // GET /feedbacks/:id - 反馈详情（仅本人或 admin）
  server.get('/feedbacks/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const feedback = await findFeedbackById(parsed.data.id);
    if (!feedback) {
      return reply.status(404).send(error(404, '反馈不存在'));
    }
    const roleId = request.jwtPayload?.roleId ?? 0;
    if (feedback.userId !== request.userId && roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '无权查看该反馈'));
    }
    return reply.send(success({ feedback }));
  });

  // ===== Admin: Feedbacks =====

  // GET /admin/feedbacks - 管理员分页查询所有反馈（支持 type/status 筛选）
  server.get('/admin/feedbacks', async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0;
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'));
    }
    const parsed = adminListFeedbacksQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, type, status } = parsed.data;
    const { list, total } = await findAllFeedbacksForAdmin(page, pageSize, { type, status });
    return reply.send(success({ list, total, page, pageSize }));
  });

  // PATCH /admin/feedbacks/:id - 管理员更新反馈状态/优先级/回复
  server.patch('/admin/feedbacks/:id', async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0;
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'));
    }
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const body = adminUpdateFeedbackSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findFeedbackById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '反馈不存在'));
    }
    const updated = await updateFeedback(parsed.data.id, body.data);
    return reply.send(success({ feedback: updated }));
  });
};
