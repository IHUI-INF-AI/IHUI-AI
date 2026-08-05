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
 * - per-user model rate limit(2026-07-31 立,Redis 滑动窗口):
 *   - checkPerModelRateLimit:按 model 维度检查 RPM/TPM,超限 → 429 + Retry-After(code 1007/1008)
 *   - 配置来源:developer_api_keys.perModelRpmLimit / perModelTpmLimit(JSON,字段未落地时跳过)
 * - 注入 request.apiKey = { id, userId, key, permissions, rateLimit, expiresAt, allowedIps, ... }
 * - lastUsedAt 异步更新,不阻塞响应
 *
 * 导出:
 * - authenticateApiKey(request):核心鉴权函数,失败抛 401/403/429
 * - requireApiKeyAuth:Fastify preHandler 版,失败 reply 401/403/429(429 附 Retry-After)
 * - requireApiKeyPermission(perm):返回 preHandler,校验 permissions 包含 perm,失败 403
 * - requireApiKeyQuota():返回 preHandler,用 ApiKeyQuota.checkAndConsume,超限 429 + Retry-After
 * - checkExpiresAt / checkAllowedIps / checkAllowedModels / checkMaxTokensPerReq:P0-7 安全检查函数
 * - checkPerModelRateLimit:per-user 单模型 RPM/TPM 限流检查
 */
import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'
import { eq } from 'drizzle-orm'
import IORedis, { type Redis } from 'ioredis'
import { dbRead, db } from '../db/index.js'
import { developerApiKeys } from '@ihui/database'
import type { AuthenticatedApiKey, ApiKeyPermission } from '@ihui/types'
import { verifySecret } from '../utils/api-key-hash.js'
import { ApiKeyQuota } from '../utils/api-key-quota.js'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'
import { checkTpmQuota, recordTpmUsage } from '../services/api-key-tpm-service.js'
import { getShareByToken } from '../services/api-key-share-service.js'

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
 * per-user model rate limit 错误(429)。
 * code: 1007 = RPM 超限,1008 = TPM 超限。
 * retryAfter: 建议客户端等待的秒数(由 requireApiKeyAuth 写入 Retry-After header)。
 */
interface PerModelRateLimitError extends Error {
  statusCode: 429
  code: 1007 | 1008
  retryAfter: number
}

function rateLimited(
  message: string,
  code: 1007 | 1008,
  retryAfter: number,
): PerModelRateLimitError {
  const err = new Error(message) as PerModelRateLimitError
  err.statusCode = 429
  err.code = code
  err.retryAfter = Math.max(1, Math.ceil(retryAfter))
  return err
}

// ============================================================================
// Redis 客户端(per-user model rate limit 用,懒加载单例)
// ============================================================================
// 注:主 Redis 客户端在 plugins/redis.ts 通过 fastify.decorate 暴露(request.server.redis),
// 但 checkPerModelRateLimit 的签名不依赖 request,故独立懒加载一个客户端,复用 config.REDIS_URL。
let redisClient: Redis | null = null

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    })
    // Redis 故障时静默:限流检查降级为 allow(不阻塞合法用户)
    redisClient.on('error', () => {
      /* silent — checkPerModelRateLimit 内部 catch 后 fail-open */
    })
  }
  return redisClient
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

// ============================================================================
// per-user model rate limit(2026-07-31 立,Redis 滑动窗口)
// ============================================================================
/**
 * 单模型限流检查结果。
 * - allowed=true:通过
 * - allowed=false:超限,retryAfter 为建议等待秒数,reason 标识 RPM 或 TPM 超限
 */
export interface PerModelRateLimitResult {
  allowed: boolean
  retryAfter?: number
  reason?: 'rpm' | 'tpm'
}

/** 滑动窗口时长(毫秒,60 秒 = 1 分钟)。 */
const RATE_LIMIT_WINDOW_MS = 60_000

/**
 * 检查 per-user 单模型 RPM/TPM 限流(Redis 滑动窗口)。
 *
 * 实现细节:
 * - RPM:用 Redis ZSET 记录窗口内每个请求的时间戳,ZCARD 统计请求数
 * - TPM:用 ZSET(时间戳)+ HASH(token 数)记录窗口内每个请求的 token 数,HVALS 求和
 * - 窗口 60 秒,每次检查先清理过期条目再统计
 * - Redis 故障时 fail-open(返回 allowed),不阻塞合法用户
 *
 * @param apiKeyId API Key id
 * @param model 模型名(如 'gpt-4o')
 * @param estimatedTokens 预估 token 数(基于 input tokens + max_tokens)
 * @param rpmLimit 该模型 RPM 上限(undefined/null = 不限制)
 * @param tpmLimit 该模型 TPM 上限(undefined/null = 不限制)
 */
export async function checkPerModelRateLimit(
  apiKeyId: string,
  model: string,
  estimatedTokens: number,
  rpmLimit?: number | null,
  tpmLimit?: number | null,
): Promise<PerModelRateLimitResult> {
  // 无任何限制 → 直接通过
  const hasRpmLimit = typeof rpmLimit === 'number' && rpmLimit > 0
  const hasTpmLimit = typeof tpmLimit === 'number' && tpmLimit > 0
  if (!hasRpmLimit && !hasTpmLimit) return { allowed: true }

  let redis: Redis
  try {
    redis = getRedisClient()
  } catch {
    // Redis 客户端初始化失败 → fail-open
    return { allowed: true }
  }

  const now = Date.now()
  const reqId = `${now}:${Math.random().toString(36).slice(2, 10)}`

  try {
    // --- RPM 检查(ZSET 滑动窗口,统计请求数)---
    if (hasRpmLimit) {
      const rpmKey = `relay:ratelimit:rpm:${apiKeyId}:${model}`
      // 清理窗口外的旧条目
      await redis.zremrangebyscore(rpmKey, 0, now - RATE_LIMIT_WINDOW_MS)
      // 先统计当前窗口内请求数(不含本次)
      const currentCount = await redis.zcard(rpmKey)
      if (currentCount + 1 > (rpmLimit as number)) {
        // 超限:不写入本次请求,返回 429
        // retryAfter = 窗口剩余时间(估算:最早条目到期时间,无条目时取完整窗口)
        const oldest = await redis.zrange(rpmKey, 0, '0', 'WITHSCORES')
        const oldestScore = oldest[1] ? Number(oldest[1]) : now - RATE_LIMIT_WINDOW_MS
        const retryAfter = Math.ceil((oldestScore + RATE_LIMIT_WINDOW_MS - now) / 1000)
        return { allowed: false, retryAfter: Math.max(1, retryAfter), reason: 'rpm' }
      }
      // 未超限:写入本次请求
      await redis.zadd(rpmKey, now, reqId)
      await redis.pexpire(rpmKey, RATE_LIMIT_WINDOW_MS)
    }

    // --- TPM 检查(ZSET 时间戳 + HASH token 数,统计 token 总和)---
    if (hasTpmLimit) {
      const tpmZsetKey = `relay:ratelimit:tpm:z:${apiKeyId}:${model}`
      const tpmHashKey = `relay:ratelimit:tpm:h:${apiKeyId}:${model}`
      // 清理窗口外的旧条目
      const oldMembers = await redis.zrangebyscore(tpmZsetKey, 0, now - RATE_LIMIT_WINDOW_MS)
      if (oldMembers.length > 0) {
        await redis.zremrangebyscore(tpmZsetKey, 0, now - RATE_LIMIT_WINDOW_MS)
        await redis.hdel(tpmHashKey, ...oldMembers)
      }
      // 统计当前窗口内 token 总和(不含本次)
      const vals = await redis.hvals(tpmHashKey)
      const currentSum = vals.reduce((acc, v) => acc + Number(v), 0)
      if (currentSum + estimatedTokens > (tpmLimit as number)) {
        // 超限:不写入本次请求,返回 429
        const oldest = await redis.zrange(tpmZsetKey, 0, '0', 'WITHSCORES')
        const oldestScore = oldest[1] ? Number(oldest[1]) : now - RATE_LIMIT_WINDOW_MS
        const retryAfter = Math.ceil((oldestScore + RATE_LIMIT_WINDOW_MS - now) / 1000)
        return { allowed: false, retryAfter: Math.max(1, retryAfter), reason: 'tpm' }
      }
      // 未超限:写入本次请求的 token 数
      await redis.zadd(tpmZsetKey, now, reqId)
      await redis.hset(tpmHashKey, reqId, estimatedTokens)
      await redis.pexpire(tpmZsetKey, RATE_LIMIT_WINDOW_MS)
      await redis.pexpire(tpmHashKey, RATE_LIMIT_WINDOW_MS)
    }

    return { allowed: true }
  } catch {
    // Redis 命令失败 → fail-open(不阻塞合法用户)
    return { allowed: true }
  }
}

/**
 * Share token 鉴权:识别 share_ 前缀的 token,走分享 token 鉴权路径。
 *
 * 流程:
 * 1. strip share_ 前缀 → getShareByToken 查询有效分享(未过期 + 未撤销)
 * 2. 防御性复核 expiresAt / revokedAt
 * 3. 源 Key 必须活跃(status === 'active')
 * 4. scopeModels 检查(null = 继承源 Key allowedModels)
 * 5. scopeEndpoints 检查(null/空 = 全部;匹配请求 path 是否包含端点标识)
 * 6. rateLimitRpm / rateLimitTpm 检查(复用 checkPerModelRateLimit,用 share ID 隔离计数)
 * 7. 注入 sourceApiKeyId 作为当前 apiKeyId,继承源 Key 配置
 *
 * 降级安全:getShareByToken 抛异常(DB 不可用)→ 401 拒绝(share 鉴权无法放行)。
 */
async function authenticateShareToken(
  request: FastifyRequest,
  token: string,
): Promise<AuthenticatedApiKey> {
  // strip share_ 前缀(DB 存纯 hex,客户端传 share_<hex>)
  const rawToken = token.slice('share_'.length)

  let share: Awaited<ReturnType<typeof getShareByToken>>
  try {
    share = await getShareByToken(rawToken)
  } catch (err) {
    // share-service 异常:share 鉴权无法降级放行(无法确认 token 有效性)
    logger.warn('Share service unavailable, rejecting share token', { error: String(err) })
    throw unauthorized('Share token verification failed')
  }
  if (!share) throw unauthorized('Invalid or expired share token')

  // 防御性复核过期/撤销(getShareByToken 查询已过滤,此处显式检查)
  const now = new Date()
  if (share.revokedAt !== null) throw unauthorized('Share token revoked')
  if (share.expiresAt.getTime() <= now.getTime()) throw unauthorized('Share token expired')

  // 源 Key 必须活跃
  if (share.sourceKey.status !== 'active') throw unauthorized('Source API key inactive')

  // P1-4 修复(2026-08-05):原实现未校验源 Key 的 IP 白名单,
  // 源 Key 的 IP 约束可被 share token 绕过。与主 Key 鉴权链路保持一致。
  const ipCheck = checkAllowedIps(share.sourceKey.allowedIps as string[] | null, request.ip)
  if (!ipCheck.ok) throw forbidden(ipCheck.reason!)

  const body = request.body as Record<string, unknown> | undefined
  const bodyModel = typeof body?.model === 'string' ? body.model : undefined

  // scopeModels: null = 继承源 Key allowedModels
  const effectiveModels = share.scopeModels ?? (share.sourceKey.allowedModels as string[] | null)
  const modelCheck = checkAllowedModels(effectiveModels, bodyModel)
  if (!modelCheck.ok) throw forbidden(modelCheck.reason!)

  // scopeEndpoints: null/空 = 全部;匹配请求 path 是否包含端点标识(chat/embeddings/image)
  if (share.scopeEndpoints && share.scopeEndpoints.length > 0) {
    const path = request.url.split('?')[0] ?? ''
    if (!share.scopeEndpoints.some((ep) => path.includes(ep))) {
      throw forbidden('Endpoint not in share scope')
    }
  }

  // rateLimitRpm / rateLimitTpm:复用 checkPerModelRateLimit(用 share ID 隔离计数,合成 model key)
  // Redis 故障时 checkPerModelRateLimit 内部 fail-open,不阻塞合法分享请求
  const estimatedTokens = body && typeof body.max_tokens === 'number' ? body.max_tokens : 1000
  const rlResult = await checkPerModelRateLimit(
    share.id,
    '__share__',
    estimatedTokens,
    share.rateLimitRpm,
    share.rateLimitTpm,
  )
  if (!rlResult.allowed) {
    throw rateLimited(
      rlResult.reason === 'tpm' ? 'Share TPM limit exceeded' : 'Share RPM limit exceeded',
      rlResult.reason === 'tpm' ? 1008 : 1007,
      rlResult.retryAfter ?? 1,
    )
  }

  // 注入 sourceApiKeyId 作为当前 apiKeyId,继承源 Key 配置
  const ctx: AuthenticatedApiKey = {
    id: share.sourceApiKeyId,
    userId: share.sourceKey.userId,
    key: share.sourceKey.key,
    permissions: share.sourceKey.permissions as ApiKeyPermission[],
    rateLimit: share.sourceKey.rateLimit,
    expiresAt: share.sourceKey.expiresAt,
    allowedIps: (share.sourceKey.allowedIps as string[] | null) ?? null,
    allowedModels: (share.sourceKey.allowedModels as string[] | null) ?? null,
    maxTokensPerReq: share.sourceKey.maxTokensPerReq,
  }
  request.apiKey = ctx

  // lastUsedAt 异步更新(源 Key)
  void db
    .update(developerApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(developerApiKeys.id, share.sourceApiKeyId))
    .catch(() => {})

  return ctx
}

/**
 * 核心 API Key 鉴权函数。
 * 成功注入 request.apiKey 并返回 AuthenticatedApiKey;失败抛带 statusCode 的 Error。
 */
export async function authenticateApiKey(request: FastifyRequest): Promise<AuthenticatedApiKey> {
  const key = extractKey(request)
  if (!key) throw unauthorized('API key required')

  // Share token 鉴权分支:token 以 share_ 前缀标记,走分享 token 鉴权路径
  if (key.startsWith('share_')) {
    return authenticateShareToken(request, key)
  }

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

  // 5. per-user model rate limit 检查(2026-07-31 立,Redis 滑动窗口)
  //    仅当 body 含 model 且 developer_api_keys 配置了 perModelRpmLimit/perModelTpmLimit 时触发
  //    TODO(schema): 主 agent 后续在 packages/database/src/schema/developer-api-keys.ts 添加字段:
  //      perModelRpmLimit: jsonb('per_model_rpm_limit')  -- 如 {"gpt-4o": 60}
  //      perModelTpmLimit: jsonb('per_model_tpm_limit')  -- 如 {"gpt-4o": 100000}
  //    字段未落地前通过 as 断言读取(undefined/null → 跳过限流,向后兼容)
  if (bodyModel) {
    const rowWithPerModel = row as typeof row & {
      perModelRpmLimit?: Record<string, number> | null
      perModelTpmLimit?: Record<string, number> | null
    }
    const rpmLimit = rowWithPerModel.perModelRpmLimit?.[bodyModel]
    const tpmLimit = rowWithPerModel.perModelTpmLimit?.[bodyModel]
    // 预估 token:优先用 body.max_tokens,无则用保守默认值 1000
    const estimatedTokens = body && typeof body.max_tokens === 'number' ? body.max_tokens : 1000
    const rlResult = await checkPerModelRateLimit(
      row.id,
      bodyModel,
      estimatedTokens,
      rpmLimit,
      tpmLimit,
    )
    if (!rlResult.allowed) {
      const code = rlResult.reason === 'tpm' ? 1008 : 1007
      const msg =
        rlResult.reason === 'tpm'
          ? `超过单模型 TPM 限制(model=${bodyModel})`
          : `超过单模型 RPM 限制(model=${bodyModel})`
      throw rateLimited(msg, code, rlResult.retryAfter ?? 1)
    }
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
 * Fastify preHandler:强制 API Key 鉴权,失败 reply 401/403/429。
 * 429(per-model rate limit)附 Retry-After header + 业务 code(1007/1008)。
 */
export const requireApiKeyAuth: preHandlerAsyncHookHandler = async (request, reply) => {
  try {
    await authenticateApiKey(request)
  } catch (e) {
    const err = e as Error & { statusCode?: number; code?: number; retryAfter?: number }
    const statusCode = err.statusCode ?? 401
    // 429 限流:附 Retry-After header + 业务 code
    if (statusCode === 429 && typeof err.retryAfter === 'number') {
      return reply
        .status(429)
        .header('Retry-After', String(err.retryAfter))
        .send({
          code: err.code ?? 429,
          message: err.message || 'Rate limit exceeded',
          retryAfter: err.retryAfter,
        })
    }
    return reply
      .status(statusCode)
      .send({ code: statusCode, message: err.message || '请提供 API Key 鉴权' })
  }

  // === TPM 限流集成(鉴权通过后、请求转发前)===
  // checkTpmQuota 内部读 developer_api_keys.tpmLimit(migration 20260801010060 新增字段)
  const apiKey = request.apiKey
  if (!apiKey) return
  const body = request.body as Record<string, unknown> | undefined
  // 预估 token:优先用 body.max_tokens,无则保守默认 1000
  const estimatedTokens = body && typeof body.max_tokens === 'number' ? body.max_tokens : 1000

  // TPM 检查:超限返回 429;service 异常(Redis/DB 不可用)降级放行
  try {
    const tpmResult = await checkTpmQuota(apiKey.id, estimatedTokens)
    if (!tpmResult.allowed) {
      const retryAfter = Math.max(1, Math.ceil((tpmResult.resetAt.getTime() - Date.now()) / 1000))
      return reply
        .status(429)
        .header('Retry-After', String(retryAfter))
        .send({ code: 429, message: 'TPM limit exceeded', data: null })
    }
  } catch (err) {
    logger.warn('TPM quota check failed, failing open', {
      apiKeyId: apiKey.id,
      error: String(err),
    })
  }

  // 请求结束后记录实际 token 消耗(若 request 上有 usage 统计)
  reply.raw.on('finish', () => {
    const usage = (request as FastifyRequest & { usage?: { totalTokens?: number } }).usage
    const totalTokens = usage?.totalTokens
    if (typeof totalTokens === 'number' && totalTokens > 0) {
      // P2 修复(2026-08-02):空 catch 加日志,避免 TPM 记录失败静默丢失(不影响主响应)
      void recordTpmUsage(apiKey.id, totalTokens).catch((err) => {
        request.log.warn({ err, apiKeyId: apiKey.id }, 'TPM usage record failed')
      })
    }
  })
}

/**
 * Fastify preHandler 工厂:校验 request.apiKey.permissions 包含指定权限点。
 * 必须在 requireApiKeyAuth 之后使用(依赖 request.apiKey 已注入)。
 * 失败 reply 403。
 */
export function requireApiKeyPermission(perm: ApiKeyPermission): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    if (!request.apiKey) {
      return reply.status(401).send({ code: 401, message: '请提供 API Key 鉴权' })
    }
    const perms = request.apiKey.permissions
    // 兼容三种格式:数组(正常) / 对象(老 seed-raw.mjs 误用 {permissions:[...]}) / null
    const permList: string[] = Array.isArray(perms)
      ? (perms as string[])
      : Array.isArray((perms as { permissions?: string[] })?.permissions)
        ? (perms as { permissions: string[] }).permissions
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
      return reply.status(401).send({ code: 401, message: '请提供 API Key 鉴权' })
    }
    const quota = new ApiKeyQuota()
    const result = await quota.checkAndConsume(request.apiKey.id)
    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000))
      return reply
        .status(429)
        .header('Retry-After', String(retryAfter))
        .send({ code: 429, message: '请求过于频繁,请稍后再试' })
    }
  }
}
