/**
 * Internal Service Token 鉴权(2026-07-24 立)。
 *
 * 用途:ai-service 等内部服务通过 HTTP 调用 API 端点(如 /api/memory)时,
 * 无需用户 JWT,改用 X-Internal-Service-Token + X-User-Id 头鉴权。
 *
 * 设计:
 * - token 与 config.AI_CALLBACK_SECRET 共用(单一密钥,减少配置项)
 * - 为空(未配置)时拒绝所有 internal token 请求(强制配置后才可用)
 * - X-User-Id 必须为数字字符串(防注入),成功后注入 request.userId
 *
 * 与 checkAuth 协同:checkAuthOrInternalService 先尝试 JWT,失败降级 internal token。
 */
import type { FastifyRequest, FastifyReply } from 'fastify'
import { config } from '../config/index.js'
import { error } from '../utils/response.js'

const INTERNAL_TOKEN_HEADER = 'x-internal-service-token'
const USER_ID_HEADER = 'x-user-id'

/**
 * 校验 internal service token + 注入 userId。
 * 成功返回 true,失败发送 401 并返回 false。
 */
export async function checkInternalServiceToken(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const token = request.headers[INTERNAL_TOKEN_HEADER] as string | undefined
  const userId = request.headers[USER_ID_HEADER] as string | undefined

  // 未配置 internal secret 时拒绝(强制配置后才可用)
  if (!config.AI_CALLBACK_SECRET) {
    reply.status(401).send(error(401, 'Internal service token not configured'))
    return false
  }

  if (!token || token !== config.AI_CALLBACK_SECRET) {
    reply.status(401).send(error(401, 'Invalid internal service token'))
    return false
  }

  if (!userId || !/^\d+$/.test(userId)) {
    reply.status(400).send(error(400, 'Valid X-User-Id header required'))
    return false
  }

  request.userId = userId
  return true
}

/**
 * 检测请求是否携带 internal service token header(用于 checkAuthOrInternalService 分流)。
 */
export function hasInternalServiceToken(request: FastifyRequest): boolean {
  return !!request.headers[INTERNAL_TOKEN_HEADER]
}
