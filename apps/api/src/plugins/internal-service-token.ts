/**
 * Internal Service Token 鉴权(2026-07-24 立)。
 *
 * 用途:ai-service 等内部服务通过 HTTP 调用 API 端点(如 /api/memory)时,
 * 无需用户 JWT,改用 X-Internal-Service-Token + X-User-Id 头鉴权。
 *
 * 设计:
 * - token 与 config.AI_CALLBACK_SECRET 共用(单一密钥,减少配置项)
 * - 为空(未配置)时拒绝所有 internal token 请求(强制配置后才可用)
 * - X-User-Id 必须为有效 UUID 或数字字符串(防注入),成功后注入 request.userId
 *
 * 与 checkAuth 协同:checkAuthOrInternalService 先尝试 JWT,失败降级 internal token。
 */
import type { FastifyRequest, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { config } from '../config/index.js'
import { error } from '../utils/response.js'
import { db } from '../db/index.js'
import { users } from '@ihui/database'

const INTERNAL_TOKEN_HEADER = 'x-internal-service-token'
const USER_ID_HEADER = 'x-user-id'

/**
 * 校验 internal service token + 注入 userId。
 * 成功返回 true,失败发送 401 并返回 false。
 *
 * P0 安全修复(2026-08-02):原先仅校验 X-User-Id 格式就直接注入 request.userId,
 * 一旦 internal secret 泄露,攻击者可冒充任意用户。现增加用户存在 + 活跃校验,
 * 并补审计日志(caller IP + userId + endpoint),把"单点泄露即全用户冒充"收敛为
 * "仅能冒充存在且活跃的用户,且每次调用留痕"。
 */
export async function checkInternalServiceToken(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const token = request.headers[INTERNAL_TOKEN_HEADER] as string | undefined
  const requestedUserId = request.headers[USER_ID_HEADER] as string | undefined

  // 未配置 internal secret 时拒绝(强制配置后才可用)
  if (!config.AI_CALLBACK_SECRET) {
    reply.status(401).send(error(401, 'Internal service token not configured'))
    return false
  }

  if (!token || token !== config.AI_CALLBACK_SECRET) {
    reply.status(401).send(error(401, 'Invalid internal service token'))
    return false
  }

  // 允许 UUID(如 6b8cd0f6-546f-44c8-853a-5f96edbe08be)或数字字符串(防注入)
  if (!requestedUserId || !/^[a-zA-Z0-9-]{1,128}$/.test(requestedUserId)) {
    reply.status(400).send(error(400, 'Valid X-User-Id header required'))
    return false
  }

  // 验证用户存在且活跃(防 X-User-Id 欺骗:internal secret 泄露后不能冒充任意/已注销用户)
  const [user] = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(eq(users.id, requestedUserId))
    .limit(1)

  if (!user) {
    request.log.warn(
      { requestedUserId, ip: request.ip, endpoint: request.url },
      '[internal-token] X-User-Id not found',
    )
    reply.status(401).send(error(401, 'User not found'))
    return false
  }

  if (user.status !== 1) {
    request.log.warn(
      { requestedUserId, status: user.status, ip: request.ip, endpoint: request.url },
      '[internal-token] X-User-Id not active',
    )
    reply.status(403).send(error(403, 'User not active'))
    return false
  }

  // 注入 userId(已验证存在且活跃)
  request.userId = user.id

  // 审计日志:记录内部服务调用(caller IP + userId + endpoint),便于事后追溯
  request.log.info(
    { userId: user.id, ip: request.ip, endpoint: request.url, method: request.method },
    '[internal-token] internal service call',
  )

  return true
}

/**
 * 检测请求是否携带 internal service token header(用于 checkAuthOrInternalService 分流)。
 */
export function hasInternalServiceToken(request: FastifyRequest): boolean {
  return !!request.headers[INTERNAL_TOKEN_HEADER]
}
