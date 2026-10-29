// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyRequest, FastifyReply, preHandlerAsyncHookHandler } from 'fastify'
import { authenticate, requireActiveUser } from './auth.js'
import { checkInternalServiceToken, hasInternalServiceToken } from './internal-service-token.js'
import { checkAnyPermission } from '../db/rbac-queries.js'
import { error as errorResponse } from '../utils/response.js'
import { toUserFriendlyMessage } from '@ihui/shared'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'
import { getTotpStatus, type TotpBindingStatus } from '../services/totp-service.js'

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
 * 管理员 TOTP 闸档位(2026-10-28 安全审计)。
 * - `off`:完全不检查(回滚口子)
 * - `warn`:未绑 TOTP 的管理员放行,仅记结构化告警(过渡档)
 * - `enforce`:未绑 TOTP 的管理员访问 admin 面 → 403(env 默认值,2026-10-29 起)
 */
export type AdminTotpMode = 'off' | 'warn' | 'enforce'

/**
 * 解析档位。
 *
 * `config.ADMIN_TOTP_MODE` 由 envSchema 兜底(缺省 `enforce`),**真实 config 恒有值** ——
 * 运行时不存在"字段缺失"这一态。唯一可能出现 undefined 的是旧测试里手写的 config
 * mock(它们整对象替换 config),这类 mock 走的是"加固前的旧判据"回退(同 config/index.ts
 * 里 `isProductionGuard` 的既有约定),否则给每个 admin 测试塞一次额外查询会整体打乱
 * 它们的 `mockResolvedValueOnce` 序列 —— 那是测试装置问题,不该由安全闸来兜。
 * 显式写错档位名(如 `enforc`)仍按 `warn` 处理:拼错不该静默关门,也不该静默锁死后台。
 */
function resolveAdminTotpMode(): AdminTotpMode {
  const raw = (config as { ADMIN_TOTP_MODE?: string }).ADMIN_TOTP_MODE
  if (raw === undefined) return 'off'
  return raw === 'off' || raw === 'enforce' ? raw : 'warn'
}

/**
 * 管理员 TOTP 闸:管理员账号未绑定 TOTP 时的处置。
 *
 * 背景(2026-10-28 安全审计):`/auth/2fa/*` 的三条登录路已强制"**已开启** TOTP 的账号"
 * 过二次校验,但"管理员**必须**开启 TOTP"这道闸此前不存在 —— 管理员不主动开 2FA,
 * 就能纯密码登录后走 requireAdmin 保护的全部 admin 路由。
 *
 * 设计约束(逐条对应安全审计要求):
 *  1. **默认只告警**:`warn` 放行 + 一条 `event: 'admin_totp_unbound'` 的结构化日志
 *     (含 userId / path / method),供运维盘点存量未绑账号;绝不因本闸锁死生产管理后台。
 *  2. **查询失败一律放行**(含 db 驱动异常、mock 缺方法):闸门的职责是"确认未绑才拦",
 *     不能把"查不到"当成"未绑" —— 否则数据库抖动会整体 403 掉 admin 面,这正是要避免的事故。
 *  3. **一次主键查询、无缓存**:见 totp-service.getTotpStatus;绑定了要立刻生效。
 *  4. 判定对象是"人用 JWT 链路"(调用处已用 `includeInternalChannel: false` 定过 roleId),
 *     internal service token 链路到不了这里。
 *
 * @returns true = 已拦截并发出 403 响应;false = 放行
 */
async function checkAdminTotpGate(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const mode = resolveAdminTotpMode()
  if (mode === 'off') return false

  const userId = request.userId ?? request.jwtPayload?.userId
  if (!userId) {
    // 已过 requireAdmin 却取不到 userId:无从判断绑定态 ⇒ 放行(不拦),只留痕
    logger.warn('[admin-totp-gate] 管理员请求缺少 userId,跳过 TOTP 检查', {
      event: 'admin_totp_gate_skip',
      path: request.url,
      mode,
    })
    return false
  }

  let status: TotpBindingStatus | null
  try {
    status = await getTotpStatus(userId)
  } catch (e) {
    logger.error('[admin-totp-gate] 查询 TOTP 绑定状态失败,本次放行(避免锁死管理后台)', {
      event: 'admin_totp_gate_error',
      userId,
      path: request.url,
      mode,
      error: e,
    })
    return false
  }

  if (!status) {
    logger.warn('[admin-totp-gate] 未查询到管理员账号,跳过 TOTP 检查', {
      event: 'admin_totp_gate_skip',
      userId,
      path: request.url,
      mode,
    })
    return false
  }

  if (status.enabled) return false

  if (mode === 'warn') {
    logger.warn('[admin-totp-gate] 管理员账号未绑定 TOTP(仅告警,不阻断)', {
      event: 'admin_totp_unbound',
      userId,
      path: request.url,
      method: request.method,
    })
    return false
  }

  // enforce:文案面向终端用户,直接给出可执行的下一步
  reply
    .status(403)
    .send(
      errorResponse(
        403,
        '管理员账号必须开启 TOTP 二次验证:请先在「安全设置」中绑定 TOTP,完成后再访问管理后台。',
      ),
    )
  return true
}

/**
 * 校验是否为系统管理员（与 admin 路由 requireAdmin 等价），供"需 admin"端点复用。
 *
 * 提权不变量(O13b-③钉死):本闸门**只认人用 JWT**(`includeInternalChannel: false`)。
 * internal service token 链路的 roleId 只用于 RBAC 权限点豁免,永不能打开 admin 面 ——
 * 即"持有内部密钥 + 把 X-User-Id 填成某管理员"不构成 admin 提权。
 *
 * 管理员 TOTP 闸(2026-10-28):roleId 判定通过后再过 `checkAdminTotpGate`,档位由
 * `ADMIN_TOTP_MODE` 控制(默认 `enforce`:未绑 TOTP 一律 403;`warn` 仅作过渡档)。
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
  // 管理员 TOTP 闸:enforce 档未绑 TOTP → 403(warn 档仅告警放行;off 档不查库)
  await checkAdminTotpGate(request, reply)
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
 * 2026-10-28 追加第 4 步(不影响上述三条):管理员 TOTP 闸 `checkAdminTotpGate`,
 * 档位 `ADMIN_TOTP_MODE` 默认 `enforce`(2026-10-29 起;`warn` 为过渡档),未绑 TOTP 即 403。
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
  // 管理员 TOTP 闸(2026-10-28):与 requireAdmin 同一档位、同一判定,置于 roleId 判定之后
  // ⇒ 非管理员仍是上面的"需要管理员权限"403,不会被 TOTP 文案覆盖(上述三条契约不变)。
  await checkAdminTotpGate(request, reply)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
