import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import jwtPlugin from '@fastify/jwt'
import { decodeJwt } from 'jose'
import { verifyAccessToken, type JWTPayload } from '@ihui/auth'
import type { AuthenticatedApiKey } from '@ihui/types'
import { config } from '../config/index.js'
import { getUserStatus } from '../db/usercenter-queries.js'
import { error } from '../utils/response.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
    jwtPayload?: JWTPayload
    /** API Key 鉴权后注入的上下文(由 plugins/api-key-auth.ts 设置)。与 JWT 鉴权独立。 */
    apiKey?: AuthenticatedApiKey
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
 */
export async function authenticate(request: FastifyRequest): Promise<JWTPayload> {
  let token: string | null = null
  const header = request.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    token = header.slice('Bearer '.length).trim()
  } else {
    // 兜底:从 auth_token cookie 读 token(浏览器同源请求自动附带)
    const cookieToken = (request as unknown as { cookies?: Record<string, string> }).cookies?.auth_token
    if (cookieToken && cookieToken.length > 0) {
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
