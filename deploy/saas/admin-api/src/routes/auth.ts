/**
 * 鉴权路由
 * 提供:验证 X-Admin-API-Key + X-Admin-User(白名单)
 *
 * P1-2.2 增强:
 * - 双重鉴权:既校验 API Key,也校验调用用户身份
 * - 用户身份来源:web 端 middleware 注入的 `X-Admin-User` 头
 * - 白名单:env `ADMIN_USER_WHITELIST=admin,ops`(逗号分隔)
 * - 审计追踪:通过 `request.adminUser` 挂载,供 onResponse hook 写入 JSON Lines 日志
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

/**
 * 鉴权中间件:校验 X-Admin-API-Key + X-Admin-User
 * 失败:401 Unauthorized
 */
export async function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const apiKey = request.headers['x-admin-api-key'];
  const adminUser = request.headers['x-admin-user'];

  if (!apiKey || typeof apiKey !== 'string' || apiKey !== config.ADMIN_API_KEY) {
    return reply.status(401).send({
      error: 'MissingOrInvalidApiKey',
      message: 'Missing or invalid X-Admin-API-Key header',
    });
  }

  // X-Admin-User 白名单校验(防止密钥泄露导致的越权)
  const whitelist = config.ADMIN_USER_WHITELIST.split(',').map((u) => u.trim()).filter(Boolean);
  if (!adminUser || typeof adminUser !== 'string' || !whitelist.includes(adminUser)) {
    return reply.status(401).send({
      error: 'UserNotInWhitelist',
      message: `User '${adminUser}' is not in ADMIN_USER_WHITELIST`,
    });
  }

  // 挂载用户身份给审计 hook 使用
  (request as FastifyRequest & { adminUser?: string }).adminUser = adminUser;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // 验证 API key 状态(供调试,需双重鉴权)
  app.get(
    '/admin/api/auth/verify',
    { preHandler: requireAdminAuth },
    async (request) => ({
      status: 'ok',
      message: 'API key + admin user valid',
      expires: 'never',
      adminUser: (request as FastifyRequest & { adminUser?: string }).adminUser,
    }),
  );
}
