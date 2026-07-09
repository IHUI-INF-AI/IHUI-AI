import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import { findAuditLogs, getDetailedStats } from '../db/search-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

// =============================================================================
// Zod schemas
// =============================================================================

const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  action: z.preprocess(emptyToUndefined, z.string().optional()),
  resourceType: z.preprocess(emptyToUndefined, z.string().optional()),
});

// =============================================================================
// 路由
// =============================================================================

export const auditRoutes: FastifyPluginAsync = async (server) => {
  // 统一 admin 鉴权：authenticate + requireAdmin，一次注册应用于全部 audit 路由
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      const message = (e as Error).message || 'Authentication required';
      return reply.status(statusCode).send(error(statusCode, message));
    }
    const roleId = request.jwtPayload?.roleId ?? 0;
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'));
    }
  });

  // GET /audit-logs - 分页查询操作日志（支持 userId/action/resourceType 筛选）
  server.get('/audit-logs', {
    schema: {
      summary: '审计日志列表',
      tags: ['audit'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: '每页数量(1-100,默认 20)' },
          userId: { type: 'string', description: '按用户 ID 筛选(可选)' },
          action: { type: 'string', description: '按操作类型筛选(可选)' },
          resourceType: { type: 'string', description: '按资源类型筛选(可选)' },
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
    const parsed = auditLogsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, userId, action, resourceType } = parsed.data;
    const { list, total } = await findAuditLogs(page, pageSize, { userId, action, resourceType });
    return reply.send(success({ list, total, page, pageSize }));
  });

  // GET /stats/detailed - 详细统计（用户增长趋势/项目分布/文件类型分布/订单统计）
  server.get('/stats/detailed', {
    schema: {
      summary: '详细统计',
      tags: ['audit'],
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
        403: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (_request, reply) => {
    const stats = await getDetailedStats();
    return reply.send(success(stats));
  });
};
