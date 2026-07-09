import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { findPlans, findPlanById } from '../db/billing-queries.js';
import { success, error } from '../utils/response.js';

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({
  id: z.string().uuid('无效的 ID'),
});

// =============================================================================
// 公开路由（前缀 /api，无需鉴权）
// =============================================================================

export const billingRoutes: FastifyPluginAsync = async (server) => {
  // GET /plans - 公开：列出所有启用的订阅方案（按 sort_order 升序）
  server.get(
    '/plans',
    {
      schema: {
        summary: '订阅方案列表',
        description: '公开接口:列出所有启用的订阅方案(按 sort_order 升序)',
        tags: ['billing'],
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
    },
    async (_request, reply) => {
      const list = await findPlans();
      return reply.send(success({ plans: list }));
    },
  );

  // GET /plans/:id - 公开：单个方案详情
  server.get(
    '/plans/:id',
    {
      schema: {
        summary: '订阅方案详情',
        description: '公开接口:获取单个订阅方案详情',
        tags: ['billing'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: '方案 ID' },
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
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const plan = await findPlanById(parsed.data.id);
      if (!plan || !plan.isActive) {
        return reply.status(404).send(error(404, '方案不存在'));
      }
      return reply.send(success({ plan }));
    },
  );
};
