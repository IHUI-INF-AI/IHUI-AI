// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyRequest, FastifyReply, preHandlerAsyncHookHandler } from 'fastify'
import { authenticate, requireActiveUser } from './auth.js'
import { checkInternalServiceToken, hasInternalServiceToken } from './internal-service-token.js'
import { checkAnyPermission } from '../db/rbac-queries.js'
import { error as errorResponse } from '../utils/response.js'
import { toUserFriendlyMessage } from '@ihui/shared'

/**
 * 与 admin 路由一致：roleId >= 1 视为系统管理员，直接放行所有权限。
 * 与 users.roleId（legacy 数值角色）保持兼容，避免 admin 还需在 RBAC 表补登记。
 */
const ADMIN_ROLE_ID = 1

/**
 * 系统管理员判定所允许的**凭据通道**(O13b-③,2026-09-23)。
 *
 * 集中封装只认两条通道,且必须显式声明用哪一条 —— 缺省即编译期报错,
 * 防止新增闸门时"顺手把 internal 通道也接上"造成提权。
 */
export interface AdminChannelPolicy {
  /**
   * - `false`(**admin 面端点必须用此值**,requireAdmin / 各路由的管理员闸门):
   *   只认人用 JWT。internal service token 链路(ai-service 代真实用户调用)即使
   *   `X-User-Id` 指向一个管理员,**也不会**被升格为系统管理员。
   * - `true`(**仅** RBAC 权限点豁免档使用,即本文件 requireAnyPermission):
   *   JWT 缺失时接受 internal 通道注入的 roleId,使管理员经 AI 对话链同样豁免
   *   权限点查询(2026-09-19 对齐;值来自 plugins/internal-service-token.ts 的
   *   唯一注入点,按 X-User-Id 查 users.roleId,请求侧无法伪造)。
   */
  includeInternalChannel: boolean
}

/**
 * 系统管理员 roleId 的**唯一读取点**(O13b-③:此前 jwtPayload / internalUserRoleId
 * 双通道的读取语义散落在本文件两处与各路由的裸比较里)。
 *
 * 语义不变量(不得漂移):两条通道用 `??` 串联,故 **roleId=0 的已登录用户不会回落到
 * internal 通道的 roleId**(0 不是 nullish)—— 通道之间不可互相抬升。
 */
export function resolveAdminRoleId(request: FastifyRequest, policy: AdminChannelPolicy): number {
  const jwtRoleId = request.jwtPayload?.roleId
  if (!policy.includeInternalChannel) return jwtRoleId ?? 0
  return jwtRoleId ?? request.internalUserRoleId ?? 0
}

/**
 * 「是否为系统管理员(roleId >= 1,任意管理员)」的集中判定谓词。
 *
 * 供"属主 **或** 管理员"这类**混合闸门**使用:属主分支留在调用处,只有特权读数走此处。
 * 这类站点**不能**改用 requireAdmin preHandler —— 那会把合法属主一并拒掉。
 * 注意档位:本谓词是 `>= 1`(任意管理员);`=== 1`(超管)是另一档位,集中封装无等价物,
 * 调用处不得用本谓词替代。
 */
export function isSystemAdmin(request: FastifyRequest, policy: AdminChannelPolicy): boolean {
  return resolveAdminRoleId(request, policy) >= ADMIN_ROLE_ID
}

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
    const roleId = resolveAdminRoleId(request, { includeInternalChannel: true })
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
 *
 * 提权不变量(O13b-③钉死):本闸门**只认人用 JWT**(`includeInternalChannel: false`)。
 * internal service token 链路的 roleId 只用于 RBAC 权限点豁免,永不能打开 admin 面 ——
 * 即"持有内部密钥 + 把 X-User-Id 填成某管理员"不构成 admin 提权。
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
  const roleId = resolveAdminRoleId(request, { includeInternalChannel: false })
  if (roleId < ADMIN_ROLE_ID) {
    return reply.status(403).send({ code: 403, message: '需要管理员权限' })
  }
}

/**
 * `admin/*` 面的统一 preHandler(O13b-⑤ 收编,2026-09-23)。
 *
 * 与 `requireAdmin` 的**唯一**差别是多一道 `requireActiveUser`:被注销/封禁的账号
 * 不得进 admin 面。此差别是安全语义,不得为了"复用同一个函数"而抹平 ——
 * 也不得反向把 active 检查塞进 `requireAdmin`(它有 694 处调用点,会整体改行为)。
 *
 * 三条对外契约逐字保持(收编前后由
 * `apps/api/tests/o13b-batch4-admin-route-guard.test.ts` 钉死):
 *  1. 未鉴权 → `statusCode`(缺省 401) + `toUserFriendlyMessage(e) || '操作失败,请稍后重试'`
 *  2. 已鉴权但账号非活动 → 同状态码族 + `... || '账号已注销'`
 *  3. 活动但非管理员 → 403 `'需要管理员权限'`
 * 响应体一律走 `utils/response.js` 的 `error()`(admin 面历史形状,与 `requireAdmin`
 * 的内联字面量形状**不必相同**,收编时不得顺手统一)。
 */
export const requireAdminRouteGuard = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = toUserFriendlyMessage(e) || '操作失败,请稍后重试'
    return reply.status(statusCode).send(errorResponse(statusCode, message))
  }
  try {
    await requireActiveUser(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = toUserFriendlyMessage(e) || '账号已注销'
    return reply.status(statusCode).send(errorResponse(statusCode, message))
  }
  if (resolveAdminRoleId(request, { includeInternalChannel: false }) < ADMIN_ROLE_ID) {
    return reply.status(403).send(errorResponse(403, '需要管理员权限'))
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
