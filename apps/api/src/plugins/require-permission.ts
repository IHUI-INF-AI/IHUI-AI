// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyRequest, FastifyReply, preHandlerAsyncHookHandler } from 'fastify'
import { authenticate } from './auth.js'
import { checkInternalServiceToken, hasInternalServiceToken } from './internal-service-token.js'
import { checkAnyPermission } from '../db/rbac-queries.js'
import { toUserFriendlyMessage } from '@ihui/shared'

/**
 * 与 admin 路由一致：roleId >= 1 视为系统管理员，直接放行所有权限。
 * 与 users.roleId（legacy 数值角色）保持兼容，避免 admin 还需在 RBAC 表补登记。
 */
const ADMIN_ROLE_ID = 1

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
  // 2026-08-30 权限粒度细化:单权限点校验委托给 requireAnyPermission,保证两者 401/403 语义完全一致
  return requireAnyPermission([permission])
}

/**
 * 多权限点中间件工厂（2026-08-30 权限粒度细化）。
 *
 * 行为（与 requirePermission 完全一致，仅权限校验改为"任一命中即放行"）：
 *  1. 调用 authenticate 校验 JWT，失败返回 401
 *  1b. (2026-09-19) JWT 失败且请求携带 X-Internal-Service-Token 时降级 internal token
 *      鉴权（ai-service 代真实用户调用 edu 路由，无用户 JWT）：校验 token + X-User-Id
 *      并注入 request.userId；失败返回 401/400/403
 *  2. 系统管理员（jwtPayload.roleId >= ADMIN_ROLE_ID，internal token 链路取
 *     X-User-Id 用户的 users.roleId，同源同语义）直接放行
 *  3. 其余用户通过 RBAC 表查询是否持有任一指定权限点，均未命中则返回 403
 *     （internal token 请求两处 roleId 均不足时，权限由 RBAC 对 X-User-Id
 *     指向的真实聊天用户兜底校验）
 *
 * 用法：
 *   server.get('/term', { preHandler: requireAnyPermission(['edu:view', 'edu:manage']) }, handler)
 */
export function requireAnyPermission(permissions: string[]): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      if (hasInternalServiceToken(request)) {
        // internal service 降级：校验通过则注入 request.userId 继续走 RBAC，失败时 reply 已发送
        const ok = await checkInternalServiceToken(request, reply)
        if (!ok) return
      } else {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        return reply.status(statusCode).send({
          code: statusCode,
          message: toUserFriendlyMessage(e) || 'Authentication required',
        })
      }
    }

    // 系统管理员放行(JWT 链路取 jwtPayload.roleId;internal token 链路取 X-User-Id
    // 用户的 users.roleId,同源同语义 —— 2026-09-19 对齐,管理员经 AI 对话链同样豁免)
    const roleId = request.jwtPayload?.roleId ?? request.internalUserRoleId ?? 0
    if (roleId >= ADMIN_ROLE_ID) return

    const userId = request.userId
    if (!userId) {
      return reply.status(401).send({ code: 401, message: '请先登录' })
    }

    const ok = await checkAnyPermission(userId, permissions)
    if (!ok) {
      return reply.status(403).send({ code: 403, message: '权限不足' })
    }
  }
}

/**
 * 仅校验登录、不校验权限点的中间件（用于"需登录"端点）。
 */
export const requireAuth = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  try {
    await authenticate(request)
  } catch (e) {
    // P1 修复(2026-08-06): catch 分支必须 return，否则鉴权失败后仍会继续执行后续 handler 造成未授权访问
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    return reply
      .status(statusCode)
      .send({ code: statusCode, message: toUserFriendlyMessage(e) || 'Authentication required' })
  }
}

/**
 * 校验是否为系统管理员（与 admin 路由 requireAdmin 等价），供"需 admin"端点复用。
 */
export const requireAdmin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    return reply
      .status(statusCode)
      .send({ code: statusCode, message: toUserFriendlyMessage(e) || 'Authentication required' })
  }
  const roleId = request.jwtPayload?.roleId ?? 0
  if (roleId < ADMIN_ROLE_ID) {
    return reply.status(403).send({ code: 403, message: '需要管理员权限' })
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
