// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * API Key 鉴权中间件。
 *
 * 2026-07-22 立:补齐 authenticate 只认 JWT、不认 API Key 的鉴权链路断层。
 *
 * 鉴权链路:
 * - 入站 header:优先 `Authorization: Bearer ihui_xxx`,其次 `X-Api-Key: ihui_xxx`
 * - secret 校验(O2 2026-09-21 收紧):`X-Api-Secret: sk_xxx` **默认必须携带**
 *   (env `API_KEY_REQUIRE_SECRET`,默认 true);缺失 → 401 `SECRET_REQUIRED`。
 *   置 false 回退历史"不带即跳过"行为(过渡期/存量纯 key 客户端)。
 * - 查 developerApiKeys 表(主库,P1-3),status 必须为 'active'
 * - P0-7 安全粒度检查(2026-07-31 立,在 checkQuota 之前):
 *   - checkExpiresAt:过期 → 401
 *   - checkKeyIpAcl:**黑名单优先**(命中 403)→ 白名单不在名单内(403);
 *     匹配支持 IPv4 / IPv6 / IPv4-mapped 归一(O2 2026-09-21)
 *   - checkAllowedModels:模型不在白名单 → 403(body 含 model 时检查)
 *   - checkMaxTokensPerReq:max_tokens 超限 → 403(body 含 max_tokens 时预检)
 * - per-user model rate limit(2026-07-31 立,Redis 滑动窗口):
 *   - checkPerModelRateLimit:按 model 维度检查 RPM/TPM,超限 → 429 + Retry-After(code 1007/1008)
 *   - 配置来源:developer_api_keys.per_model_rpm_limit / per_model_tpm_limit
 *     (jsonb {"gpt-4o": 60},migration 20260921100000 已落地)
 * - Key 级限流窗口(5h/1d/7d,O2 2026-09-21 接入主链路):
 *   - checkKeyRateWindows:窗口打满 → 429(code 1010)+ Retry-After + X-RateLimit-*
 *   - 与 relay 计费链路共用 key-rate-window-service,**不存第二套窗口算法**;
 *     计数增量仍由 billing.recordCall(model 调用)与本源(非 model 调用)分工,避免双计
 * - 限流后端(Redis / 计数读源)不可用时(O2 2026-09-21):
 *   - env `API_KEY_RATE_LIMIT_FAIL_MODE`(默认 'close')
 *   - close:对 billable / risk≠low 的 scope(判据取 @ihui/types 能力目录,不硬编码路由名)
 *     返回 503 `RATE_BACKEND_UNAVAILABLE`;低危只读放行(仅告警)
 *   - open:维持历史 fail-open 行为
 * - 注入 request.apiKey = { id, userId, key, permissions, rateLimit, expiresAt, allowedIps, ... }
 * - lastUsedAt 异步更新,不阻塞响应
 *
 * 导出:
 * - authenticateApiKey(request):核心鉴权函数,失败抛 401/403/429/503
 * - requireApiKeyAuth:Fastify preHandler 版,失败 reply 401/403/429(Retry-After + X-RateLimit-*)/503
 * - requireApiKeyPermission(perm):返回 preHandler,校验 permissions 包含 perm,失败 403;
 *   `'*'` 通配只匹配"已登记且 isM2MAllowed"的 scope(platform 域即使 `'*'` 也拒)
 * - requireApiKeyQuota():返回 preHandler,用 ApiKeyQuota.checkAndConsume,超限 429 + Retry-After
 * - checkExpiresAt / checkAllowedIps / checkAllowedModels / checkMaxTokensPerReq:P0-7 安全检查函数
 * - checkPerModelRateLimit:per-user 单模型 RPM/TPM 限流检查
 * - isStrictRateRequest / findCatalogEntryForRequest:能力目录判据(fail-close 适用面)
 * - isScopeThirdPartyEligible:`'*'` 通配覆盖面与 share 收窄共用的能力目录判据
 * - narrowSharePermissions:share token scope 收窄(源 scopes ∩ thirdPartyEligible)
 */
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'
import { eq } from 'drizzle-orm'
import IORedis, { type Redis } from 'ioredis'
import { db } from '../db/index.js'
import { developerApiKeys } from '@ihui/database'
import type { AuthenticatedApiKey, ApiKeyPermission } from '@ihui/types'
import { CAPABILITY_CATALOG, getCapability, isM2MAllowed, type CapabilityEntry } from '@ihui/types'
import { verifySecret } from '../utils/api-key-hash.js'
import { ApiKeyQuota } from '../utils/api-key-quota.js'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'
import { checkTpmQuota, recordTpmUsage } from '../services/api-key-tpm-service.js'
import { getShareByToken } from '../services/api-key-share-service.js'
import {
  checkKeyIpAcl,
  checkKeyRateWindows,
  incrKeyRateWindows,
  limitsOf,
  type KeyWindowType,
} from '../services/key-rate-window-service.js'

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

/** 带业务错误码的鉴权异常(requireApiKeyAuth 据此渲染 errorCode / Retry-After / X-RateLimit-*)。 */
export interface ApiKeyAuthError extends Error {
  statusCode: number
  /** HTTP 业务码(401/403/429/503 或与 rateLimited 一致的 10xx) */
  code?: number
  /** 机器可读错误码(前端/SDK 判定用),如 SECRET_REQUIRED / RATE_BACKEND_UNAVAILABLE */
  errorCode?: string
  /** 429/503 建议重试秒数 */
  retryAfter?: number
  /** 附带的响应头(429 的 X-RateLimit-*) */
  headers?: Record<string, string>
}

function apiKeyAuthError(
  statusCode: number,
  message: string,
  extra?: Omit<Partial<ApiKeyAuthError>, 'statusCode' | 'message'>,
): ApiKeyAuthError {
  const err = new Error(message) as ApiKeyAuthError
  err.statusCode = statusCode
  Object.assign(err, extra ?? {})
  return err
}

/**
 * O2 2026-09-21:凭据形态收紧 —— 缺失 X-Api-Secret(401 SECRET_REQUIRED)。
 * 仅在 `API_KEY_REQUIRE_SECRET=true`(默认)时抛出。
 */
function secretRequired(): ApiKeyAuthError {
  return apiKeyAuthError(401, 'X-Api-Secret header is required', {
    code: 401,
    errorCode: 'SECRET_REQUIRED',
  })
}

/**
 * O2 2026-09-21:fail-close —— 限流后端(Redis / 窗口计数读源)不可用,
 * 且该请求属于 billable / risk≠low 能力时,拒绝而非放行(503)。
 */
function rateBackendUnavailable(): ApiKeyAuthError {
  return apiKeyAuthError(503, 'Rate limit backend unavailable, request rejected (fail-close)', {
    code: 503,
    errorCode: 'RATE_BACKEND_UNAVAILABLE',
    retryAfter: 5,
  })
}

/** 限流降级形态:close(默认)= billable/高危不可用即拒;open = 历史 fail-open。 */
function rateLimitFailMode(): 'close' | 'open' {
  return config.API_KEY_RATE_LIMIT_FAIL_MODE
}

/**
 * 限流后端(Redis / 窗口计数读源)不可用时的统一处置(O2 2026-09-21)。
 *
 * - `open` 模式:仅告警放行(历史行为);
 * - `close` 模式(默认):仅对"收紧面"请求抛 503 —— 判据来自能力目录的
 *   billable / risk(`isStrictRateRequest`),**不硬编码路由名**;
 *   低危只读端点仍放行。
 *
 * @param scene 记日志用的场景标识(per-model / window / tpm)
 */
function enforceRateBackendAvailability(
  request: FastifyRequest,
  apiKeyId: string,
  scene: 'per-model' | 'key-window' | 'tpm',
  error?: unknown,
): void {
  const mode = rateLimitFailMode()
  const strict = isStrictRateRequest(request, request.capability)
  if (mode === 'open' || !strict) {
    logger.warn('Rate limit backend unavailable, failing open', {
      apiKeyId,
      scene,
      failMode: mode,
      strict,
      error: error === undefined ? undefined : String(error),
    })
    return
  }
  logger.error('Rate limit backend unavailable, rejecting (fail-close)', {
    apiKeyId,
    scene,
    url: request.url,
    error: error === undefined ? undefined : String(error),
  })
  throw rateBackendUnavailable()
}

/**
 * requireApiKeyAuth 借能力目录判定路由的 scope(窗口强制 + fail-close 判据 + '*' 通配判定)。
 */

/**
 * 判定请求是否属于"必须收紧"的范畴(fail-close 503 / 窗口检查适用面):
 * 1. 路由已由能力闸(requireCapability)注入 request.capability,或调用方传入 entry
 *    → 按 entry 判(billable 或 risk ≠ low);
 * 2. 未声明 → 用能力目录 routes 反查(method + path 模式匹配目录登记,不硬编码路由名),
 *    兜底规则:目录命中 → 按 entry 判;`/v1/*` 未命中目录 → 视为 M2M 收紧面
 *    (/v1 是对外开放协议面,O2 需求原文即"`/v1/*` 与 billable scope")。
 */
export function isStrictRateRequest(
  request: FastifyRequest,
  entry: CapabilityEntry | undefined,
): boolean {
  const resolved = entry ?? request.capability
  if (resolved) return resolved.billable || resolved.risk !== 'low'
  const catalogEntry = findCatalogEntryForRequest(request)
  if (catalogEntry) return catalogEntry.billable || catalogEntry.risk !== 'low'
  return request.url.split('?')[0]!.startsWith('/v1/')
}

/** 能力目录 routes 派发的请求匹配器(懒构建缓存;'WS'/带参/:id/通配均可匹配)。 */
let catalogRouteMatchers: Array<{ method: string; regex: RegExp; entry: CapabilityEntry }> | null =
  null

function buildCatalogRouteMatchers(): Array<{
  method: string
  regex: RegExp
  entry: CapabilityEntry
}> {
  if (catalogRouteMatchers) return catalogRouteMatchers
  const matchers: Array<{ method: string; regex: RegExp; entry: CapabilityEntry }> = []
  for (const entry of CAPABILITY_CATALOG) {
    for (const route of entry.routes) {
      const sp = route.indexOf(' ')
      if (sp === -1) continue
      const method = route.slice(0, sp).toUpperCase()
      const pattern = route.slice(sp + 1)
      const regex = new RegExp(
        '^' +
          pattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/:([^/:]+)/g, '[^/]+')
            .replace(/\/\\\*$/, '(/.*)?') +
          '$',
      )
      matchers.push({ method, regex, entry })
    }
  }
  catalogRouteMatchers = matchers
  return matchers
}

/** 按 method + path 在能力目录中反查 entry(未命中返回 undefined)。 */
export function findCatalogEntryForRequest(request: FastifyRequest): CapabilityEntry | undefined {
  const path = request.url.split('?')[0] ?? ''
  // Fastify 路由模式里 params 已解析;直接用原始 path 匹配目录模式即可
  const method = (request.method ?? '').toUpperCase()
  for (const m of buildCatalogRouteMatchers()) {
    if (m.method !== '*' && m.method !== method && !(m.method === 'WS' && method === 'GET')) {
      continue
    }
    if (m.regex.test(path)) return m.entry
  }
  return undefined
}

/**
 * per-user model rate limit 错误(429)。
 * code: 1007 = RPM 超限,1008 = TPM 超限,1010 = Key 级窗口(5h/1d/7d)超限。
 *   (1009 已被"API Key 不属于该租户"占用,见 apps/web ErrorCodeTable,故新码取 1010)
 * retryAfter: 建议客户端等待的秒数(由 requireApiKeyAuth 写入 Retry-After header)。
 */
interface PerModelRateLimitError extends Error {
  statusCode: 429
  code: 1007 | 1008 | 1010
  retryAfter: number
  headers?: Record<string, string>
}

function rateLimited(
  message: string,
  code: 1007 | 1008 | 1010,
  retryAfter: number,
  headers?: Record<string, string>,
): PerModelRateLimitError {
  const err = new Error(message) as PerModelRateLimitError
  err.statusCode = 429
  err.code = code
  err.retryAfter = Math.max(1, Math.ceil(retryAfter))
  if (headers) err.headers = headers
  return err
}

/**
 * O2 2026-09-21:Key 级 5h/1d/7d 窗口打满 → 429(code 1010)。
 * 附 Retry-After + X-RateLimit-Limit / -Remaining / -Reset / -Window。
 */
function keyWindowRateLimited(blocked: {
  windowType: KeyWindowType
  limit: number
  used: number
  resetsAtMs: number
}): PerModelRateLimitError {
  const resetsAtSec = Math.ceil(blocked.resetsAtMs / 1000)
  const retryAfter = Math.max(1, Math.ceil((blocked.resetsAtMs - Date.now()) / 1000))
  return rateLimited(
    `超过 ${blocked.windowType} 窗口请求数限制(${blocked.used}/${blocked.limit})`,
    1010,
    retryAfter,
    {
      'X-RateLimit-Limit': String(blocked.limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(resetsAtSec),
      'X-RateLimit-Window': blocked.windowType,
    },
  )
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
    // 错误事件不在这里降级:ioredis 会自行重连,命令失败由 checkPerModelRateLimit 的
    // catch 标记 backendUnavailable,再按 API_KEY_RATE_LIMIT_FAIL_MODE 决定放行/503。
    redisClient.on('error', () => {
      /* silent — 见 checkPerModelRateLimit 返回值 */
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
 * - 精确匹配:"192.168.1.1" / "2001:db8::1"
 * - 前缀匹配(尾点或尾冒号):"192.168." 匹配 192.168.x.x;"2001:db8:" 匹配 2001:db8::*
 * - CIDR 匹配:"10.0.0.0/24"、"2001:db8::/32"(前缀按各自地址族计,IPv4 ≤32 / IPv6 ≤128)
 * 精确匹配按规范化位串比较,故 "2001:db8::1" ≡ "2001:0DB8:0:0:0:0:0:1";
 * IPv4-mapped IPv6("::ffff:10.0.0.1")与纯 IPv4("10.0.0.1")两侧统一归一后比较(O2 2026-09-21)。
 */
export function ipInList(ip: string, allowed: readonly string[]): boolean {
  const ipNorm = normalizeIp(ip)
  for (const entry of allowed) {
    if (entry === ip) return true
    // 前缀匹配:以 "." 或 ":" 结尾(如 "192.168." / "2001:db8:")
    if (
      (entry.endsWith('.') || entry.endsWith(':')) &&
      (ip.startsWith(entry) || ipNorm.startsWith(entry))
    )
      return true
    // CIDR 匹配:含 "/"(前缀必须是纯十进制整数,"33/44" / "-1" 等畸形条目一律不匹配)
    if (entry.includes('/')) {
      const slashIdx = entry.indexOf('/')
      const network = entry.slice(0, slashIdx)
      const prefixText = entry.slice(slashIdx + 1)
      if (/^\d+$/.test(prefixText) && isCidrMatch(ip, network, Number(prefixText))) return true
      continue
    }
    // 精确匹配的规范化形态:跨大小写 / 零压缩 / IPv4 ↔ IPv4-mapped 写法
    if (sameIp(ip, entry)) return true
  }
  return false
}

/** IPv4 → 4 段数字(严格校验,含 IPv4-mapped 剥离)。非法返回 null。 */
function parseIpv4Octets(s: string): number[] | null {
  let v4 = s
  const lower = s.toLowerCase()
  if (lower.startsWith('::ffff:') && v4.includes('.')) v4 = s.slice(7)
  const parts = v4.split('.')
  if (parts.length !== 4) return null
  const octets: number[] = []
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const n = Number(p)
    if (n > 255) return null
    octets.push(n)
  }
  return octets
}

/** IPv6 → 8 组 16bit(支持 "::" 零压缩与尾段 IPv4 嵌入)。非法返回 null。 */
function parseIpv6Groups(s: string): number[] | null {
  let v6 = s
  if (v6.includes('.')) {
    // 尾段 IPv4 嵌入(::ffff:1.2.3.4 等)→ 换成两组 hex
    const lastColon = v6.lastIndexOf(':')
    const tail = v6.slice(lastColon + 1)
    const octets = parseIpv4Octets(tail)
    if (!octets) return null
    const hi = ((octets[0]! << 8) | octets[1]!).toString(16).padStart(4, '0')
    const lo = ((octets[2]! << 8) | octets[3]!).toString(16).padStart(4, '0')
    v6 = `${v6.slice(0, lastColon + 1)}${hi}:${lo}`
    if (v6.endsWith(':0:0') && v6.startsWith('::ffff:')) v6 = v6.slice(0, -4)
  }
  const ddIdx = v6.indexOf('::')
  let head: string[]
  let tail: string[]
  if (ddIdx !== -1) {
    if (v6.indexOf('::', ddIdx + 1) !== -1) return null // 双 "::" 非法
    head = v6.slice(0, ddIdx) === '' ? [] : v6.slice(0, ddIdx).split(':')
    tail = v6.slice(ddIdx + 2) === '' ? [] : v6.slice(ddIdx + 2).split(':')
  } else {
    head = v6.split(':')
    tail = []
  }
  const parse = (arr: string[]): number[] | null => {
    const out: number[] = []
    for (const g of arr) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null
      out.push(parseInt(g, 16))
    }
    return out
  }
  const headG = parse(head)
  const tailG = parse(tail)
  if (!headG || !tailG) return null
  if (ddIdx === -1) return headG.length === 8 ? headG : null
  const fill = 8 - headG.length - tailG.length
  if (fill < 1) return null
  return [...headG, ...new Array<number>(fill).fill(0), ...tailG]
}

/** 任意 IP 的位串表示 + 地址族(v4 → 32 bit;v6 原生 → 128 bit;非法 → null)。 */
function ipBitsOf(s: string): { bits: string; family: 'v4' | 'v6' } | null {
  // 点分形式:IPv4 与 IPv4-mapped IPv6(::ffff:a.b.c.d)统一按 v4 族比较
  const v4 = parseIpv4Octets(s)
  if (v4) return { bits: octetsToBits(v4), family: 'v4' }
  const groups = parseIpv6Groups(s)
  if (!groups) return null
  const bits = groups.map((g) => g.toString(2).padStart(16, '0')).join('')
  // 十六进制分组的映射形式(::FFFF:0A00:0001)与点分形式同族,否则两种写法互不相等
  if (groups.slice(0, 6).join(',') === '0,0,0,0,0,65535') {
    return { bits: bits.slice(96), family: 'v4' }
  }
  return { bits, family: 'v6' }
}

function octetsToBits(octets: number[]): string {
  return octets.map((o) => o.toString(2).padStart(8, '0')).join('')
}

/** 两个地址是否指向同一主机(跨大小写 / 零压缩 / IPv4-mapped 写法)。 */
function sameIp(a: string, b: string): boolean {
  const x = ipBitsOf(a)
  const y = ipBitsOf(b)
  return !!x && !!y && x.family === y.family && x.bits === y.bits
}

/** IPv4-mapped IPv6 归一:"::ffff:10.0.0.1" → "10.0.0.1";其余原样返回。 */
function normalizeIp(ip: string): string {
  if (ip.toLowerCase().startsWith('::ffff:') && ip.includes('.')) {
    const tail = ip.slice(7)
    return parseIpv4Octets(tail) ? tail : ip
  }
  return ip
}

/**
 * CIDR 匹配(2026-09-21 O2 升级:IPv4 + IPv6 双栈,含 IPv4-mapped 归一)。
 * 实现:两侧各按**自身地址族**展开为位串(v4 按 32 bit、v6 按 128 bit),按前缀逐位比较。
 *
 * 关键:前缀长度是**族内**位数。把 IPv4 塞进 128-bit 的 ::ffff: 空间比较会让 "/24"
 * 退化成"前 24 位恒为 0"从而匹配任意 IPv4(白名单全线绕过)—— 故族不同直接不匹配,
 * 且 prefix 不得超过该族位宽。
 * 保留 P1 修复(2026-08-06)语义:非法前缀(NaN / 超界)一律不匹配。
 */
function isCidrMatch(ip: string, network: string, prefix: number): boolean {
  const a = ipBitsOf(ip)
  const b = ipBitsOf(network)
  if (!a || !b || a.family !== b.family) return false
  const maxBits = a.family === 'v4' ? 32 : 128
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxBits) return false
  if (prefix === 0) return true
  return a.bits.slice(0, prefix) === b.bits.slice(0, prefix)
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
 * - backendUnavailable=true:Redis 客户端/命令异常,未能完成判定(O2 2026-09-21)。
 *   本函数不自行决定降级形态 —— allowed 仍为 true 保持向后兼容,
 *   由调用方按 `API_KEY_RATE_LIMIT_FAIL_MODE` + 能力目录 risk/billable 决定是否 503。
 */
export interface PerModelRateLimitResult {
  allowed: boolean
  retryAfter?: number
  reason?: 'rpm' | 'tpm'
  backendUnavailable?: boolean
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
 * - Redis 故障时返回 { allowed: true, backendUnavailable: true } —— 是否降级放行由调用方
 *   按 `API_KEY_RATE_LIMIT_FAIL_MODE`(默认 close)+ 能力目录判据决定(O2 2026-09-21)
 *
 * @param apiKeyId API Key id
 * @param model 模型名(如 'gpt-4o')
 * @param estimatedTokens 预估 token 数(基于 input tokens + max_tokens)
 * @param rpmLimit 该模型 RPM 上限(undefined/null = 不限制)
 * @param tpmLimit 该模型 TPM 上限(undefined/null = 不限制)
 */
/**
 * P1-7 修复(2026-08-06):RPM 限流 Lua 原子脚本 —— 清理窗口 + 统计 + 写入一次完成,
 * 消除原 zremrangebyscore→zcard→zadd 分离导致的并发绕过(check-then-act 竞态)。
 * 返回 [allowed(0|1), retryAfter];超限时不写入本次请求。
 */
const RPM_CHECK_LUA = `
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
local count = redis.call('ZCARD', KEYS[1])
if count + 1 > limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local retryAfter = math.ceil(window / 1000)
  if #oldest >= 2 then
    retryAfter = math.ceil((tonumber(oldest[2]) + window - now) / 1000)
  end
  return {0, retryAfter}
end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('PEXPIRE', KEYS[1], window)
return {1, 0}
`

/**
 * P1-7 修复(2026-08-06):TPM 限流 Lua 原子脚本 —— ZSET 清理 + HASH 汇总 + 写入一次完成,
 * 消除原 hvals→hset 分离的并发绕过。返回 [allowed(0|1), retryAfter]。
 */
const TPM_CHECK_LUA = `
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local old = redis.call('ZRANGEBYSCORE', KEYS[1], 0, now - window)
if #old > 0 then
  redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
  for _, member in ipairs(old) do
    redis.call('HDEL', KEYS[2], member)
  end
end
local vals = redis.call('HVALS', KEYS[2])
local sum = 0
for _, v in ipairs(vals) do sum = sum + tonumber(v) end
if sum + tonumber(ARGV[5]) > limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local retryAfter = math.ceil(window / 1000)
  if #oldest >= 2 then
    retryAfter = math.ceil((tonumber(oldest[2]) + window - now) / 1000)
  end
  return {0, retryAfter}
end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('HSET', KEYS[2], ARGV[4], ARGV[5])
redis.call('PEXPIRE', KEYS[1], window)
redis.call('PEXPIRE', KEYS[2], window)
return {1, 0}
`

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
    // Redis 客户端初始化失败 → 标记后端不可用(降级形态由调用方决定)
    return { allowed: true, backendUnavailable: true }
  }

  const now = Date.now()
  const reqId = `${now}:${Math.random().toString(36).slice(2, 10)}`

  try {
    // --- RPM 检查(Lua 原子脚本)---
    if (hasRpmLimit) {
      const rpmKey = `relay:ratelimit:rpm:${apiKeyId}:${model}`
      const res = (await redis.eval(
        RPM_CHECK_LUA,
        1,
        rpmKey,
        now,
        RATE_LIMIT_WINDOW_MS,
        rpmLimit as number,
        reqId,
      )) as [number, number]
      if (Number(res[0]) === 0) {
        return { allowed: false, retryAfter: Math.max(1, Number(res[1])), reason: 'rpm' }
      }
    }

    // --- TPM 检查(Lua 原子脚本)---
    if (hasTpmLimit) {
      const tpmZsetKey = `relay:ratelimit:tpm:z:${apiKeyId}:${model}`
      const tpmHashKey = `relay:ratelimit:tpm:h:${apiKeyId}:${model}`
      const res = (await redis.eval(
        TPM_CHECK_LUA,
        2,
        tpmZsetKey,
        tpmHashKey,
        now,
        RATE_LIMIT_WINDOW_MS,
        tpmLimit as number,
        reqId,
        estimatedTokens,
      )) as [number, number]
      if (Number(res[0]) === 0) {
        return { allowed: false, retryAfter: Math.max(1, Number(res[1])), reason: 'tpm' }
      }
    }

    return { allowed: true }
  } catch {
    // Redis 命令失败 → 标记后端不可用(不在此处自行降级放行)
    return { allowed: true, backendUnavailable: true }
  }
}

/**
 * scope 是否"能力目录已登记且第三方可申请"(isM2MAllowed)。
 *
 * 单一判据,O2 2026-09-21 两处复用:
 * - `'*'` 通配的覆盖面(requireApiKeyPermission);
 * - share token 的 scope 收窄(narrowSharePermissions)。
 * 未登记(目录漂移)与 platform 域 / thirdPartyEligible=false 一律 false。
 */
export function isScopeThirdPartyEligible(scope: string): boolean {
  const entry = getCapability(scope as ApiKeyPermission)
  if (!entry) return false
  return isM2MAllowed(entry.scope)
}

/**
 * O2 兼容性收窄(2026-09-21):share token 的有效 scopes =
 * 源 Key scopes ∩ thirdPartyEligible(能力目录判据)。
 * - 源 Key 的 `'*'` 通配**不得**继承(否则 share 直接拿到全量已登记权限);
 *   展开为目录内全部 isM2MAllowed 的 scope。
 * - platform 域 / 未登记 / thirdPartyEligible=false 的 scope 一律剔除。
 */
export function narrowSharePermissions(sourcePerms: readonly string[]): ApiKeyPermission[] {
  const list = Array.isArray(sourcePerms) ? sourcePerms : []
  if (list.includes('*')) {
    return CAPABILITY_CATALOG.filter((e) => isM2MAllowed(e.scope)).map((e) => e.scope)
  }
  return list.filter((p) => isScopeThirdPartyEligible(p))
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
 * 凭据形态:share_ token 是自包含单因子凭据(无独立 secret),
 *   故 `API_KEY_REQUIRE_SECRET` 双因子要求不适用于本分支(仅约束 ihui_ 主 Key)。
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

  // P1 修复(2026-08-06):源 Key 过期检查。原 share 鉴权只校验了源 Key 的
  // status 与 IP 白名单,未继承源 Key 的 expiresAt — 源 Key 过期后 share token
  // 仍可继续调用(绕过主 Key 鉴权链路的过期检查),此处与主链路保持一致。
  const sourceExpiryCheck = checkExpiresAt(share.sourceKey.expiresAt)
  if (!sourceExpiryCheck.ok) throw unauthorized('Source API key expired')

  // P1 修复(2026-08-06):原实现未校验源 Key 的 IP 白名单,
  // 源 Key 的 IP 约束可被 share token 绕过。
  // O2 升级(2026-09-21):与主链路统一走 checkKeyIpAcl(黑名单优先于白名单,
  // 支持 IPv6 / IPv4-mapped;单一算法落点,不在两处各写一份)。
  const ipCheck = checkKeyIpAcl(
    {
      blockedIps: share.sourceKey.blockedIps,
      allowedIps: share.sourceKey.allowedIps,
      requestIp: request.ip,
    },
    ipInList,
  )
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
  // Redis 故障时按 API_KEY_RATE_LIMIT_FAIL_MODE 处置(与主链路同一判据)
  // P2-3 修复(2026-08-06):原预估只用 max_tokens(输出上限),低估真实消耗。
  // 增加输入估算:prompt 字符数 / 4(约 4 字符 ≈ 1 token,中文更密),与输出上限求和。
  const bodyAny = body as { messages?: unknown; max_tokens?: number }
  const promptText = Array.isArray(bodyAny.messages)
    ? bodyAny.messages
        .map((m) => {
          const mm = m as { content?: unknown }
          return typeof mm?.content === 'string' ? mm.content : ''
        })
        .join('')
    : ''
  const promptEstimate = Math.ceil(promptText.length / 4)
  const maxTokens = typeof bodyAny.max_tokens === 'number' ? bodyAny.max_tokens : 1000
  const estimatedTokens = promptEstimate + maxTokens
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
  if (rlResult.backendUnavailable) {
    // share token 属第三方对外面,fail-close 判据与主链路一致(能力目录)
    enforceRateBackendAvailability(request, share.sourceApiKeyId, 'per-model')
  }

  // 注入 sourceApiKeyId 作为当前 apiKeyId,继承源 Key 配置
  // O2(2026-09-21):permissions 收窄为 源 scopes ∩ thirdPartyEligible,
  // 不继承 '*'/platform;窗口限额与黑名单不随 share 继承(share 有独立 RPM/TPM)。
  const ctx: AuthenticatedApiKey = {
    id: share.sourceApiKeyId,
    userId: share.sourceKey.userId,
    key: share.sourceKey.key,
    permissions: narrowSharePermissions(
      (share.sourceKey.permissions as unknown[] | null as string[] | null) ?? [],
    ),
    rateLimit: share.sourceKey.rateLimit,
    expiresAt: share.sourceKey.expiresAt,
    allowedIps: (share.sourceKey.allowedIps as string[] | null) ?? null,
    allowedModels: (share.sourceKey.allowedModels as string[] | null) ?? null,
    maxTokensPerReq: share.sourceKey.maxTokensPerReq,
    blockedIps: (share.sourceKey.blockedIps as string[] | null) ?? null,
    rateLimit5h: null,
    rateLimit1d: null,
    rateLimit7d: null,
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

  // P1-3 修复(2026-08-06):鉴权关键路径改走主库 db(原用 dbRead 查 key,
  // 新建 key 后立即鉴权可能因复制延迟查不到,且副本故障时鉴权雪崩)。
  const [row] = await db
    .select()
    .from(developerApiKeys)
    .where(eq(developerApiKeys.key, key))
    .limit(1)

  if (!row || row.status !== 'active') throw unauthorized('Invalid or revoked API key')

  // --- 凭据形态收紧(O2 2026-09-21)---
  // `API_KEY_REQUIRE_SECRET=true`(默认):X-Api-Secret 必须携带,缺失 → 401 SECRET_REQUIRED。
  // 置 false 回退历史"不带即跳过"行为(存量纯 key 客户端过渡期)。
  const xSecret = request.headers['x-api-secret']
  if (typeof xSecret === 'string' && xSecret.length > 0) {
    if (!verifySecret(xSecret, row.secret)) throw unauthorized('Invalid API key secret')
  } else if (config.API_KEY_REQUIRE_SECRET) {
    throw secretRequired()
  }

  // --- P0-7 安全粒度检查(2026-07-31 立,在 checkQuota 之前执行)---
  // 1. 过期检查:过期 → 401
  const expiresCheck = checkExpiresAt(row.expiresAt)
  if (!expiresCheck.ok) throw unauthorized(expiresCheck.reason!)

  // 2. IP ACL:黑名单优先命中 → 403;白名单存在且不在名单内 → 403
  //    (与 relay 计费链路共用 checkKeyIpAcl,匹配算法支持 IPv4/IPv6/IPv4-mapped)
  const ipCheck = checkKeyIpAcl(
    { blockedIps: row.blockedIps, allowedIps: row.allowedIps, requestIp: request.ip },
    ipInList,
  )
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
  //    仅当 body 含 model 且 developer_api_keys 配置了 per_model_rpm_limit / per_model_tpm_limit
  //    对应模型条目时触发。两列由 migration 20260921100000 落地(O2 2026-09-21),
  //    原"字段未落地 → as 断言恒 undefined → 限流恒跳过"死分支已删除,Lua 窗口真正生效。
  if (bodyModel) {
    const rpmLimit = row.perModelRpmLimit?.[bodyModel]
    const tpmLimit = row.perModelTpmLimit?.[bodyModel]
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
    if (rlResult.backendUnavailable) {
      enforceRateBackendAvailability(request, row.id, 'per-model')
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
    // Key 级限流窗口 + IP 黑名单(O2 2026-09-21,与 schema 同步)
    blockedIps: (row.blockedIps as string[] | null) ?? null,
    rateLimit5h: row.rateLimit5h,
    rateLimit1d: row.rateLimit1d,
    rateLimit7d: row.rateLimit7d,
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
 * 鉴权通过后的配额强制(O2 2026-09-21 接入主链路)。
 *
 * 1. Key 级 5h/1d/7d 窗口 —— 复用 key-rate-window-service 的 checkKeyRateWindows
 *    (与 relay 计费链路同一套窗口算法,此处不复制第二份实现);打满 → 429(code 1010,
 *    带 Retry-After + X-RateLimit-*),计数读源异常 → 按 fail 模式处置。
 * 2. TPM 每分钟 token 窗口 —— checkTpmQuota 超限 → 429;其抛异常(Redis/DB 不可用)
 *    不再无条件 fail-open,统一走 enforceRateBackendAvailability。
 *
 * 三列全 NULL 的存量 Key:checkKeyRateWindows 零查询直接放行,行为完全不变。
 */
async function enforceApiKeyQuotaAfterAuth(
  request: FastifyRequest,
  apiKey: AuthenticatedApiKey,
): Promise<void> {
  // === 1. Key 级限流窗口(5h/1d/7d)===
  const windowCheck = await checkKeyRateWindows(
    apiKey.id,
    limitsOf(apiKey),
    new Date(),
    rateLimitFailMode(),
  )
  if (!windowCheck.allowed && windowCheck.blocked) throw keyWindowRateLimited(windowCheck.blocked)
  if (windowCheck.backendUnavailable) {
    enforceRateBackendAvailability(request, apiKey.id, 'key-window')
  }

  // === 2. TPM 限流(checkTpmQuota 内部读 developer_api_keys.tpmLimit)===
  const body = request.body as Record<string, unknown> | undefined
  // 预估 token:优先用 body.max_tokens,无则保守默认 1000
  const estimatedTokens = body && typeof body.max_tokens === 'number' ? body.max_tokens : 1000
  try {
    const tpmResult = await checkTpmQuota(apiKey.id, estimatedTokens)
    if (!tpmResult.allowed) {
      const retryAfter = Math.max(1, Math.ceil((tpmResult.resetAt.getTime() - Date.now()) / 1000))
      throw rateLimited('TPM limit exceeded', 1008, retryAfter)
    }
  } catch (err) {
    // 已是本模块产出的限流异常 → 原样上抛;否则视为后端不可用
    if ((err as ApiKeyAuthError).statusCode === 429) throw err
    enforceRateBackendAvailability(request, apiKey.id, 'tpm', err)
  }
}

/** 把鉴权/配额异常渲染为响应(401/403/429/503 + errorCode + Retry-After + X-RateLimit-*)。 */
function sendApiKeyAuthError(
  reply: FastifyReply,
  err: Error & { statusCode?: number; code?: number; retryAfter?: number },
): FastifyReply {
  const statusCode = err.statusCode ?? 401
  const e = err as ApiKeyAuthError
  const out = reply.status(statusCode)
  if (typeof e.retryAfter === 'number') out.header('Retry-After', String(e.retryAfter))
  for (const [k, v] of Object.entries(e.headers ?? {})) out.header(k, v)
  const payload: Record<string, unknown> = {
    code: statusCode === 429 ? (e.code ?? 429) : statusCode,
    message: e.message || '请提供 API Key 鉴权',
    data: null,
  }
  if (e.errorCode) payload.errorCode = e.errorCode
  if (typeof e.retryAfter === 'number') payload.retryAfter = e.retryAfter
  return out.send(payload)
}

/**
 * Fastify preHandler:强制 API Key 鉴权 + 配额强制。
 * 失败 reply 401(含 SECRET_REQUIRED)/ 403 / 429(Retry-After + X-RateLimit-*)/ 503
 * (RATE_BACKEND_UNAVAILABLE,fail-close)。
 */
export const requireApiKeyAuth: preHandlerAsyncHookHandler = async (request, reply) => {
  let apiKey: AuthenticatedApiKey | undefined
  try {
    apiKey = await authenticateApiKey(request)
    if (apiKey) await enforceApiKeyQuotaAfterAuth(request, apiKey)
  } catch (e) {
    return sendApiKeyAuthError(reply, e as Error & { statusCode?: number })
  }

  if (!apiKey) return
  const apiKeyId = apiKey.id

  // 请求结束后记录实际 token 消耗(若 request 上有 usage 统计)
  reply.raw.on('finish', () => {
    const usage = (request as FastifyRequest & { usage?: { totalTokens?: number } }).usage
    const totalTokens = usage?.totalTokens
    if (typeof totalTokens === 'number' && totalTokens > 0) {
      // P2 修复(2026-08-02):空 catch 加日志,避免 TPM 记录失败静默丢失(不影响主响应)
      void recordTpmUsage(apiKeyId, totalTokens).catch((err) => {
        request.log.warn({ err, apiKeyId }, 'TPM usage record failed')
      })
    }
    // === Key 级窗口计数(O2 2026-09-21)===
    // 带 model 的调用由 relay 计费链路 recordCall 统一 +1(避免双计);
    // 不经计费的非 model 端点在此补计,2xx 才计数。内部自查限额,全 NULL 零写入。
    const hasModel = typeof (request.body as { model?: unknown } | undefined)?.model === 'string'
    if (!hasModel && reply.statusCode < 400) {
      void incrKeyRateWindows(apiKeyId).catch(() => {})
    }
  })
}

/**
 * Fastify preHandler 工厂:校验 request.apiKey.permissions 包含指定权限点。
 * 必须在 requireApiKeyAuth 之后使用(依赖 request.apiKey 已注入)。
 * 失败 reply 403。
 *
 * `'*'` 通配语义收窄(O2 2026-09-21):历史行为是"有 '*' 即无限权限"(含 platform
 * 运营面);现只覆盖**能力目录已登记且 isM2MAllowed** 的 scope ——
 * platform 域即使 key 持有 `'*'` 也 403,未登记 scope 同拒。
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
    // 通配符 * 表示"全部可对外(M2M)权限",非无限权限(O2 收窄:platform 域即使 '*' 也 403)
    const coveredByWildcard = permList.includes('*') && isScopeThirdPartyEligible(perm)
    if (!permList.includes(perm) && !coveredByWildcard) {
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
