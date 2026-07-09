import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  globalSearch,
  findSearchHistory,
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
} from '../db/search-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

// =============================================================================
// Zod schemas
// =============================================================================

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, '关键词不能为空').max(255),
  type: z.preprocess(
    emptyToUndefined,
    z.enum(['user', 'project', 'file', 'all']).default('all'),
  ),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

// =============================================================================
// 路由
// =============================================================================

export const searchRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有 search 路由均需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      const message = (e as Error).message || 'Authentication required';
      return reply.status(statusCode).send(error(statusCode, message));
    }
  });

  // GET /search - 全局搜索（user/project/file/all，跨表聚合）
  server.get('/search', {
    schema: {
      summary: '全局搜索',
      tags: ['search'],
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', description: '搜索关键词' },
          type: { type: 'string', enum: ['user', 'project', 'file', 'all'], description: '搜索类型(默认 all)' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20, description: '返回数量(1-50,默认 20)' },
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
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { q, type, limit } = parsed.data;
    const result = await globalSearch(request.userId!, q, type, limit);
    // 异步记录搜索历史，不阻塞响应
    setImmediate(() => {
      addSearchHistory({
        userId: request.userId!,
        query: q,
        filters: { type },
        resultsCount: result.total,
      }).catch(() => {
        /* 审计性写入，失败忽略 */
      });
    });
    return reply.send(success(result));
  });

  // GET /search/history - 当前用户搜索历史
  server.get('/search/history', {
    schema: {
      summary: '搜索历史',
      tags: ['search'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: '返回数量(1-100,默认 20)' },
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
    const parsed = historyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const list = await findSearchHistory(request.userId!, parsed.data.limit);
    return reply.send(success({ list }));
  });

  // DELETE /search/history - 清空搜索历史
  server.delete('/search/history', async (request, reply) => {
    const deletedCount = await clearSearchHistory(request.userId!);
    return reply.send(success({ deletedCount }));
  });

  // DELETE /search/history/:id - 删除单条搜索历史
  server.delete('/search/history/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const deleted = await deleteSearchHistory(parsed.data.id, request.userId!);
    if (!deleted) {
      return reply.status(404).send(error(404, '记录不存在'));
    }
    return reply.send(success({ id: parsed.data.id }));
  });
};
