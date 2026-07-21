/**
 * 鉴权路由
 * 提供:验证 X-Admin-API-Key
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

/**
 * 鉴权中间件:校验 X-Admin-API-Key
 * 失败:401 Unauthorized
 */
export async function requireApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const apiKey = request.headers['x-admin-api-key'];

  if (!apiKey || typeof apiKey !== 'string' || apiKey !== config.ADMIN_API_KEY) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid X-Admin-API-Key',
    });
  }
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // 验证 API key 状态(供调试)
  app.get('/admin/api/auth/verify', { preHandler: requireApiKey }, async () => ({
    status: 'ok',
    message: 'API key valid',
    expires: 'never',
  }));
}
