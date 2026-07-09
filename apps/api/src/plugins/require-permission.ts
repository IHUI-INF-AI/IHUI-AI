import type { FastifyRequest, FastifyReply, preHandlerAsyncHookHandler } from 'fastify';
import { authenticate } from './auth.js';
import { checkPermission } from '../db/rbac-queries.js';

/**
 * 与 admin 路由一致：roleId >= 1 视为系统管理员，直接放行所有权限。
 * 与 users.roleId（legacy 数值角色）保持兼容，避免 admin 还需在 RBAC 表补登记。
 */
const ADMIN_ROLE_ID = 1;

/**
 * 权限中间件工厂。
 *
 * 行为：
 *  1. 调用 authenticate 校验 JWT，失败返回 401
 *  2. 系统管理员（jwtPayload.roleId >= ADMIN_ROLE_ID）直接放行
 *  3. 其余用户通过 RBAC 表查询是否持有指定权限点，无则返回 403
 *
 * 用法：
 *   server.post('/roles', { preHandler: requirePermission('rbac:manage') }, handler)
 */
export function requirePermission(permission: string): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return reply
        .status(statusCode)
        .send({ code: statusCode, message: (e as Error).message || 'Authentication required' });
    }

    // 系统管理员放行
    const roleId = request.jwtPayload?.roleId ?? 0;
    if (roleId >= ADMIN_ROLE_ID) return;

    const userId = request.userId;
    if (!userId) {
      return reply.status(401).send({ code: 401, message: 'Authentication required' });
    }

    const ok = await checkPermission(userId, permission);
    if (!ok) {
      return reply.status(403).send({ code: 403, message: '权限不足' });
    }
  };
}

/**
 * 仅校验登录、不校验权限点的中间件（用于"需登录"端点）。
 */
export const requireAuth: preHandlerAsyncHookHandler = async (request, reply) => {
  try {
    await authenticate(request);
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
    return reply
      .status(statusCode)
      .send({ code: statusCode, message: (e as Error).message || 'Authentication required' });
  }
};

/**
 * 校验是否为系统管理员（与 admin 路由 requireAdmin 等价），供"需 admin"端点复用。
 */
export const requireAdmin: preHandlerAsyncHookHandler = async (request, reply) => {
  try {
    await authenticate(request);
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
    return reply
      .status(statusCode)
      .send({ code: statusCode, message: (e as Error).message || 'Authentication required' });
  }
  const roleId = request.jwtPayload?.roleId ?? 0;
  if (roleId < ADMIN_ROLE_ID) {
    return reply.status(403).send({ code: 403, message: '需要管理员权限' });
  }
};
