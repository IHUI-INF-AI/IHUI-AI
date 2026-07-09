import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  recordWatch,
  getWatchCount,
  findWatchList,
  deleteWatch,
  clearAllWatch,
  getBehaviorStatistics,
  findAllWatchList,
} from '../db/behavior-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

// =============================================================================
// Zod schemas
// =============================================================================

const recordWatchSchema = z.object({
  topicId: z.string().min(1).max(128),
  topicType: z.string().min(1).max(50),
  topicTitle: z.string().max(200).optional(),
  watchDuration: z.number().int().min(0).default(0),
  lastPosition: z.number().int().min(0).default(0),
});

const watchCountQuery = z.object({
  topicId: z.string().min(1).max(128),
  topicType: z.string().min(1).max(50),
});

const myWatchListQuery = z.object({
  topicType: z.preprocess(emptyToUndefined, z.string().min(1).max(50).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const deleteWatchQuery = z.object({
  id: z.string().uuid('无效的 ID'),
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

const clearWatchQuery = z.object({
  userId: z.string().uuid('无效的用户 ID'),
});

const adminWatchListQuery = z.object({
  topicType: z.preprocess(emptyToUndefined, z.string().min(1).max(50).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
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

const dataObjSchema = {
  type: 'object',
  properties: {
    code: { type: 'number' },
    message: { type: 'string' },
    data: { type: 'object', additionalProperties: true },
  },
} as const;

// =============================================================================
// 公共路由（前缀 /api，需登录，记录+查询浏览）
// =============================================================================

export const behaviorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // POST /behavior/watch - 记录浏览
  server.post('/behavior/watch', {
    schema: {
      summary: '记录浏览',
      tags: ['behavior'],
      body: {
        type: 'object',
        properties: {
          topicId: { type: 'string', description: '目标 ID' },
          topicType: { type: 'string', description: '目标类型: lesson/news/article/resource' },
          topicTitle: { type: 'string', description: '目标标题' },
          watchDuration: { type: 'integer', minimum: 0, description: '观看时长(秒)' },
          lastPosition: { type: 'integer', minimum: 0, description: '上次位置' },
        },
      },
      response: { 200: dataObjSchema, 400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const parsed = recordWatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await recordWatch({ ...parsed.data, userId: request.userId! });
    return reply.send(success(result));
  });

  // GET /behavior/watch/count - 浏览计数
  server.get('/behavior/watch/count', {
    schema: {
      summary: '浏览计数',
      tags: ['behavior'],
      querystring: {
        type: 'object',
        properties: {
          topicId: { type: 'string', description: '目标 ID' },
          topicType: { type: 'string', description: '目标类型' },
        },
      },
      response: { 200: dataObjSchema, 400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const parsed = watchCountQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const count = await getWatchCount(parsed.data.topicId, parsed.data.topicType);
    return reply.send(success({ topicId: parsed.data.topicId, topicType: parsed.data.topicType, count }));
  });

  // GET /behavior/watch/list - 我的浏览记录列表
  server.get('/behavior/watch/list', {
    schema: {
      summary: '我的浏览记录列表',
      tags: ['behavior'],
      querystring: {
        type: 'object',
        properties: {
          topicType: { type: 'string', description: '目标类型筛选' },
          page: { type: 'integer', minimum: 1, default: 1 },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
      response: { 200: dataObjSchema, 400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const parsed = myWatchListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findWatchList({ ...parsed.data, userId: request.userId! });
    return reply.send(success(result));
  });

  // DELETE /behavior/watch - 删除浏览记录
  server.delete('/behavior/watch', {
    schema: {
      summary: '删除浏览记录',
      tags: ['behavior'],
      querystring: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', description: '浏览记录 ID' },
          userId: { type: 'string', format: 'uuid', description: '会员 ID(传入则校验归属)' },
        },
      },
      response: {
        200: dataObjSchema,
        400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
        404: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const parsed = deleteWatchQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const deleted = await deleteWatch(parsed.data.id, parsed.data.userId);
    if (!deleted) return reply.status(404).send(error(404, '浏览记录不存在'));
    return reply.send(success({ id: parsed.data.id, deleted: true }));
  });

  // DELETE /behavior/watch/all - 清空浏览记录
  server.delete('/behavior/watch/all', {
    schema: {
      summary: '清空浏览记录',
      tags: ['behavior'],
      querystring: {
        type: 'object',
        properties: { userId: { type: 'string', format: 'uuid', description: '会员 ID' } },
      },
      response: { 200: dataObjSchema, 400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const parsed = clearWatchQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const deleted = await clearAllWatch(parsed.data.userId);
    return reply.send(success({ deleted }));
  });
};

// =============================================================================
// 管理员路由（前缀 /api/admin，行为统计与全量浏览记录）
// =============================================================================

export const adminBehaviorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return;
  });

  // GET /behavior/statistics - 行为统计
  server.get('/behavior/statistics', {
    schema: {
      summary: '行为统计',
      tags: ['behavior'],
      response: { 200: dataObjSchema },
    },
  }, async (_request, reply) => {
    const statistics = await getBehaviorStatistics();
    return reply.send(success({ statistics }));
  });

  // GET /behavior/watch/list - 全量浏览记录列表
  server.get('/behavior/watch/list', {
    schema: {
      summary: '全量浏览记录列表',
      tags: ['behavior'],
      querystring: {
        type: 'object',
        properties: {
          topicType: { type: 'string', description: '目标类型筛选' },
          page: { type: 'integer', minimum: 1, default: 1 },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
      response: { 200: dataObjSchema, 400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const parsed = adminWatchListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findAllWatchList(parsed.data);
    return reply.send(success(result));
  });
};
