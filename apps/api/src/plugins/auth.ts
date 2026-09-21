// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerAsyncHookHandler,
} from 'fastify'
import fp from 'fastify-plugin'
import jwtPlugin from '@fastify/jwt'
import { decodeJwt } from 'jose'
import { verifyAccessToken, type JWTPayload } from '@ihui/auth'
import type { AuthenticatedApiKey } from '@ihui/types'
import { config } from '../config/index.js'
import { getUserStatus } from '../db/usercenter-queries.js'
import { error } from '../utils/response.js'
import { hasApiKeyCredential } from '../utils/capability-guard.js'
import type { OpenCapabilityGrant } from '../config/open-capability-registry.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
    jwtPayload?: JWTPayload
    /** internal token 鉴权后注入的 legacy 数值角色(来自 users.roleId,由 plugins/internal-service-token.ts 设置)。
     *  与 jwtPayload.roleId 同源同语义,供 requireAnyPermission 管理员豁免判定,使 AI 对话链与 JWT 链路行为一致。 */
    internalUserRoleId?: number
    /** API Key 鉴权后注入的上下文(由 plugins/api-key-auth.ts 设置)。与 JWT 鉴权独立。 */
    apiKey?: AuthenticatedApiKey
    /** O6 开放能力闸的放行凭据(由 utils/open-capability-gate.ts 注入)。
     *  缺失 = 本请求未走登记表通道,`authenticate()` 保持完全原始的人 JWT 语义。 */
    openCapability?: OpenCapabilityGrant
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload
  }
}

/**
 * 从 Authorization header 提取 Bearer token 并验证。
 * 使用 @ihui/auth 的 jose verifyAccessToken，拒绝 refresh token 被当作 access token 使用。
 * 失败时抛出带 statusCode 的错误，由全局错误处理器统一返回 401。
 *
 * 2026-07-21 安全审计加固:同时支持 cookie 鉴权(auth_token)
 * 原因:前端 auth store 禁止把 token 持久化到 localStorage(XSS 风险),
 * 改为依赖 auth_token cookie 作为 token 持久化介质。
 * 顺序:Authorization header 优先(显式传 token 的场景),cookie 兜底
 * (浏览器同源请求自动附带,用于页面刷新后无 in-memory token 的场景)
 *
 * O6(2026-09-21):函数体首行新增一条**仅在显式打标时才生效**的机器凭据分支 ——
 * `request.openCapability` 只由 `utils/open-capability-gate.ts` 在「路由命中能力开放
 * 登记表 + API Key 鉴权通过 + scope 授权通过」后注入。全站存量调用一律形如
 * `authenticate(request)` 且不带该字段,判定恒为 false,下方 JWT 链路(含 CSRF、
 * challenge 拒绝、用户状态检查、错误码与消息)逐字节不变。
 */
export async function authenticate(request: FastifyRequest): Promise<JWTPayload> {
  try {
    return await authenticateInner(request)
  } catch (e) {
    const err = e as Error & { statusCode?: number }
    // 已标 statusCode 的是鉴权结论(401/403 + 面向人的文案),原样抛,行为逐字节不变。
    // 未标的只可能是内部异常(DB / 依赖服务 / 驱动),它的 message 会把 SQL 原文与
    // 语句里的凭据带进响应体 —— O17 三通道实跑在私有实例上抓到过(缺表 ⇒ 401 回显
    // SQL)。这里统一收敛成通用文案,原文只进日志:72 处 `statusCode ?? 401` 的双通道
    // catch 因此一次性安全,不必逐处打补丁。
    if (typeof err.statusCode !== 'number') {
      request.log.error({ err }, 'authenticate 内部异常(已脱敏为通用鉴权失败)')
      const safe = new Error('操作失败,请稍后重试') as Error & { statusCode: number }
      safe.statusCode = 401
      throw safe
    }
    throw err
  }
}

async function authenticateInner(request: FastifyRequest): Promise<JWTPayload> {
  const grant = request.openCapability
  if (grant) {
    const userId = request.apiKey?.userId ?? request.userId
    if (!userId) {
      const err = new Error('Open capability grant missing owning principal')
      ;(err as Error & { statusCode: number }).statusCode = 401
      throw err
    }
    request.userId = userId
    // 刻意不写 request.jwtPayload:O4 的 buildPrincipal 以 apiKey 优先归一为机器主体,
    // 伪造一个 JWT 形态的 payload 反而会让数据闸/审计把机器调用误判成人调用。
    // roleId 恒 0(最小权限):机器凭据不得借"归属人是管理员"这条路径提权。
    return { userId, phone: '', familyId: `open-capability:${grant.key}`, roleId: 0 }
  }

  let token: string | null = null
  const header = request.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    token = header.slice('Bearer '.length).trim()
  } else {
    // 兜底:从 auth_token cookie 读 token(浏览器同源请求自动附带)
    const cookieToken = (request as unknown as { cookies?: Record<string, string> }).cookies
      ?.auth_token
    if (cookieToken && cookieToken.length > 0) {
      // 2026-08-02 修复:Cookie 认证路径加 CSRF 防护
      // 状态变更方法(POST/PUT/DELETE/PATCH)用 Cookie 认证时,要求 X-Requested-With header
      // Bearer token 认证不受影响(Bearer header 已显式传 token,无 CSRF 风险)
      const isStateChange = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)
      if (isStateChange) {
        const xRequestedWith = request.headers['x-requested-with'] as string | undefined
        if (xRequestedWith !== 'XMLHttpRequest') {
          const err = new Error('CSRF 校验失败')
          ;(err as Error & { statusCode: number }).statusCode = 403
          throw err
        }
      }
      token = cookieToken
    }
  }
  if (!token) {
    const err = new Error('Authentication required')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  let payload: JWTPayload
  try {
    payload = await verifyAccessToken(token)
  } catch {
    const err = new Error('Invalid or expired token')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  // 2FA 安全加固(Wave 10, 2026-07-22):拒绝 challenge token 用作普通 access token。
  // challenge token (type='challenge') 是登录 2FA 流程的短期 JWT (5min),
  // 只能用于 POST /auth/2fa/login-verify 端点,不能访问其他受 authenticate() 保护的端点。
  // verifyAccessToken 只拒绝 type='refresh',不拒绝 type='challenge'(因 @ihui/auth 不感知 2FA 语义),
  // 此处补充检查:验签通过后 decode payload 检 type 字段。
  // 安全性:token 已由 verifyAccessToken 验签,decodeJwt 仅读取(不重新验签),无伪造风险。
  const rawPayload = decodeJwt(token)
  if (rawPayload.type === 'challenge') {
    const err = new Error('Challenge token cannot be used for this endpoint')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  // P2-14 修复(2026-08-06):原 authenticate 只验 token 不查用户状态,
  // 封禁(status=0)/注销(status=3)用户在 access token 15 分钟有效期内仍可调用全部业务接口。
  // 现在:验签后查一次用户状态(主键索引查询,毫秒级),封禁 403 / 注销 401 / 不存在 401。
  // 内部系统凭证路径不受影响(不走本函数,见 internal-service-token 中间件)。
  const userStatus = await getUserStatus(payload.userId)
  if (userStatus === undefined) {
    const err = new Error('用户不存在')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }
  if (userStatus === 0) {
    const err = new Error('账号已被封禁')
    ;(err as Error & { statusCode: number }).statusCode = 403
    throw err
  }
  if (userStatus === 3) {
    const err = new Error('账号已注销')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  request.userId = payload.userId
  request.jwtPayload = payload
  return payload
}

/**
 * 强制鉴权(handler 内控制流版):失败时发送 401 并返回 false,成功返回 true。
 * 用于 handler 内部 `if (!(await checkAuth(request, reply))) return` 模式。
 * 与 plugins/require-permission.ts 的 requireAuth(preHandler void 版)语义不同,不可混用。
 */
export async function checkAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

/**
 * 人用 JWT 凭据是否存在(Bearer 且非 `ihui_` 前缀,或 auth_token cookie)。
 *
 * 用途:开放能力闸据此判定「本请求是不是人」。人凭据在场时**一律优先按人处理**,
 * 保证浏览器/小程序存量登录态即便额外带了 x-api-key,也不会改走机器通道。
 */
export function hasHumanJwtCredential(request: FastifyRequest): boolean {
  const header = request.headers.authorization
  if (
    typeof header === 'string' &&
    header.startsWith('Bearer ') &&
    !header.startsWith('Bearer ihui_')
  ) {
    return true
  }
  const cookieToken = (request as unknown as { cookies?: Record<string, string> }).cookies
    ?.auth_token
  return typeof cookieToken === 'string' && cookieToken.length > 0
}

/**
 * 双通道 preHandler:机器凭据走调用方注入的能力闸,人凭据走原 `checkAuth`。
 *
 * 端点自身已经不需要再写 `hasApiKeyCredential` 分支样板(现仅
 * `routes/v1-codebase-search.ts` 手抄了一份,后续可切到此工厂)。
 * 注意:`/api` 面的常规接线用 `utils/open-capability-gate.ts` 的根级
 * {@link openCapabilityGateway},本工厂留给需要就地声明双通道的端点。
 *
 * 行为保证:未携带机器凭据时,与 `checkAuth` 完全一致(含 CSRF、用户状态检查)。
 */
export function requireApiKeyOrJwt(
  apiKeyGate: preHandlerAsyncHookHandler,
): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    if (
      !request.openCapability &&
      hasApiKeyCredential(request) &&
      !hasHumanJwtCredential(request)
    ) {
      await apiKeyGate.call(request.server, request, reply)
      return
    }
    await checkAuth(request, reply)
  }
}

/**
 * 混合鉴权:JWT 优先,失败降级为 internal service token(2026-07-24 立)。
 *
 * 用途:ai-service 等内部服务通过 HTTP 调用 API 端点(如 /api/memory)时,
 * 无用户 JWT,改用 X-Internal-Service-Token + X-User-Id 头鉴权。
 *
 * 流程:
 * 1. 检测是否携带 X-Internal-Service-Token header
 * 2. 是 → 走 internal service token 鉴权(注入 userId)
 * 3. 否 → 走标准 JWT 鉴权(checkAuth)
 *
 * 两者均失败返回 401。
 */
export async function checkAuthOrInternalService(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  // 延迟导入避免循环依赖
  const { hasInternalServiceToken, checkInternalServiceToken } =
    await import('./internal-service-token.js')

  if (hasInternalServiceToken(request)) {
    return checkInternalServiceToken(request, reply)
  }

  return checkAuth(request, reply)
}

/**
 * Opt-in 中间件：校验当前用户 status !== 3(已注销)。
 * 必须在 authenticate 之后运行(从 request.userId 取 userId)。
 * 适用场景：admin 路由等需要确保账号未注销的敏感端点。
 * 设计权衡：放在独立中间件而非合并到 authenticate,避免破坏现有大量使用 mocked DB 的集成测试。
 */
export async function requireActiveUser(request: FastifyRequest): Promise<void> {
  const userId = request.userId
  if (!userId) {
    const err = new Error('Authentication required')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }
  const status = await getUserStatus(userId)
  if (status === undefined) {
    const err = new Error('User not found')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }
  if (status === 3) {
    const err = new Error('账号已注销')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }
}

/**
 * Fastify 插件：注册 @fastify/jwt（secret 从 config.JWT_SECRET），
 * 并注册 authenticate 相关的 request 装饰器。
 *
 * 注意：authenticate 函数实际调用 @ihui/auth.verifyAccessToken (jose)，
 * 以确保 refresh/access token 类型隔离；@fastify/jwt 在此注册以便后续扩展使用。
 */
const authPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  await server.register(jwtPlugin, {
    secret: config.JWT_SECRET,
    sign: { algorithm: 'HS256' },
  })
  server.decorateRequest('userId', undefined)
  server.decorateRequest('jwtPayload', undefined)
}

export default fp(authPlugin, {
  name: 'auth-plugin',
  fastify: '5.x',
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
