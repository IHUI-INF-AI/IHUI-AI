import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  getLearnStatistics,
  getExamStatistics,
  getContentStatistics,
  getOverviewStatistics,
  findStatisticsSnapshots,
  findStatisticsSnapshotById,
  createStatisticsSnapshot,
  deleteStatisticsSnapshot,
  getMessageStatistics,
  getLiveStatistics,
  getPointStatistics,
  getResourceStatistics,
  getUserCenterStatistics,
  findVisitLogList,
} from '../db/statistics-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

// =============================================================================
// Zod schemas
// =============================================================================

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

const listSnapshotsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.preprocess(emptyToUndefined, z.string().min(1).max(50).optional()),
});

const createSnapshotSchema = z.object({
  type: z.enum(['overview', 'learn', 'exam', 'content']),
  data: z.record(z.unknown()).optional(),
});

const visitLogsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  startTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
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
// 公共路由（前缀 /api，需登录，只读聚合统计）
// =============================================================================

export const statisticsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // GET /statistics/learn - 学习统计
  server.get('/statistics/learn', {
    schema: {
      summary: '学习统计',
      tags: ['statistics'],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const statistics = await getLearnStatistics();
    return reply.send(success({ statistics }));
  });

  // GET /statistics/exam - 考试统计
  server.get('/statistics/exam', {
    schema: {
      summary: '考试统计',
      tags: ['statistics'],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const statistics = await getExamStatistics();
    return reply.send(success({ statistics }));
  });

  // GET /statistics/content - 内容统计
  server.get('/statistics/content', {
    schema: {
      summary: '内容统计',
      tags: ['statistics'],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const statistics = await getContentStatistics();
    return reply.send(success({ statistics }));
  });

  // GET /statistics/overview - 总览统计
  server.get('/statistics/overview', {
    schema: {
      summary: '总览统计',
      tags: ['statistics'],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const statistics = await getOverviewStatistics();
    return reply.send(success({ statistics }));
  });
};

// =============================================================================
// 管理员路由（前缀 /api/admin，统计快照管理）
// =============================================================================

export const adminStatisticsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return;
  });

  // GET /statistics/snapshots - 快照列表
  server.get('/statistics/snapshots', {
    schema: {
      summary: '统计快照列表',
      tags: ['statistics'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          type: { type: 'string', description: '快照类型筛选: overview/learn/exam/content' },
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
        400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const parsed = listSnapshotsQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findStatisticsSnapshots(parsed.data);
    return reply.send(success(result));
  });

  // GET /statistics/snapshots/:id - 快照详情
  server.get('/statistics/snapshots/:id', {
    schema: {
      summary: '快照详情',
      tags: ['statistics'],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
        404: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const snapshot = await findStatisticsSnapshotById(parsed.data.id);
    if (!snapshot) {
      return reply.status(404).send(error(404, '快照不存在'));
    }
    return reply.send(success({ snapshot }));
  });

  // POST /statistics/snapshots - 创建快照
  // 支持两种模式：1) 传入 type+data 自定义；2) 仅传 type，自动采集当前统计。
  server.post('/statistics/snapshots', {
    schema: {
      summary: '创建统计快照',
      tags: ['statistics'],
      body: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['overview', 'learn', 'exam', 'content'], description: '快照类型' },
          data: { type: 'object', description: '快照数据(可选，缺省则自动采集当前统计)' },
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
        400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const parsed = createSnapshotSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    // 若未提供 data，则按 type 自动采集当前统计
    let data = parsed.data.data;
    if (!data || Object.keys(data).length === 0) {
      if (parsed.data.type === 'overview') data = await getOverviewStatistics() as unknown as Record<string, unknown>;
      else if (parsed.data.type === 'learn') data = await getLearnStatistics() as unknown as Record<string, unknown>;
      else if (parsed.data.type === 'exam') data = await getExamStatistics() as unknown as Record<string, unknown>;
      else data = await getContentStatistics() as unknown as Record<string, unknown>;
    }
    const snapshot = await createStatisticsSnapshot({
      type: parsed.data.type,
      data,
      createdBy: request.userId,
    });
    return reply.status(201).send(success({ snapshot }));
  });

  // DELETE /statistics/snapshots/:id - 删除快照
  server.delete('/statistics/snapshots/:id', {
    schema: {
      summary: '删除统计快照',
      tags: ['statistics'],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
        404: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findStatisticsSnapshotById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '快照不存在'));
    }
    await deleteStatisticsSnapshot(parsed.data.id);
    return reply.send(success({ id: parsed.data.id, deleted: true }));
  });

  // ----- 扩展统计端点 -----

  // GET /statistics/message - 消息统计
  server.get('/statistics/message', async (_request, reply) => {
    const statistics = await getMessageStatistics();
    return reply.send(success({ statistics }));
  });

  // GET /statistics/live - 直播统计
  server.get('/statistics/live', async (_request, reply) => {
    const statistics = await getLiveStatistics();
    return reply.send(success({ statistics }));
  });

  // GET /statistics/point - 积分统计
  server.get('/statistics/point', async (_request, reply) => {
    const statistics = await getPointStatistics();
    return reply.send(success({ statistics }));
  });

  // GET /statistics/resource - 资源统计
  server.get('/statistics/resource', async (_request, reply) => {
    const statistics = await getResourceStatistics();
    return reply.send(success({ statistics }));
  });

  // GET /statistics/user-center - 用户中心统计
  server.get('/statistics/user-center', async (_request, reply) => {
    const statistics = await getUserCenterStatistics();
    return reply.send(success({ statistics }));
  });

  // GET /visit-tracking/visits - 访问明细列表
  server.get('/visit-tracking/visits', async (request, reply) => {
    const parsed = visitLogsQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findVisitLogList(parsed.data);
    return reply.send(success(result));
  });
};
