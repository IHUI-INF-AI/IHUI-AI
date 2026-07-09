import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  findTopics,
  findTopicById,
  findTopicDetail,
  createTopic,
  updateTopic,
  deleteTopic,
} from '../db/topic-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

// =============================================================================
// Zod schemas
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

const topicListQuery = z.object({
  ...paginationQuery,
  title: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  isPublished: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
});

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

const lessonIdsSchema = z.array(z.string().uuid('无效的课程 ID')).max(200).optional().nullable();

const createTopicSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长'),
  coverImage: z.string().max(512).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  lessonIds: lessonIdsSchema,
  isPublished: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
});

const updateTopicSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长').optional(),
  coverImage: z.string().max(512).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  lessonIds: lessonIdsSchema,
  isPublished: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
});

// =============================================================================
// 鉴权辅助
// =============================================================================

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

export const topicRoutes: FastifyPluginAsync = async (server) => {
  // GET /topics - 已发布专题列表（公开）
  server.get('/topics', async (request, reply) => {
    const parsed = topicListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findTopics({ ...parsed.data, publishedOnly: true });
    return reply.send(success(result));
  });

  // GET /topics/:id - 专题详情（含关联课程）
  server.get('/topics/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const topic = await findTopicById(parsed.data.id);
    if (!topic || !topic.isPublished || topic.status !== 1) {
      return reply.status(404).send(error(404, '专题不存在'));
    }
    const detail = await findTopicDetail(parsed.data.id);
    return reply.send(success({ topic: detail }));
  });
};

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminTopicRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return;
  });

  // GET /topics - 专题列表（含未发布）
  server.get('/topics', async (request, reply) => {
    const parsed = topicListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findTopics(parsed.data);
    return reply.send(success(result));
  });

  // GET /topics/:id - 专题详情
  server.get('/topics/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const topic = await findTopicDetail(parsed.data.id);
    if (!topic) {
      return reply.status(404).send(error(404, '专题不存在'));
    }
    return reply.send(success({ topic }));
  });

  // POST /topics - 新建专题
  server.post('/topics', async (request, reply) => {
    const parsed = createTopicSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const topic = await createTopic(parsed.data);
    return reply.status(201).send(success({ topic }));
  });

  // PUT /topics/:id - 更新专题
  server.put('/topics/:id', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateTopicSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findTopicById(idParsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '专题不存在'));
    }
    const topic = await updateTopic(idParsed.data.id, parsed.data);
    return reply.send(success({ topic }));
  });

  // DELETE /topics/:id - 删除专题
  server.delete('/topics/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findTopicById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '专题不存在'));
    }
    await deleteTopic(parsed.data.id);
    return reply.send(success({ ok: true }));
  });
};
