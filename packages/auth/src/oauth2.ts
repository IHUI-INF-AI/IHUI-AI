// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OAuth2 Server 底层逻辑 + PKCE。
 *
 * 设计对齐 legacy `app/api/v1/auth/oauth.py` 的 Coze 多模式 OAuth2 + PKCE。
 * 本文件只实现可复用的底层逻辑（生成 code / 验证 redirect_uri / PKCE 计算 / 换 token），
 * HTTP 端点（/oauth/authorize、/oauth/token）属于 apps/api 的工作。
 *
 * 关键安全点:
 *  - PKCE verifier: 43-128 字符的 [A-Z0-9-._~] 串（RFC 7636）
 *  - S256 challenge: base64url(sha256(verifier))，去 padding
 *  - authorization code: 32 字节随机串，base64url 编码，默认 10 分钟过期
 *  - code 只能兑换一次（exchangeCodeForToken 消费后从 store 删除）
 *  - clientSecret 比对使用时间恒定比较（防时序攻击）
 */
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { SignJWT, exportJWK, importPKCS8, importSPKI, jwtVerify, type JWK } from 'jose'
import type IORedis from 'ioredis'
import { ACCESS_TOKEN_TTL_SECONDS, AUDIENCE, getJwtSecret } from './jwt'

// ---------------------------------------------------------------------------
// OAuth2Client
// ---------------------------------------------------------------------------

export interface OAuth2Client {
  clientId: string
  /** 公开客户端传 PUBLIC_CLIENT_SECRET 哨兵;现代客户端存摘要(v1hmac$…)。 */
  clientSecret: string
  /** 存量 legacy 应用为 null;非空即"现代客户端",强制 PKCE 且不接受明文比对。 */
  clientSecretHash?: string | null
  redirectUris: string[]
  scopes: string[]
  name: string
}

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

export type PkceMethod = 'S256' | 'plain'

/** RFC 7636: verifier 43-128 字符，字符集 [A-Z]/[a-z]/[0-9]/"-"/"."/"_"/"~" */
const PKCE_VERIFIER_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
const PKCE_VERIFIER_MIN = 43
const PKCE_VERIFIER_MAX = 128

/**
 * 生成 PKCE code_verifier（43-128 字符随机串）。
 * 默认生成 64 字符，处于 RFC 推荐区间。
 */
export function generatePkceVerifier(length = 64): string {
  if (length < PKCE_VERIFIER_MIN || length > PKCE_VERIFIER_MAX) {
    throw new Error(
      `PKCE verifier 长度必须为 ${PKCE_VERIFIER_MIN}-${PKCE_VERIFIER_MAX}, 实际 ${length}`,
    )
  }
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += PKCE_VERIFIER_CHARSET[bytes[i]! % PKCE_VERIFIER_CHARSET.length]
  }
  return out
}

/** base64url 编码（去 padding），RFC 4648 §5 */
function base64url(input: Buffer): string {
  return input.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * 生成 PKCE code_challenge。
 *  - S256:  base64url(sha256(verifier))
 *  - plain: 直接返回 verifier（不推荐，仅兼容老客户端）
 */
export function generatePkceChallenge(verifier: string, method: PkceMethod = 'S256'): string {
  if (method === 'plain') return verifier
  if (method === 'S256') {
    const digest = createHash('sha256').update(verifier, 'utf8').digest()
    return base64url(digest)
  }
  throw new Error(`不支持的 PKCE method: ${method}`)
}

/**
 * 校验 PKCE verifier 是否匹配 challenge。
 * 使用时间恒定比较防时序攻击。
 */
export function validatePkce(verifier: string, challenge: string, method: PkceMethod): boolean {
  if (!verifier || !challenge) return false
  let expected: string
  try {
    expected = generatePkceChallenge(verifier, method)
  } catch {
    return false
  }
  if (expected.length !== challenge.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(challenge))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// redirect_uri 校验
// ---------------------------------------------------------------------------

/**
 * 校验 redirect_uri 是否在 client 注册的白名单内。
 *  - 严格完全匹配（OAuth2 安全最佳实践，不支持通配符，防 open redirect）
 *  - 大小写敏感（与 URL 规范一致）
 */
export function validateRedirectUri(client: OAuth2Client, redirectUri: string): boolean {
  if (!redirectUri) return false
  return client.redirectUris.includes(redirectUri)
}

/** 时间恒定的字符串比较 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// authorization code 生成
// ---------------------------------------------------------------------------

/**
 * 生成 authorization code。
 * 注意: 此函数只负责生成 code 字符串，不负责持久化。
 * 调用方需用 AuthorizationCodeStore 把 (code → 完整记录) 存入 Redis / 内存。
 */
export function generateAuthorizationCode(
  _clientId: string,
  _userId: string,
  _scope: string,
  _redirectUri: string,
  expiresInSeconds = 600,
): string {
  if (expiresInSeconds <= 0) {
    throw new Error('expiresInSeconds 必须为正数')
  }
  // 32 字节随机 → base64url → 约 43 字符，不可猜测
  return base64url(randomBytes(32))
}

// ---------------------------------------------------------------------------
// AuthorizationCodeStore
// ---------------------------------------------------------------------------

export interface StoredAuthorizationCode {
  code: string
  clientId: string
  userId: string
  redirectUri: string
  scopes: string[]
  codeChallenge?: string
  codeChallengeMethod?: PkceMethod
  expiresAt: Date
}

/**
 * AuthorizationCode 持久化接口。
 *  - 内存实现: 单实例开发/测试用
 *  - Redis 实现: 生产用，跨进程共享
 */
export interface AuthorizationCodeStore {
  save(code: StoredAuthorizationCode): Promise<void>
  consume(code: string): Promise<StoredAuthorizationCode | null>
}

/** 内存实现（开发用）。code 消费后即删除，过期项通过 setTimeout 自动清理。 */
export class InMemoryAuthorizationCodeStore implements AuthorizationCodeStore {
  private readonly store = new Map<string, StoredAuthorizationCode>()
  private readonly timers = new Map<string, NodeJS.Timeout>()

  async save(entry: StoredAuthorizationCode): Promise<void> {
    this.store.set(entry.code, entry)
    // 过期自动清理,避免未被 consume 的 code 长期驻留导致内存泄漏
    const ttl = entry.expiresAt.getTime() - Date.now()
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.store.delete(entry.code)
        this.timers.delete(entry.code)
      }, ttl) as unknown as NodeJS.Timeout
      // Node.js 事件循环不持有 ref 的 timer 不会阻止进程退出
      timer.unref?.()
      this.timers.set(entry.code, timer as unknown as NodeJS.Timeout)
    } else {
      this.store.delete(entry.code)
    }
  }

  async consume(code: string): Promise<StoredAuthorizationCode | null> {
    const entry = this.store.get(code)
    if (!entry) return null
    this.store.delete(code)
    // 清理对应的过期定时器
    const timer = this.timers.get(code)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(code)
    }
    if (entry.expiresAt.getTime() < Date.now()) return null
    return entry
  }
}

/**
 * Redis 实现骨架（生产用）。
 *  - key: oauth:code:<code>
 *  - value: JSON 序列化的 StoredAuthorizationCode
 *  - TTL: 与 expiresAt 同步，过期自动清理
 *  - 消费: 用 GETDEL 原子取出并删除，防重放
 */
export class RedisAuthorizationCodeStore implements AuthorizationCodeStore {
  private readonly prefix = 'oauth:code:'

  constructor(private readonly redis: IORedis) {}

  async save(entry: StoredAuthorizationCode): Promise<void> {
    const ttl = Math.max(1, Math.floor((entry.expiresAt.getTime() - Date.now()) / 1000))
    await this.redis.setex(`${this.prefix}${entry.code}`, ttl, JSON.stringify(entry))
  }

  async consume(code: string): Promise<StoredAuthorizationCode | null> {
    const key = `${this.prefix}${code}`
    // GETDEL 原子取出并删除，防 code 被多次消费（OAuth2 安全要求）
    const raw = await this.redis.getdel(key)
    if (!raw) return null
    try {
      // JSON.parse 后 expiresAt 是 ISO 字符串(JSON.stringify 把 Date 转字符串),
      // 需 new Date() 还原,否则 .getTime() 抛 TypeError 导致 consume 永远返回 null
      const parsed = JSON.parse(raw) as Omit<StoredAuthorizationCode, 'expiresAt'> & {
        expiresAt: string
      }
      const entry: StoredAuthorizationCode = { ...parsed, expiresAt: new Date(parsed.expiresAt) }
      if (entry.expiresAt.getTime() < Date.now()) return null
      return entry
    } catch {
      return null
    }
  }
}

// ---------------------------------------------------------------------------
// exchangeCodeForToken
// ---------------------------------------------------------------------------

export interface ExchangeCodeInput {
  code: string
  codeVerifier?: string
  clientId: string
  /** 公开客户端(PKCE-only)不携带 secret,故为可选。 */
  clientSecret?: string
  /** 若客户端在 authorize 回传了 redirect_uri,则与授权时记录的做恒定比较(RFC 6749 §4.1.3)。 */
  redirectUri?: string
}

/** validateAuthorizationCode 的策略入参(全部可选,保持对既有调用方向后兼容)。 */
export interface ValidateCodeOptions {
  policy?: PkcePolicy
  /** true = 该 client 无 secret(公开客户端),跳过 secret 校验但强制 PKCE */
  isPublicClient?: boolean
  /** 现代客户端(DCR 注册)无条件要求 PKCE */
  requirePkceForClient?: boolean
}

export interface ExchangeCodeResult {
  accessToken: string
  refreshToken: string
}

/**
 * 校验 code + client + PKCE，校验通过后消费 code。
 * 注意: 本函数只做校验与 code 消费，不签发 JWT（签发由 apps/api 调用 signAccessToken 完成）。
 *       本函数返回一个占位 token 对（空串），调用方拿到校验结果后自行签发。
 *
 * 为什么这样设计: JWT 签发依赖 familyId / roleId 等业务字段，本包底层不应假设这些字段。
 *                分离校验与签发，让 apps/api 灵活控制 token payload。
 *
 * @returns 校验通过返回 { userId, scopes }，调用方据此签发 JWT。
 *          校验失败抛错（invalid_grant / invalid_client）。
 */
export interface ValidatedCode {
  userId: string
  scopes: string[]
  clientId: string
  redirectUri: string
}

export class OAuth2Error extends Error {
  constructor(
    public readonly code: OAuthErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'OAuth2Error'
  }
}

/**
 * 校验 authorization code 并消费（一次性）。
 * 校验顺序（OAuth2 spec §4.1.3）:
 *  1. code 存在且未过期
 *  2. clientId 匹配
 *  3. clientSecret 匹配（时间恒定比较）
 *  4. codeChallengeMethod + codeVerifier 匹配（PKCE）
 *
 * 校验通过后 code 从 store 删除（防重放）。
 * 校验失败抛 OAuth2Error，调用方据此返回 400 + error code。
 */
export async function validateAuthorizationCode(
  store: AuthorizationCodeStore,
  client: OAuth2Client,
  input: ExchangeCodeInput,
  options: ValidateCodeOptions = {},
): Promise<ValidatedCode> {
  const entry = await store.consume(input.code)
  if (!entry) {
    throw new OAuth2Error('invalid_grant', 'authorization code 不存在、已过期或已被消费')
  }

  // clientId 必须匹配
  if (entry.clientId !== input.clientId || input.clientId !== client.clientId) {
    throw new OAuth2Error('invalid_client', 'clientId 不匹配')
  }

  const isPublicClient = options.isPublicClient === true || isPublicClientApp(client)
  // clientSecret 时间恒定比较(公开客户端不带 secret,改由 PKCE 证明持有者)
  if (!isPublicClient && !verifyClientSecret(client, input.clientSecret)) {
    throw new OAuth2Error('invalid_client', 'clientSecret 不匹配')
  }

  // PKCE 校验:走 evaluatePkce 唯一真相源(公开客户端 / 现代客户端强制,不可豁免)
  const pkce = evaluatePkce({
    session: entry,
    codeVerifier: input.codeVerifier,
    isPublicClient,
    policy: options.policy ?? pkcePolicyFromEnv(),
    requirePkceForClient: options.requirePkceForClient,
  })
  if (!pkce.ok) {
    throw new OAuth2Error(
      pkce.error === 'invalid_request' ? 'invalid_request' : 'invalid_grant',
      pkce.description,
    )
  }

  if (input.redirectUri && input.redirectUri !== entry.redirectUri) {
    throw new OAuth2Error('invalid_grant', 'redirect_uri 与授权时不一致')
  }

  return {
    userId: entry.userId,
    scopes: entry.scopes,
    clientId: entry.clientId,
    redirectUri: entry.redirectUri,
  }
}

/**
 * 换取 token 的完整流程（校验 + 返回占位 token）。
 *
 * 注意: 返回的 accessToken / refreshToken 为空串。
 * 调用方应在 apps/api 层用 signAccessToken / signRefreshToken 签发真实 JWT。
 * 保留此函数签名是为了与 task 描述对齐：
 *   exchangeCodeForToken(code, codeVerifier, clientId, clientSecret) → { accessToken, refreshToken }
 *
 * 真实使用示例（apps/api 层）:
 *   const result = await validateAuthorizationCode(store, client, { code, codeVerifier, clientId, clientSecret });
 *   const accessToken = await signAccessToken({ userId: result.userId, ... });
 *   const refreshToken = await signRefreshToken({ userId: result.userId, ... });
 */
export async function exchangeCodeForToken(
  store: AuthorizationCodeStore,
  client: OAuth2Client,
  input: ExchangeCodeInput,
): Promise<ExchangeCodeResult> {
  await validateAuthorizationCode(store, client, input)
  // 实际 JWT 签发交给 apps/api（依赖业务 payload），这里返回占位
  return { accessToken: '', refreshToken: '' }
}

// ---------------------------------------------------------------------------
// 便捷: 生成完整的 authorization code 记录并持久化
// ---------------------------------------------------------------------------

export interface CreateAuthorizationCodeInput {
  clientId: string
  userId: string
  redirectUri: string
  scopes: string[]
  pkce?: {
    codeChallenge: string
    codeChallengeMethod: PkceMethod
  }
  expiresInSeconds?: number
}

/**
 * 生成 authorization code 并存入 store。
 * 调用方在 /oauth/authorize 端点收到请求后调用此函数，
 * 然后把 code 通过 redirect_uri 回传给客户端。
 */
export async function createAndStoreAuthorizationCode(
  store: AuthorizationCodeStore,
  input: CreateAuthorizationCodeInput,
): Promise<string> {
  const ttl = input.expiresInSeconds ?? 600
  const code = generateAuthorizationCode(
    input.clientId,
    input.userId,
    input.scopes.join(' '),
    input.redirectUri,
    ttl,
  )
  const entry: StoredAuthorizationCode = {
    code,
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    scopes: input.scopes,
    codeChallenge: input.pkce?.codeChallenge,
    codeChallengeMethod: input.pkce?.codeChallengeMethod,
    expiresAt: new Date(Date.now() + ttl * 1000),
  }
  await store.save(entry)
  return code
}

/** 生成一个新的 clientId（用于注册新 OAuth2 应用） */
export function generateClientId(): string {
  return `cli_${randomUUID().replace(/-/g, '')}`
}

/** 生成一个新的 clientSecret（明文，调用方应自行 bcrypt 哈希后存库） */
export function generateClientSecret(): string {
  return `sec_${base64url(randomBytes(32))}`
}

// ===========================================================================
// OAuth 2.1 / OIDC 提供方补齐(O7,2026-09-21 立)
//
// 本区段只放"纯函数 + 类型"(无 Fastify / 无数据库依赖),供 apps/api 的
// /oauth/* 端点(AS 表面)与既有 /api/auth/oauth/* 端点共用同一套判定逻辑,
// 避免"每个端点各写一份校验"导致的安全断层(历史上 /auth/oauth/token
// 就是漏了 PKCE 校验,见 evaluatePkce)。
// ===========================================================================

/** RFC 6749 §5.2 + RFC 7009/7662 注册的标准错误码(不发明私有码)。 */
export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'invalid_scope'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'unsupported_response_type'
  | 'unsupported_token_type'
  | 'access_denied'
  | 'server_error'
  | 'temporarily_unavailable'
  // OIDC Core §3.1.2.6 注册码(授权端点回跳用)
  | 'login_required'
  | 'consent_required'
  | 'interaction_required'
  // RFC 7591 §3.2.2(DCR 专用错误码)
  | 'invalid_redirect_uri'
  | 'invalid_client_metadata'
  // RFC 7009 §2.2 / RFC 7662(Bearer 与吊销语义)
  | 'invalid_token'

/** 错误码 → HTTP 状态码(RFC 6749 §5.2:token 端点错误统一 400;客户端凭证错 401)。 */
export const OAUTH_ERROR_HTTP_STATUS: Record<OAuthErrorCode, number> = {
  invalid_request: 400,
  invalid_client: 401,
  invalid_grant: 400,
  invalid_scope: 400,
  unauthorized_client: 400,
  unsupported_grant_type: 400,
  unsupported_response_type: 400,
  unsupported_token_type: 400,
  access_denied: 403,
  server_error: 500,
  temporarily_unavailable: 503,
  login_required: 401,
  consent_required: 400,
  interaction_required: 400,
  invalid_redirect_uri: 400,
  invalid_client_metadata: 400,
  invalid_token: 401,
}

export function oauthErrorStatus(code: OAuthErrorCode): number {
  return OAUTH_ERROR_HTTP_STATUS[code] ?? 400
}

/**
 * 构造 RFC 6749 §5.2 形状的错误体 `{error, error_description}`。
 *
 * 与项目统一响应 `{code, message, data}` 的关系:根级 `/oauth/*`(AS 表面)
 * 走 RFC 形状 —— 与 `/v1` 原生协议同构,第三方 Agent(MCP/Claude/Cursor)
 * 的 OAuth 客户端库只认 `error` 字段,包一层 `{code,message}` 会直接解析失败。
 */
export function buildOAuthErrorBody(
  error: OAuthErrorCode,
  errorDescription?: string,
  extra?: Record<string, string | number | undefined>,
): Record<string, string | number> {
  const body: Record<string, string | number> = { error }
  if (errorDescription) body.error_description = errorDescription
  if (extra) {
    for (const [k, v] of Object.entries(extra)) if (v !== undefined) body[k] = v
  }
  return body
}

/** OAuth2Error 增强:携带 RFC 错误码 + HTTP 状态,路由侧直接 reply.status(err.status)。 */
export class OAuth2RequestError extends Error {
  readonly status: number
  constructor(
    readonly error: OAuthErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'OAuth2RequestError'
    this.status = oauthErrorStatus(error)
  }
}

// ---------------------------------------------------------------------------
// scope 工具
// ---------------------------------------------------------------------------

/** `read:profile write:orders` / `['read:profile','write:orders']` → 去重去空数组。 */
export function normalizeScopes(input: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/\s+/) : []
  const out: string[] = []
  for (const item of raw) {
    const s = typeof item === 'string' ? item.trim() : ''
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

/** 请求 scope 与客户端可用 scope 求交,返回授予集与被拒集(空请求 = 授予客户端全部 scope)。 */
export function resolveGrantedScopes(
  requested: string | string[] | null | undefined,
  allowed: string | string[] | null | undefined,
): { granted: string[]; rejected: string[] } {
  const allowList = normalizeScopes(allowed)
  const reqList = normalizeScopes(requested)
  if (reqList.length === 0) return { granted: allowList, rejected: [] }
  const granted: string[] = []
  const rejected: string[] = []
  for (const s of reqList) (allowList.includes(s) ? granted : rejected).push(s)
  return { granted, rejected }
}

// ---------------------------------------------------------------------------
// 客户端凭证提取(RFC 7662/6749 §2.3.1:client_secret_basic + client_secret_post)
// ---------------------------------------------------------------------------

export type TokenEndpointAuthMethod = 'client_secret_basic' | 'client_secret_post' | 'none'

export interface PresentedClientCredentials {
  clientId: string | null
  clientSecret: string | null
  method: TokenEndpointAuthMethod
}

/**
 * 从 `Authorization: Basic base64(client_id:client_secret)` 或表单/JSON body 提取客户端凭证。
 * 不引入 Fastify 类型:调用方传 headers/body 即可(便于单测)。
 * 说明:URL 编码由 decodeURIComponent 处理;解码失败按缺失处理(不抛错)。
 */
export function extractClientCredentials(input: {
  authorizationHeader?: string | null
  body?: unknown
}): PresentedClientCredentials {
  const header = input.authorizationHeader?.trim() ?? ''
  if (header.toLowerCase().startsWith('basic ')) {
    try {
      const decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8')
      const sep = decoded.indexOf(':')
      if (sep >= 0) {
        return {
          clientId: safeDecodeURIComponent(decoded.slice(0, sep)),
          clientSecret: safeDecodeURIComponent(decoded.slice(sep + 1)),
          method: 'client_secret_basic',
        }
      }
    } catch {
      // 非法 base64 → 视为未提供凭证(由 verifyClientSecret 统一拒绝)
    }
  }
  const body = (input.body ?? {}) as Record<string, unknown>
  const clientId = typeof body.client_id === 'string' ? body.client_id.trim() : ''
  const clientSecret = typeof body.client_secret === 'string' ? body.client_secret : ''
  if (clientId) {
    return {
      clientId,
      clientSecret: clientSecret || null,
      method: clientSecret ? 'client_secret_post' : 'none',
    }
  }
  return { clientId: null, clientSecret: null, method: 'none' }
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// ---------------------------------------------------------------------------
// client_secret 存储:公开客户端哨兵 + 加盐哈希(零依赖,便于单测)
// ---------------------------------------------------------------------------

/** 公开客户端(PKCE-only,无 secret)在 client_secret 列上的不可匹配哨兵值。 */
export const PUBLIC_CLIENT_SECRET = '!public'

/** 我们自建的 hash 前缀;与 bcrypt($2*)/argon2($argon2*) 前缀互斥,便于双路校验。 */
export const CLIENT_SECRET_HASH_PREFIX = 'v1hmac$'

/**
 * 口令派生域分隔常量:与用户密码哈希体系(password-crypto.ts argon2id)区分开。
 * client_secret 是 256-bit CSPRNG 随机串(非用户口令),不存在离线字典攻击面,
 * 故用 HMAC-SHA256 + 每客户端随机 salt 即可;不引 bcryptjs 进 @ihui/auth(避免新增依赖)。
 */
const CLIENT_SECRET_KDF_DOMAIN = 'ihui-oauth-client-secret-v1'

/** 生成 `v1hmac$<saltHex>$<digestHex>` 形态的 client_secret 摘要。 */
export function hashClientSecret(plain: string): string {
  const salt = randomBytes(16)
  const digest = createHmac('sha256', salt)
    .update(`${CLIENT_SECRET_KDF_DOMAIN}:${plain}`, 'utf8')
    .digest('hex')
  return `${CLIENT_SECRET_HASH_PREFIX}${salt.toString('hex')}$${digest}`
}

/** 摘要是否为我们自建的 v1hmac 形态(区分 bcrypt/argon2/明文)。 */
export function isHashedClientSecret(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(CLIENT_SECRET_HASH_PREFIX)
}

/** 校验 presented 是否匹配 `v1hmac$<salt>$<digest>` 摘要(时间恒定)。 */
function matchHashedClientSecret(stored: string, presented: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || !parts[1] || !parts[2]) return false
  let digest: string
  try {
    digest = createHmac('sha256', Buffer.from(parts[1], 'hex'))
      .update(`${CLIENT_SECRET_KDF_DOMAIN}:${presented}`, 'utf8')
      .digest('hex')
  } catch {
    return false
  }
  return safeEqual(digest, parts[2])
}

/**
 * 公开的"存储摘要 → 匹配"入口,供 apps/api 各 token 端点共用。
 * 校验优先级(严格):
 *  1. clientSecretHash 命中 v1hmac / bcrypt($2*)/argon2($argon2*) → 用摘要比对
 *  2. client_secret 命中 v1hmac → 用摘要比对(DCR 客户端:明文列只存摘要,不回显)
 *  3. 二者皆无摘要 → 回退 client_secret 明文恒定比较(仅存量 legacy 应用)
 * 公开客户端(client_secret === PUBLIC_CLIENT_SECRET 哨兵)一律不匹配任何 secret。
 */
export function verifyClientSecret(
  app: { clientSecret?: string | null; clientSecretHash?: string | null },
  presented: string | null | undefined,
): boolean {
  if (isPublicClientApp(app)) return false
  if (!presented) return false
  // 原名 `hashed` 撒谎:这个列表里既可能是摘要也可能是**明文** legacy clientSecret(下一行就是
  // 明文分支)。改名成"待试的存储候选",让名字只承诺它真做到的事(门 137 的命中项按改名收口,
  // 不用行内豁免遮掉 —— 豁免是给"名字没错、判据看不见"的,不是给命名债的)。
  const storedCandidates = [app.clientSecretHash, app.clientSecret].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  )
  for (const stored of storedCandidates) {
    if (isHashedClientSecret(stored)) {
      if (matchHashedClientSecret(stored, presented)) return true
      continue
    }
    if (stored.startsWith('$2') || stored.startsWith('$argon2')) {
      // bcrypt/argon2 需要专用 KDF(依赖在 apps/api 侧):交由调用方注入的 verifier 处理,
      // 本包不引 bcryptjs。apps/api 用 verifyClientSecretWithLegacyHashes 兜住该分支。
      continue
    }
    if (safeEqual(presented, stored)) return true
  }
  return false
}

/** 公开客户端判定:client_secret 为哨兵值(注册时 token_endpoint_auth_method=none)。 */
export function isPublicClientApp(
  app: { clientSecret?: string | null; clientSecretHash?: string | null },
): boolean {
  return app.clientSecret === PUBLIC_CLIENT_SECRET && !isHashedClientSecret(app.clientSecretHash)
}

/**
 * 是否为"现代客户端"(注册时即写入摘要,无明文 secret 落库)。
 * 现代客户端强制 PKCE,不给"机密客户端缺 PKCE"的历史豁免空间。
 */
export function isModernOAuthClientApp(
  app: { clientSecret?: string | null; clientSecretHash?: string | null },
): boolean {
  return isHashedClientSecret(app.clientSecretHash) || isHashedClientSecret(app.clientSecret)
}

// ---------------------------------------------------------------------------
// PKCE 强制策略(OAuth 2.1 §4.1 / RFC 7636 §5.2)
// ---------------------------------------------------------------------------

/** 授权码记录的最小结构(oauth_sessions 行 / StoredAuthorizationCode 都满足)。 */
export interface PkceSessionRecord {
  codeChallenge?: string | null
  codeChallengeMethod?: string | null
}

export interface PkcePolicy {
  /** 公开客户端(无 secret)强制 PKCE —— 恒为 true,不提供降级开关。 */
  requirePkceForPublicClients: true
  /** 机密客户端是否也强制 PKCE(OAuth 2.1 要求;env 可关以兼容存量客户端)。 */
  requirePkceForConfidentialClients: boolean
  /** 允许的 code_challenge_method。默认仅 S256(RFC 7636 的 plain 等同不加密,禁)。 */
  allowedMethods: PkceMethod[]
}

const DEFAULT_PKCE_POLICY: PkcePolicy = {
  requirePkceForPublicClients: true,
  requirePkceForConfidentialClients: false,
  allowedMethods: ['S256'],
}

function envTruthy(env: NodeJS.ProcessEnv, key: string, dflt: boolean): boolean {
  const raw = env[key]
  if (raw === undefined || raw === '') return dflt
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase())
}

/**
 * 从环境变量解析 PKCE 策略。
 * - OAUTH_REQUIRE_PKCE=1  → 所有客户端(含存量机密客户端)强制 PKCE(OAuth 2.1 严格态)
 * - OAUTH_ALLOW_PLAIN_PKCE=1 → 允许 code_challenge_method=plain(仅应急,默认关)
 * 注:无论该开关如何,只要授权码携带 challenge,token 端点必须校验 verifier。
 */
export function pkcePolicyFromEnv(env: NodeJS.ProcessEnv = process.env): PkcePolicy {
  const allowedMethods: PkceMethod[] = ['S256']
  if (envTruthy(env, 'OAUTH_ALLOW_PLAIN_PKCE', false)) allowedMethods.push('plain')
  return {
    requirePkceForPublicClients: true,
    requirePkceForConfidentialClients: envTruthy(env, 'OAUTH_REQUIRE_PKCE', false),
    allowedMethods,
  }
}

export type PkceEvaluation =
  | { ok: true; enforced: boolean }
  | { ok: false; error: OAuthErrorCode; description: string }

/**
 * 授权码换 token 时的 PKCE 判定 —— 唯一真相源,所有 token 端点必须走这里。
 *
 * 修复的断层:历史上 /auth/oauth/token 只比 client_secret + code,
 * 完全忽略已存进 oauth_sessions.codeChallenge 的 challenge,
 * 导致"授权码 + 泄露的 client 凭证"即可换 token,PKCE 防授权码注入形同虚设。
 *
 * 规则:
 *  1. code 携带 challenge → method 必须在白名单内,且必须提供匹配的 verifier(不可豁免)
 *  2. code 未携带 challenge → 公开客户端 / 现代客户端(DCR 建) / 策略强制时 → 拒绝
 *  3. 其余(存量机密客户端 + 策略未强制)→ 放行,但 enforced=false 便于上层审计告警
 */
export function evaluatePkce(input: {
  session: PkceSessionRecord
  codeVerifier?: string | null
  isPublicClient: boolean
  policy: PkcePolicy
  /** 该 client 注册于 DCR(现代客户端)→ 无条件要求 PKCE */
  requirePkceForClient?: boolean
}): PkceEvaluation {
  const challenge = typeof input.session.codeChallenge === 'string' ? input.session.codeChallenge : ''
  const rawMethod =
    typeof input.session.codeChallengeMethod === 'string' && input.session.codeChallengeMethod
      ? input.session.codeChallengeMethod
      : // oauth_sessions 注释即"PKCE(仅 S256)";缺 method 时按 S256 处理,不放宽为 plain
        'S256'
  const method = rawMethod as PkceMethod

  if (challenge) {
    if (!input.policy.allowedMethods.includes(method)) {
      return {
        ok: false,
        error: 'invalid_request',
        description: `不支持的 code_challenge_method: ${rawMethod}`,
      }
    }
    const verifier = input.codeVerifier ?? ''
    if (!verifier) {
      return { ok: false, error: 'invalid_request', description: '缺少 code_verifier' }
    }
    if (!validatePkce(verifier, challenge, method)) {
      return { ok: false, error: 'invalid_grant', description: 'code_verifier 校验失败' }
    }
    return { ok: true, enforced: true }
  }

  const mustHaveChallenge =
    input.isPublicClient || input.requirePkceForClient === true
  if (mustHaveChallenge || input.policy.requirePkceForConfidentialClients) {
    return {
      ok: false,
      error: 'invalid_request',
      description: '授权码缺少 code_challenge,该客户端必须使用 PKCE(RFC 7636)',
    }
  }
  return { ok: true, enforced: false }
}

/**
 * authorize 端点侧:校验客户端送来的 code_challenge 形状。
 * @returns 错误描述;null 表示通过(未提供 challenge 时也返回 null,是否强制由 evaluatePkce/策略决定)
 */
export function validatePkceChallenge(
  codeChallenge: string | null | undefined,
  codeChallengeMethod: string | null | undefined,
  policy: PkcePolicy = DEFAULT_PKCE_POLICY,
): string | null {
  if (!codeChallenge) return null
  const method = (codeChallengeMethod ?? 'S256') as PkceMethod
  if (!policy.allowedMethods.includes(method)) return `不支持的 code_challenge_method: ${method}`
  if (method === 'S256' && !/^[A-Za-z0-9\-._~]{43,128}$/.test(codeChallenge)) {
    return 'code_challenge 必须是 43-128 字符的 base64url(无 padding)'
  }
  return null
}

// ---------------------------------------------------------------------------
// RFC 7591 动态客户端注册:redirect_uri 注册期校验
// ---------------------------------------------------------------------------

/**
 * 注册期 redirect_uri 合法性校验(OAuth 2.1 §7.1 + RFC 9700 §4.1 安全 BCP)。
 *
 * 运行期仍是"注册白名单精确匹配"(见 validateRedirectUri,不改语义);
 * 这里只是把明显危险的形态挡在注册门外:
 *  - 必须可解析为绝对 URL
 *  - https 一律允许
 *  - http 仅允许 loopback(127.0.0.1 / [::1] / localhost)—— 原生应用回环重定向
 *  - 其他 scheme 只允许自定义 scheme(形如 `app.example:/callback`,不得含 // 主机名形式的
 *    http/https 变体),用于桌面 App 的深度链接
 *  - 禁止 fragment(# 之后的内容不参与匹配,且 RFC 要求不带)
 * @returns 错误描述;null = 全部合法
 */
export function validateRegistrationRedirectUris(uris: unknown): string | null {
  if (!Array.isArray(uris) || uris.length === 0) return 'redirect_uris 不能为空'
  if (uris.length > 50) return 'redirect_uris 数量超过上限 50'
  for (const raw of uris) {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) {
      return '每个 redirect_uri 必须是不超过 2048 字符的字符串'
    }
    if (raw.includes('#')) return 'redirect_uri 不得包含 fragment'
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return `redirect_uri 不是合法绝对 URL: ${raw}`
    }
    const scheme = url.protocol.replace(/:$/, '').toLowerCase()
    if (scheme === 'https') continue
    if (scheme === 'http') {
      const host = url.hostname.toLowerCase()
      const loopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /^127\.\d+\.\d+\.\d+$/.test(host)
      if (!loopback) return `http redirect_uri 仅允许 loopback: ${raw}`
      continue
    }
    // 自定义 scheme(原生应用深度链接):禁止伪装成 web 语义的 scheme
    if (['javascript', 'data', 'file', 'blob', 'ws', 'wss'].includes(scheme)) {
      return `不支持的 redirect_uri scheme: ${raw}`
    }
    if (!/^[a-z][a-z0-9+.\-]*$/.test(scheme)) return `redirect_uri scheme 非法: ${raw}`
  }
  return null
}

// ---------------------------------------------------------------------------
// client_credentials M2M access token(RFC 6749 §4.4)
// ---------------------------------------------------------------------------

/**
 * 与 jwt.ts 的 ISSUER 保持一致(该常量未 export,key-rotation.ts:50 亦同此双写)。
 * 双写漂移由 tests/oauth2-o7-primitives.test.ts 的"互操作断言"兜底:
 * 用 signM2MAccessToken 签出的 token 必须能被 jwt.verifyAccessToken 验通。
 */
const JWT_ISSUER = 'ihui-ai'

/** M2M token 的 type claim:verifyAccessToken 只拒绝 refresh/challenge,故可正常走 authenticate()。 */
export const M2M_TOKEN_TYPE = 'm2m_access'

export interface M2MAccessTokenClaims {
  /** 绑定的资源所有者 = oauth_apps.owner_uuid(sub,使既有 authenticate() 直接可用) */
  sub: string
  clientId: string
  scopes: string[]
  /** O4/O6 判定 principal.kind 的依据:client_credentials 链路的主体是"应用",不是登录用户 */
  principalKind: 'client'
  grantType: 'client_credentials'
  /** 权限最小化:M2M token 永远 roleId=0,不得继承 owner 的管理员角色 */
  roleId: 0
  expiresAtSec: number
  issuedAtSec: number
  jti: string
}

/**
 * 签发 M2M access token(HS256,与用户 access token 同一密钥/同一 iss+aud,
 * 因此能通过 plugins/auth.authenticate 的验签,但 claims 里带 principal_kind=client 可区分)。
 */
export function signM2MAccessToken(
  claims: { sub: string; clientId: string; scopes: string[] },
  ttlSeconds: number = ACCESS_TOKEN_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    phone: '',
    familyId: '',
    roleId: 0,
    type: M2M_TOKEN_TYPE,
    principal_kind: 'client',
    grant_type: 'client_credentials',
    client_id: claims.clientId,
    scope: normalizeScopes(claims.scopes).join(' '),
    jti: randomUUID(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(`${Math.max(60, ttlSeconds)}s`)
    .sign(getJwtSecret())
}

/** 验签并解析 M2M token;非 M2M / 验签失败抛 OAuth2RequestError(invalid_token 语义由调用方处理)。 */
export async function verifyM2MAccessToken(token: string): Promise<M2MAccessTokenClaims> {
  const payload = await verifySignedJwt(token)
  if (payload.type !== M2M_TOKEN_TYPE) {
    throw new OAuth2RequestError('invalid_request', 'token 不是 client_credentials 签发的 M2M token')
  }
  return {
    sub: String(payload.sub ?? ''),
    clientId: String(payload.client_id ?? ''),
    scopes: normalizeScopes(typeof payload.scope === 'string' ? payload.scope : []),
    principalKind: 'client',
    grantType: 'client_credentials',
    roleId: 0,
    expiresAtSec: Number(payload.exp ?? 0),
    issuedAtSec: Number(payload.iat ?? 0),
    jti: String(payload.jti ?? ''),
  }
}

/** 验签(不抛错的通用解码):供 introspection 读取 access token 的全量 claims。 */
async function verifySignedJwt(token: string): Promise<Record<string, unknown>> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    })
    return payload as Record<string, unknown>
  } catch {
    throw new OAuth2RequestError('invalid_grant', 'token 验签失败或已过期')
  }
}

export interface IntrospectedTokenClaims {
  active: boolean
  /** RFC 7662 §2.2 */
  tokenType?: 'bearer'
  sub?: string
  clientId?: string
  scope?: string
  exp?: number
  iat?: number
  iss?: string
  aud?: string | string[]
  jti?: string
  /** 我们扩展的可判定字段(O4/O6 用) */
  principalKind?: 'user' | 'client'
  grantType?: string
}

/**
 * RFC 7662 introspection 的 access token 部分:验签 + claims 归一。
 * 过期/验签失败 → `{active:false}`(RFC 要求 200 + active=false,不是 401)。
 * 黑名单(refresh/revoke 后的 access token)由 apps/api 侧再叠一层 —— 本函数无 Redis 依赖。
 */
export async function introspectAccessToken(token: string): Promise<IntrospectedTokenClaims> {
  if (!token) return { active: false }
  let payload: Record<string, unknown>
  try {
    payload = await verifySignedJwt(token)
  } catch {
    return { active: false }
  }
  if (payload.type === 'refresh' || payload.type === 'challenge') return { active: false }
  const now = Math.floor(Date.now() / 1000)
  const exp = typeof payload.exp === 'number' ? payload.exp : undefined
  if (exp !== undefined && exp <= now) return { active: false }
  const isM2M = payload.type === M2M_TOKEN_TYPE
  return {
    active: true,
    tokenType: 'bearer',
    sub: typeof payload.sub === 'string' ? payload.sub : undefined,
    clientId: typeof payload.client_id === 'string' ? payload.client_id : undefined,
    scope: typeof payload.scope === 'string' ? payload.scope : undefined,
    exp,
    iat: typeof payload.iat === 'number' ? payload.iat : undefined,
    iss: typeof payload.iss === 'string' ? payload.iss : undefined,
    aud: payload.aud as string | string[] | undefined,
    jti: typeof payload.jti === 'string' ? payload.jti : undefined,
    principalKind: isM2M ? 'client' : 'user',
    grantType: isM2M ? 'client_credentials' : 'authorization_code',
  }
}

/** refresh token 重用检测(RFC 6749 §10.4 / OAuth 2.1 rotation)。 */
export function isRefreshTokenReused(record: { revokedAt?: Date | string | null }): boolean {
  if (!record || record.revokedAt === null || record.revokedAt === undefined) return false
  const ts =
    record.revokedAt instanceof Date ? record.revokedAt.getTime() : Date.parse(record.revokedAt)
  return Number.isFinite(ts)
}

/** refresh token 是否已过期(接受 Date | ISO string | null)。 */
export function isRefreshTokenExpired(record: { expiresAt?: Date | string | null }): boolean {
  const raw = record?.expiresAt
  if (!raw) return false
  const ts = raw instanceof Date ? raw.getTime() : Date.parse(raw)
  return Number.isFinite(ts) ? ts <= Date.now() : false
}

// ---------------------------------------------------------------------------
// OIDC:ID Token(RS256)+ JWKS
// ---------------------------------------------------------------------------

/** OIDC `openid` scope(未授予该 scope 时不得签发 ID Token)。 */
export const OPENID_SCOPE = 'openid'

/** ID Token 默认有效期(秒);OIDC 建议短于 access token 亦可,这里取 1h。 */
export const ID_TOKEN_TTL_SECONDS = 3600

export interface IdTokenInput {
  issuer: string
  /** 用户标识(oauth token 的 sub,同一 OP 下对所有 client 相同 → subject_type=public) */
  subject: string
  /** audience = client_id(OIDC Core §2:ID Token 的 aud 必须包含 RP 的 client_id) */
  audience: string
  /** authorize 请求带下来的 nonce,原样回填(防重放) */
  nonce?: string | null
  /** 用户认证时刻(秒);无会话时刻时退化为 iat */
  authTimeSec?: number
  /** profile scope 授予后的自定义 claims */
  claims?: Record<string, string | number | undefined>
  expiresInSec?: number
}

/**
 * 用 oauth_private_keys 的 RSA 私钥(PKCS8 PEM)签 RS256 ID Token。
 * kid 进 header,与 /oauth/jwks 暴露的公钥 kid 一一对应(轮换时新旧并存即可)。
 */
export async function signIdToken(input: IdTokenInput, privateKeyPem: string, kid: string): Promise<string> {
  const key = await importPKCS8(privateKeyPem, 'RS256')
  const now = Math.floor(Date.now() / 1000)
  const payload: Record<string, string | number | undefined> = {
    auth_time: input.authTimeSec ?? now,
    ...(input.claims ?? {}),
  }
  if (input.nonce) payload.nonce = input.nonce
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
    .setSubject(input.subject)
    .setIssuer(input.issuer)
    .setAudience(input.audience)
    .setIssuedAt(now)
    .setJti(randomUUID())
    .setExpirationTime(`${input.expiresInSec ?? ID_TOKEN_TTL_SECONDS}s`)
    .sign(key)
}

/** JWKS 单条(允许字段为 string | undefined,与 jose JWK 形状兼容)。 */
export type JwkEntry = JWK & { kid: string; use: 'sig'; alg: 'RS256' }

/** SPKI 公钥 PEM → JWK(RS256/sig + kid)。解析失败抛错,由调用方按 key 粒度跳过。 */
export async function exportPublicJwk(publicKeyPem: string, kid: string): Promise<JwkEntry> {
  const key = await importSPKI(publicKeyPem, 'RS256')
  const jwk = await exportJWK(key)
  return { ...jwk, kid, use: 'sig', alg: 'RS256' } as JwkEntry
}

/** 公钥集合 → JWKS Document;单条解析失败只跳过该条(不因一把坏钥匙让整份 JWKS 500)。 */
export async function buildJwks(
  entries: Array<{ kid: string; publicKeyPem: string | null | undefined }>,
): Promise<{ keys: JwkEntry[] }> {
  const keys: JwkEntry[] = []
  for (const entry of entries) {
    if (!entry.publicKeyPem) continue
    try {
      keys.push(await exportPublicJwk(entry.publicKeyPem, entry.kid))
    } catch {
      continue
    }
  }
  return { keys }
}

/**
 * profile scope 下可回传的 OIDC claims(只声明真实现的字段,见 discovery claims_supported)。
 * 未授予 profile 时只回 sub 级别的标准 claim。
 */
export function buildOidcProfileClaims(
  scopes: string[],
  user: {
    nickname?: string | null
    avatar?: string | null
    email?: string | null
  },
): Record<string, string | number | undefined> {
  const claims: Record<string, string | number | undefined> = {}
  if (!scopes.includes('profile')) return claims
  if (user.nickname) claims.nickname = user.nickname
  if (user.avatar) claims.avatar = user.avatar
  return claims
}

// ---------------------------------------------------------------------------
// RFC 8414 / OIDC Discovery 元数据类型(编译期防"编造能力")
// ---------------------------------------------------------------------------

export interface OAuthServerMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
  registration_endpoint?: string
  introspection_endpoint?: string
  revocation_endpoint?: string
  userinfo_endpoint?: string
  device_authorization_endpoint?: string
  response_types_supported: string[]
  response_modes_supported?: string[]
  grant_types_supported: string[]
  scopes_supported?: string[]
  service_documentation?: string
  op_policy_uri?: string
  op_tos_uri?: string
  code_challenge_methods_supported: string[]
  token_endpoint_auth_methods_supported: string[]
  revocation_endpoint_auth_methods_supported?: string[]
  introspection_endpoint_auth_methods_supported?: string[]
  subject_types_supported?: string[]
  id_token_signing_alg_values_supported?: string[]
  claims_supported?: string[]
  claim_types_supported?: string[]
  userinfo_signing_alg_values_supported?: string[]
}

/** OIDC Discovery 在 RFC 8414 之上额外要求 REQUIRED 的字段(OIDC Discovery §3)。 */
export interface OidcDiscoveryDocument extends OAuthServerMetadata {
  subject_types_supported: string[]
  id_token_signing_alg_values_supported: string[]
  userinfo_endpoint: string
}

/** metadata 构造入参:只允许传"已实现"的事实,由本函数统一决定字段取舍。 */
export interface OAuthMetadataInput {
  issuer: string
  /** 相对路径(以 / 开头),内部拼成绝对 URL */
  authorizationPath: string
  tokenPath: string
  jwksPath: string
  registrationPath?: string
  introspectionPath?: string
  revocationPath?: string
  userinfoPath?: string
  /** 端点支持的 grant(只写真实现的) */
  grantTypes: string[]
  codeChallengeMethods: string[]
  tokenEndpointAuthMethods: string[]
  scopesSupported?: string[]
  /** 传 true 才产出 OIDC 字段(subject_type/id_token alg) */
  oidc: boolean
  /** OIDC 真实现的 claims(与 buildOidcProfileClaims 输出保持一致) */
  claimsSupported?: string[]
}

/**
 * 单一真相源:AS metadata 与 OIDC discovery 同源生成,避免两份文档互相矛盾
 * (常见事故:discovery 声称支持 implicit/id_token 而代码只有 code flow)。
 */
export function buildAuthorizationServerMetadata(
  input: OAuthMetadataInput,
): OAuthServerMetadata | OidcDiscoveryDocument {
  const url = (p: string | undefined): string | undefined => (p ? `${input.issuer}${p}` : undefined)
  const base: OAuthServerMetadata = {
    issuer: input.issuer,
    authorization_endpoint: `${input.issuer}${input.authorizationPath}`,
    token_endpoint: `${input.issuer}${input.tokenPath}`,
    jwks_uri: `${input.issuer}${input.jwksPath}`,
    response_types_supported: ['code'],
    // 授权端点以 302 + query 回传 code(RFC 6749 §4.1.1),不支持 fragment/implicit
    response_modes_supported: ['query'],
    grant_types_supported: input.grantTypes,
    code_challenge_methods_supported: input.codeChallengeMethods,
    token_endpoint_auth_methods_supported: input.tokenEndpointAuthMethods,
  }
  const registration = url(input.registrationPath)
  if (registration) base.registration_endpoint = registration
  const introspection = url(input.introspectionPath)
  if (introspection) {
    base.introspection_endpoint = introspection
    base.introspection_endpoint_auth_methods_supported = input.tokenEndpointAuthMethods
  }
  const revocation = url(input.revocationPath)
  if (revocation) {
    base.revocation_endpoint = revocation
    base.revocation_endpoint_auth_methods_supported = input.tokenEndpointAuthMethods
  }
  const userinfo = url(input.userinfoPath)
  if (userinfo) base.userinfo_endpoint = userinfo
  if (input.scopesSupported?.length) base.scopes_supported = input.scopesSupported
  if (!input.oidc) return base
  if (!userinfo) {
    // OIDC Discovery §3 把 userinfo_endpoint 列为 REQUIRED:没有实现 userinfo 就不许声明 OIDC,
    // 宁可启动即抛错,也不产出一份"看起来合规但缺字段"的 discovery(防编造能力)。
    throw new Error('OIDC discovery 需要已实现 userinfo_endpoint(oidc=true 必须传 userinfoPath)')
  }
  return {
    ...(base as OidcDiscoveryDocument),
    // sub = users.id,对同一 OP 下所有 client 相同 → 只能是 public(不谎报 pairwise)
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    userinfo_endpoint: userinfo,
    claims_supported: input.claimsSupported ?? ['sub'],
    claim_types_supported: ['normal'],
  }
}

/** issuer 归一:去尾斜杠;优先级 env(OAUTH_ISSUER) > 请求 origin。 */
export function resolveOAuthIssuer(envValue: string | undefined, requestOrigin: string): string {
  const raw = (envValue ?? '').trim() || requestOrigin
  return raw.replace(/\/+$/, '')
}


// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
