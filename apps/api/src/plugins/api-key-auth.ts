/**
 * API Key 鉴权中间件。
 *
 * 2026-07-22 立:补齐 authenticate 只认 JWT、不认 API Key 的鉴权链路断层。
 *
 * 鉴权链路:
 * - 入站 header:优先 `Authorization: Bearer ihui_xxx`,其次 `X-Api-Key: ihui_xxx`
 * - 可选 secret 校验:`X-Api-Secret: sk_xxx`(存在则用 verifySecret 校验,不存在则跳过)
 * - 查 developerApiKeys 表(dbRead 副本),status 必须为 'active'
 * - 注入 request.apiKey = { id, userId, key, permissions, rateLimit }
 * - lastUsedAt 异步更新,不阻塞响应
 *
 * 导出:
 * - authenticateApiKey(request):核心鉴权函数,失败抛 401
 * - requireApiKeyAuth:Fastify preHandler 版,失败 reply 401
 * - requireApiKeyPermission(perm):返回 preHandler,校验 permissions 包含 perm,失败 403
 * - requireApiKeyQuota():返回 preHandler,用 ApiKeyQuota.checkAndConsume,超限 429 + Retry-After
 */
import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'
import { eq } from 'drizzle-orm'
import { dbRead, db } from '../db/index.js'
import { developerApiKeys } from '@ihui/database'
import type { AuthenticatedApiKey, ApiKeyPermission } from '@ihui/types'
import { verifySecret } from '../utils/api-key-hash.js'
import { ApiKeyQuota } from '../utils/api-key-quota.js'

function unauthorized(message: string): Error {
  const err = new Error(message) as Error & { statusCode: number }
  err.statusCode = 401
  return err
}

/**
 * 从请求中提取 API Key 公开标识。
 * 优先 Authorization: Bearer ihui_xxx,其次 X-Api-Key: ihui_xxx。
 */
function extractKey(request: FastifyRequest): string | null {
  const header = request.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    const k = header.slice('Bearer '.length).trim()
    if (k) return k
  }
  const xKey = request.headers['x-api-key']
  if (typeof xKey === 'string' && xKey.length > 0) return xKey
  return null
}

/**
 * 核心 API Key 鉴权函数。
 * 成功注入 request.apiKey 并返回 AuthenticatedApiKey;失败抛带 statusCode 的 Error。
 */
export async function authenticateApiKey(request: FastifyRequest): Promise<AuthenticatedApiKey> {
  const key = extractKey(request)
  if (!key) throw unauthorized('API key required')

  const [row] = await dbRead
    .select()
    .from(developerApiKeys)
    .where(eq(developerApiKeys.key, key))
    .limit(1)

  if (!row || row.status !== 'active') throw unauthorized('Invalid or revoked API key')

  // 可选 secret 校验:带 X-Api-Secret 则校验,不带则跳过(允许仅 key 鉴权的轻量场景)
  const xSecret = request.headers['x-api-secret']
  if (typeof xSecret === 'string' && xSecret.length > 0) {
    if (!verifySecret(xSecret, row.secret)) throw unauthorized('Invalid API key secret')
  }

  const ctx: AuthenticatedApiKey = {
    id: row.id,
    userId: row.userId,
    key: row.key,
    permissions: row.permissions as ApiKeyPermission[],
    rateLimit: row.rateLimit,
  }
  request.apiKey = ctx

  // lastUsedAt 异步更新,不阻塞响应
  void db
    .update(developerApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(developerApiKeys.id, row.id))
    .catch(() => {})

  return ctx
}

/**
 * Fastify preHandler:强制 API Key 鉴权,失败 reply 401。
 */
export const requireApiKeyAuth: preHandlerAsyncHookHandler = async (request, reply) => {
  try {
    await authenticateApiKey(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    return reply
      .status(statusCode)
      .send({ code: statusCode, message: (e as Error).message || 'API key authentication required' })
  }
}

/**
 * Fastify preHandler 工厂:校验 request.apiKey.permissions 包含指定权限点。
 * 必须在 requireApiKeyAuth 之后使用(依赖 request.apiKey 已注入)。
 * 失败 reply 403。
 */
export function requireApiKeyPermission(perm: ApiKeyPermission): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    if (!request.apiKey) {
      return reply.status(401).send({ code: 401, message: 'API key authentication required' })
    }
    if (!request.apiKey.permissions.includes(perm)) {
      return reply.status(403).send({ code: 403, message: `Missing permission: ${perm}` })
    }
  }
}

/**
 * Fastify preHandler 工厂:检查并消耗 API Key 配额。
 * 必须在 requireApiKeyAuth 之后使用(依赖 request.apiKey 已注入)。
 * 超限 reply 429 + Retry-After header。
 */
export function requireApiKeyQuota(): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    if (!request.apiKey) {
      return reply.status(401).send({ code: 401, message: 'API key authentication required' })
    }
    const quota = new ApiKeyQuota()
    const result = await quota.checkAndConsume(request.apiKey.id)
    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000))
      return reply
        .status(429)
        .header('Retry-After', String(retryAfter))
        .send({ code: 429, message: 'Rate limit exceeded' })
    }
  }
}
