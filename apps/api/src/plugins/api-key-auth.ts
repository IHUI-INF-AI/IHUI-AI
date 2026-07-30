/**
 * API Key 鉴权中间件。
 *
 * 2026-07-22 立:补齐 authenticate 只认 JWT、不认 API Key 的鉴权链路断层。
 *
 * 鉴权链路:
 * - 入站 header:优先 `Authorization: Bearer ihui_xxx`,其次 `X-Api-Key: ihui_xxx`
 * - 可选 secret 校验:`X-Api-Secret: sk_xxx`(存在则用 verifySecret 校验,不存在则跳过)
 * - 查 developerApiKeys 表(dbRead 副本),status 必须为 'active'
 * - P0-7 安全粒度检查(2026-07-31 立,在 checkQuota 之前):
 *   - checkExpiresAt:过期 → 401
 *   - checkAllowedIps:IP 不在白名单 → 403
 *   - checkAllowedModels:模型不在白名单 → 403(body 含 model 时检查)
 *   - checkMaxTokensPerReq:max_tokens 超限 → 403(body 含 max_tokens 时预检)
 * - 注入 request.apiKey = { id, userId, key, permissions, rateLimit, expiresAt, allowedIps, ... }
 * - lastUsedAt 异步更新,不阻塞响应
 *
 * 导出:
 * - authenticateApiKey(request):核心鉴权函数,失败抛 401/403
 * - requireApiKeyAuth:Fastify preHandler 版,失败 reply 401/403
 * - requireApiKeyPermission(perm):返回 preHandler,校验 permissions 包含 perm,失败 403
 * - requireApiKeyQuota():返回 preHandler,用 ApiKeyQuota.checkAndConsume,超限 429 + Retry-After
 * - checkExpiresAt / checkAllowedIps / checkAllowedModels / checkMaxTokensPerReq:P0-7 安全检查函数
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

function forbidden(message: string): Error {
  const err = new Error(message) as Error & { statusCode: number }
  err.statusCode = 403
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

// ===== P0-7 安全粒度检查函数(2026-07-31 立,对齐 New API 行业标准)=====

/** 检查结果。ok=true 通过,ok=false 时 reason 为拒绝原因。 */
export interface SecurityCheckResult {
  ok: boolean
  reason?: string
}

/**
 * 检查 IP 是否在白名单中。
 * 支持三种匹配模式:
 * - 精确匹配:"192.168.1.1"
 * - 前缀匹配(尾点):"192.168." 匹配 192.168.x.x
 * - CIDR 匹配:"10.0.0.0/24" 匹配 10.0.0.0~10.0.0.255
 */
export function ipInList(ip: string, allowed: readonly string[]): boolean {
  for (const entry of allowed) {
    if (entry === ip) return true
    // 前缀匹配:以 "." 结尾(如 "192.168.")
    if (entry.endsWith('.') && ip.startsWith(entry)) return true
    // CIDR 匹配:含 "/"
    if (entry.includes('/')) {
      const slashIdx = entry.indexOf('/')
      const network = entry.slice(0, slashIdx)
      const prefix = parseInt(entry.slice(slashIdx + 1), 10)
      if (isCidrMatch(ip, network, prefix)) return true
    }
  }
  return false
}

/** CIDR 简化匹配:逐字节比较前 prefix 位。仅支持 IPv4。 */
function isCidrMatch(ip: string, network: string, prefix: number): boolean {
  if (prefix < 0 || prefix > 32) return false
  const ipParts = ip.split('.').map(Number)
  const netParts = network.split('.').map(Number)
  if (ipParts.length !== 4 || netParts.length !== 4) return false
  if (ipParts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false
  if (netParts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false
  const fullBytes = Math.floor(prefix / 8)
  const remainBits = prefix % 8
  for (let i = 0; i < fullBytes; i++) {
    if (ipParts[i] !== netParts[i]) return false
  }
  if (remainBits > 0 && fullBytes < 4) {
    const mask = (0xff << (8 - remainBits)) & 0xff
    const ipByte = ipParts[fullBytes]
    const netByte = netParts[fullBytes]
    if (ipByte === undefined || netByte === undefined) return false
    if ((ipByte & mask) !== (netByte & mask)) return false
  }
  return true
}

/**
 * 检查模型名是否在白名单中。
 * 支持两种匹配模式:
 * - 精确匹配:"gpt-4o"
 * - 通配符后缀:"gpt-*" 匹配 gpt-4 / gpt-4o / gpt-3.5-turbo 等
 */
export function modelInList(model: string, allowed: readonly string[]): boolean {
  for (const entry of allowed) {
    if (entry === model) return true
    // 通配符:以 "*" 结尾(如 "gpt-*"),匹配前缀
    if (entry.endsWith('*') && model.startsWith(entry.slice(0, -1))) return true
  }
  return false
}

/**
 * 检查 API Key 是否已过期。
 * @param expiresAt 过期时间(null = 永不过期)
 * @param now 当前时间(可注入,便于测试)
 */
export function checkExpiresAt(
  expiresAt: Date | null,
  now: Date = new Date(),
): SecurityCheckResult {
  if (expiresAt === null) return { ok: true }
  if (now.getTime() > expiresAt.getTime()) return { ok: false, reason: 'API Key 已过期' }
  return { ok: true }
}

/**
 * 检查请求 IP 是否在白名单。
 * @param allowedIps IP 白名单(null/空数组 = 不限制)
 * @param requestIp 当前请求 IP
 */
export function checkAllowedIps(
  allowedIps: string[] | null,
  requestIp: string,
): SecurityCheckResult {
  if (!allowedIps || allowedIps.length === 0) return { ok: true }
  if (ipInList(requestIp, allowedIps)) return { ok: true }
  return { ok: false, reason: 'IP 不在白名单' }
}

/**
 * 检查请求模型是否在白名单。
 * @param allowedModels 模型白名单(null/空数组 = 不限制)
 * @param model 请求体中的 model 字段(undefined = body 无 model,跳过)
 */
export function checkAllowedModels(
  allowedModels: string[] | null,
  model: string | undefined,
): SecurityCheckResult {
  if (!allowedModels || allowedModels.length === 0) return { ok: true }
  if (model === undefined) return { ok: true }
  if (modelInList(model, allowedModels)) return { ok: true }
  return { ok: false, reason: '模型不在白名单' }
}

/**
 * 检查单次请求 token 是否超限。
 * @param maxTokensPerReq 上限(null = 不限制)
 * @param totalTokens 实际 token 用量(请求前为 prompt 预估,请求后为 total)
 */
export function checkMaxTokensPerReq(
  maxTokensPerReq: number | null,
  totalTokens: number,
): SecurityCheckResult {
  if (maxTokensPerReq === null) return { ok: true }
  if (totalTokens > maxTokensPerReq) return { ok: false, reason: '超过单次请求 token 上限' }
  return { ok: true }
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

  // --- P0-7 安全粒度检查(2026-07-31 立,在 checkQuota 之前执行)---
  // 1. 过期检查:过期 → 401
  const expiresCheck = checkExpiresAt(row.expiresAt)
  if (!expiresCheck.ok) throw unauthorized(expiresCheck.reason!)

  // 2. IP 白名单:不在白名单 → 403
  const ipCheck = checkAllowedIps(row.allowedIps as string[] | null, request.ip)
  if (!ipCheck.ok) throw forbidden(ipCheck.reason!)

  // 3. 模型白名单:仅当 body 含 model 字段时检查(hook 模式,不影响非 LLM 端点)
  const body = request.body as Record<string, unknown> | undefined
  const bodyModel = typeof body?.model === 'string' ? body.model : undefined
  const modelCheck = checkAllowedModels(row.allowedModels as string[] | null, bodyModel)
  if (!modelCheck.ok) throw forbidden(modelCheck.reason!)

  // 4. maxTokensPerReq 预检:仅当 body 含 max_tokens 且 maxTokensPerReq 设置时
  //    (完整检查在请求完成后 recordCall 时做,此处仅做 max_tokens 上限预检)
  if (body && typeof body.max_tokens === 'number' && row.maxTokensPerReq !== null) {
    const preCheck = checkMaxTokensPerReq(row.maxTokensPerReq, body.max_tokens)
    if (!preCheck.ok) throw forbidden(preCheck.reason!)
  }

  const ctx: AuthenticatedApiKey = {
    id: row.id,
    userId: row.userId,
    key: row.key,
    permissions: row.permissions as ApiKeyPermission[],
    rateLimit: row.rateLimit,
    // P0-7 安全粒度字段
    expiresAt: row.expiresAt,
    allowedIps: (row.allowedIps as string[] | null) ?? null,
    allowedModels: (row.allowedModels as string[] | null) ?? null,
    maxTokensPerReq: row.maxTokensPerReq,
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
    const perms = request.apiKey.permissions
    // 兼容三种格式:数组(正常) / 对象(老 seed-raw.mjs 误用 {permissions:[...]}) / null
    const permList: string[] = Array.isArray(perms)
      ? (perms as string[])
      : Array.isArray((perms as { permissions?: string[] })?.permissions)
        ? ((perms as { permissions: string[] }).permissions)
        : []
    // 通配符 * 表示拥有所有权限
    if (!permList.includes(perm) && !permList.includes('*')) {
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
