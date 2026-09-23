// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O7:令牌端点 + RFC 7662 introspection + RFC 7009 revocation(2026-09-21 立)。
 *
 * 注册方式:**不带 prefix**(路径写全),与 discovery 文档 `/.well-known/*` 同一插件层,
 * 因为发现文档里的 token_endpoint 是根级 `/oauth/token`(第三方 AS 客户端只认发现文档)。
 *
 *   POST /oauth/token        grant_type = authorization_code | refresh_token | client_credentials
 *   POST /oauth/introspect   RFC 7662
 *   POST /oauth/revoke       RFC 7009
 *
 * 响应形状:成功体是 RFC 原生形状(不套 `{code,data}`),错误体是
 * `{error, error_description, code}` —— `code` 恒等于 HTTP 状态码(≠ 0),
 * 让 web 端 api-client 的 `if (data.code !== 0)` 判定不会把 OAuth 错误当成成功。
 *
 * 三条与"一次性"有关的硬规则(本文件存在的核心理由):
 *  1. 授权码消费走 `claimAuthorizationCode`(条件 UPDATE),不允许"先查后置"两步式;
 *  2. refresh token 轮换走 `claimRefreshToken`(条件 UPDATE),并发第二次必然拿 0 行 →
 *     只有第一个请求能拿到新 token,第二个收到 invalid_grant + family 全族撤销;
 *  3. `token_type_hint` 按 RFC 7662 §2.1 是**提示**,不可信:hint 错/缺时双表兜底查,
 *     绝不因为 hint 说 access 就放弃按 refresh 查。
 *
 * 已知的 enforcement 缺口(如实写明,不在本文件掩饰):
 *  access token 吊销写进 Redis 黑名单后,`/oauth/introspect` 会立刻报 active=false,
 *  但 `plugins/auth.ts:authenticate()` 走的是**无状态验签**,不查黑名单 ——
 *  即"吊销"对 JWT 直连的业务接口要到 exp 才生效。补齐需要在 plugins/auth.ts 里
 *  接一次 `TokenBlacklist.has()`,该文件在本任务禁改清单内,故只交付接线代码(见交付说明)。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { decodeJwt } from 'jose'
import {
  TokenBlacklist,
  introspectAccessToken,
  oauthErrorStatus,
  verifyRefreshToken,
  type OAuthErrorCode,
} from '@ihui/auth'
import { config } from '../config/index.js'
import { findRefreshToken, findUserById } from '../db/queries.js'
import {
  claimAuthorizationCode,
  claimRefreshToken,
  revokeFamilyByFamilyId,
} from '../db/oauth-token-queries.js'
import { createAuditLog } from '../db/oauth-queries.js'
import {
  authenticateOAuthClient,
  buildTokenPair,
  gatePkceForSession,
  mintClientCredentialsToken,
  type OAuthAppRow,
} from './auth-extended.js'
import { errorUriFor, oauthErrorReply, resolveIssuer } from '../utils/oauth-as.js'

// ─── 请求形状 ────────────────────────────────────────────────────────────────

const tokenRequestSchema = z.object({
  grant_type: z.string().min(1).max(64),
  code: z.string().max(512).optional(),
  redirect_uri: z.string().max(2048).optional(),
  code_verifier: z.string().max(256).optional(),
  state: z.string().max(256).optional(),
  refresh_token: z.string().max(8192).optional(),
  scope: z.string().max(4000).optional(),
  client_id: z.string().max(200).optional(),
  client_secret: z.string().max(200).optional(),
})

const introspectRequestSchema = z.object({
  token: z.string().min(1).max(8192),
  token_type_hint: z.string().max(32).optional(),
  client_id: z.string().max(200).optional(),
  client_secret: z.string().max(200).optional(),
})

const revokeRequestSchema = z.object({
  token: z.string().min(1).max(8192),
  token_type_hint: z.string().max(32).optional(),
  client_id: z.string().max(200).optional(),
  client_secret: z.string().max(200).optional(),
})

/** RFC 6749 §5.1 成功体(下划线命名,由 RFC 客户端库直接解析)。 */
interface TokenSuccessBody {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token?: string
  scope?: string
}

/** introspection 响应(RFC 7662 §2.2 + 我们的 principal_kind 扩展)。 */
interface IntrospectionResponse {
  active: boolean
  token_type?: 'Bearer'
  sub?: string
  client_id?: string
  scope?: string
  exp?: number
  iat?: number
  iss?: string
  aud?: string | string[]
  jti?: string
  /** 'access' | 'refresh' —— 让资源服务器知道拿到的是哪种凭据 */
  token_use?: 'access' | 'refresh'
  principal_kind?: 'user' | 'client'
}

// ─── 共用小工具 ──────────────────────────────────────────────────────────────

function fail(
  reply: FastifyReply,
  issuer: string,
  status: number,
  error: OAuthErrorCode,
  description: string,
): FastifyReply {
  return oauthErrorReply(reply, status, error, description, errorUriFor(issuer, error))
}

/** 从 JWT 里取数值 claim;解不开(伪造/畸形)一律按 0 处理,绝不抛错。 */
function numericClaim(token: string, claim: 'exp' | 'iat'): number {
  try {
    const value = decodeJwt(token)[claim]
    return typeof value === 'number' ? value : 0
  } catch {
    return 0
  }
}

function toEpochSeconds(date: Date | null | undefined): number {
  if (!date) return 0
  const ms = date instanceof Date ? date.getTime() : Number(date)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0
}

/**
 * 吊销动作要落进 Redis 黑名单。Redis 不可用时**失败关闭**(返回 false):
 * 吊销请求多半来自"凭据已泄露"的处置现场,静默成功比报错更危险。
 */
async function blacklistToken(
  server: FastifyRequest['server'],
  token: string,
  expiresAtSec: number,
): Promise<boolean> {
  const ttlSeconds = expiresAtSec - Math.floor(Date.now() / 1000)
  if (ttlSeconds <= 0) return true // 已自然过期,黑名单无意义
  try {
    const blacklist = new TokenBlacklist(server.redis)
    await blacklist.add(token, new Date(expiresAtSec * 1000))
    return true
  } catch {
    return false
  }
}

/**
 * 黑名单叠加判定:introspection 必须反映吊销结果,否则"revoked 但仍 active"。
 * Redis 异常时按 **未吊销** 处理并记日志 —— 与 `TokenBlacklist.has` 的默认 fail-open 一致,
 * 避免 Redis 抖动把所有 token 都判成 inactive(那等于全站登出)。
 */
async function isBlacklisted(server: FastifyRequest['server'], token: string): Promise<boolean> {
  try {
    return await new TokenBlacklist(server.redis).has(token)
  } catch {
    return false
  }
}

/** 公开客户端免 secret 的放行判定收敛到一个函数,便于审计与单测。 */
function publicClientGate(publicClient: boolean): string | null {
  if (!publicClient) return null
  // 打开这个开关等于允许"无 secret"换 token,唯一能兜住它的就是强制 PKCE ——
  // 二者必须在同一步骤里判定完,拆成两步会出现"空 secret 先被摘要校验和判失败"的假阴性。
  if (config.OAUTH_ALLOW_PUBLIC_WITHOUT_SECRET) return null
  return '公开客户端未启用:需同时设置 OAUTH_ALLOW_PUBLIC_WITHOUT_SECRET=true(其 PKCE 强制由 evaluatePkce 无条件保证)'
}

// ─── 路由 ────────────────────────────────────────────────────────────────────

export const oauthTokensRoutes: FastifyPluginAsync = async (server) => {
  server.post(
    '/oauth/token',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const issuer = resolveIssuer(request)
      const parsed = tokenRequestSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return fail(
          reply,
          issuer,
          oauthErrorStatus('invalid_request'),
          'invalid_request',
          parsed.error.issues[0]?.message ?? '请求参数不合法',
        )
      }
      const body = parsed.data
      const client = await authenticateOAuthClient(request, {
        client_id: body.client_id,
        client_secret: body.client_secret,
      })
      if (!client.ok) {
        return fail(
          reply,
          issuer,
          client.status,
          client.error as OAuthErrorCode,
          client.description,
        )
      }
      const publicGate = publicClientGate(client.publicClient)
      if (publicGate) {
        return fail(reply, issuer, 401, 'unauthorized_client', publicGate)
      }

      if (body.grant_type === 'authorization_code') {
        return handleAuthorizationCodeGrant(server, request, reply, issuer, body, client)
      }
      if (body.grant_type === 'refresh_token') {
        return handleRefreshTokenGrant(server, request, reply, issuer, body)
      }
      if (body.grant_type === 'client_credentials') {
        const mint = await mintClientCredentialsToken(client.app, body.scope)
        if (!mint.ok) {
          return fail(reply, issuer, mint.status, mint.error as OAuthErrorCode, mint.description)
        }
        const payload: TokenSuccessBody = {
          access_token: mint.accessToken,
          token_type: 'Bearer',
          expires_in: mint.expiresIn,
          scope: mint.scope || undefined,
        }
        return reply.type('application/json').send(payload)
      }
      return fail(
        reply,
        issuer,
        oauthErrorStatus('unsupported_grant_type'),
        'unsupported_grant_type',
        `不支持的 grant_type: ${body.grant_type}`,
      )
    },
  )

  /** RFC 7662 token introspection。客户端认证强制(RFC 要求,否则等于把令牌有效性公开化)。 */
  server.post(
    '/oauth/introspect',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const issuer = resolveIssuer(request)
      const parsed = introspectRequestSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return fail(
          reply,
          issuer,
          oauthErrorStatus('invalid_request'),
          'invalid_request',
          parsed.error.issues[0]?.message ?? '请求参数不合法',
        )
      }
      const client = await authenticateOAuthClient(request, {
        client_id: parsed.data.client_id,
        client_secret: parsed.data.client_secret,
      })
      if (!client.ok) {
        return fail(
          reply,
          issuer,
          client.status,
          client.error as OAuthErrorCode,
          client.description,
        )
      }
      const info = await buildIntrospection(server, parsed.data.token, parsed.data.token_type_hint)
      return reply.type('application/json').send(info)
    },
  )

  /**
   * RFC 7009 token revocation。
   *
   * 恒返回 200 + 空体(RFC §2.2):token 不存在/已吊销/不是本 AS 签发的都不得区分,
   * 否则这个端点变成"令牌存在性预言机"。真正的失败只有两种:
   *  - 客户端认证不通过 → 401
   *  - Redis 不可用导致吊销落不了地 → 503(见 `blacklistToken` 的失败关闭理由)
   */
  server.post(
    '/oauth/revoke',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const issuer = resolveIssuer(request)
      const parsed = revokeRequestSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return fail(
          reply,
          issuer,
          oauthErrorStatus('invalid_request'),
          'invalid_request',
          parsed.error.issues[0]?.message ?? '请求参数不合法',
        )
      }
      const client = await authenticateOAuthClient(request, {
        client_id: parsed.data.client_id,
        client_secret: parsed.data.client_secret,
      })
      if (!client.ok) {
        return fail(
          reply,
          issuer,
          client.status,
          client.error as OAuthErrorCode,
          client.description,
        )
      }
      const outcome = await revokePresentedToken(
        server,
        parsed.data.token,
        parsed.data.token_type_hint,
      )
      if (outcome === 'redis_unavailable') {
        return fail(
          reply,
          issuer,
          oauthErrorStatus('temporarily_unavailable'),
          'temporarily_unavailable',
          '吊销暂不可用,请稍后重试',
        )
      }
      await createAuditLog({
        event: 'revoke',
        clientId: client.app.clientId,
        status: 'success',
      })
      return reply.type('application/json').send({})
    },
  )
}

// ─── grant 实现 ──────────────────────────────────────────────────────────────

type TokenBody = z.infer<typeof tokenRequestSchema>
/** 本文件所有子函数只需要实例上的 log + redis,显式收窄成这个别名。 */
type OAuthServer = import('fastify').FastifyInstance

/** authorization_code:原子消费 code → PKCE 闸门 → 签用户令牌对。 */
async function handleAuthorizationCodeGrant(
  server: OAuthServer,
  _request: FastifyRequest,
  reply: FastifyReply,
  issuer: string,
  body: TokenBody,
  client: { app: OAuthAppRow; publicClient: boolean },
): Promise<FastifyReply> {
  if (!body.code) {
    return fail(reply, issuer, 400, 'invalid_request', '缺少 code')
  }
  const session = await claimAuthorizationCode(body.code)
  if (!session) {
    return fail(reply, issuer, 400, 'invalid_grant', '授权码无效、已过期或已被消费')
  }
  if (session.clientId !== client.app.clientId) {
    return fail(reply, issuer, 400, 'invalid_grant', '授权码与该客户端不匹配')
  }
  if (session.expiresAt.getTime() < Date.now()) {
    return fail(reply, issuer, 400, 'invalid_grant', '授权码无效、已过期或已被消费')
  }
  if (body.state && session.state && body.state !== session.state) {
    return fail(reply, issuer, 400, 'invalid_grant', 'state 不匹配')
  }
  const pkce = gatePkceForSession({
    session: {
      codeChallenge: session.codeChallenge,
      codeChallengeMethod: session.codeChallengeMethod,
    },
    codeVerifier: body.code_verifier,
    app: client.app,
    publicClient: client.publicClient,
  })
  if (!pkce.ok) {
    return fail(reply, issuer, pkce.status, pkce.error as OAuthErrorCode, pkce.description)
  }
  const user = await findUserById(session.userId)
  if (!user) return fail(reply, issuer, 400, 'invalid_grant', '授权用户不存在')
  const tokens = await buildTokenPair(user)
  await createAuditLog({
    event: 'token',
    clientId: client.app.clientId,
    userId: user.id,
    status: 'success',
  })
  const payload: TokenSuccessBody = {
    access_token: tokens.accessToken,
    token_type: 'Bearer',
    expires_in: tokens.expiresIn,
    refresh_token: tokens.refreshToken,
    scope: session.scope ?? undefined,
  }
  server.log.info({ clientId: client.app.clientId }, 'oauth token granted')
  return reply.type('application/json').send(payload)
}

/**
 * refresh_token:原子占位 → 重用即全族撤销 → 同 family 续发。
 *
 * 与 auth-extended.ts 的 `rotateRefreshTokenFlow` 的区别**只有原子性**:
 * 那里 find→check→revoke 三步分离,并发下两次刷新都会成功;这里第一次占位成功、
 * 第二次条件 UPDATE 拿 0 行 → 直接 invalid_grant,并按 family 把新签出的那份一起撤销。
 */
async function handleRefreshTokenGrant(
  server: OAuthServer,
  _request: FastifyRequest,
  reply: FastifyReply,
  issuer: string,
  body: TokenBody,
): Promise<FastifyReply> {
  const raw = body.refresh_token
  if (!raw) return fail(reply, issuer, 400, 'invalid_request', '缺少 refresh_token')
  let payload: { userId: string; familyId: string }
  try {
    payload = await verifyRefreshToken(raw)
  } catch {
    // 不是 refresh token(access/M2M/challenge)或验签失败:RFC 语义统一 invalid_grant
    return fail(reply, issuer, 400, 'invalid_grant', 'refresh_token 无效或已过期')
  }
  const claimed = await claimRefreshToken(raw)
  if (!claimed) {
    const stored = await findRefreshToken(raw)
    if (stored?.revokedAt) {
      // 重用检测:重放即全族失效(同一 family 内攻击者与受害者不能并存)
      if (payload.familyId) await revokeFamilyByFamilyId(payload.familyId)
      return fail(
        reply,
        issuer,
        400,
        'invalid_grant',
        'refresh_token 已被重用,该 token family 已全部撤销',
      )
    }
    return fail(reply, issuer, 400, 'invalid_grant', 'refresh_token 无效或已过期')
  }
  if (claimed.expiresAt && claimed.expiresAt.getTime() < Date.now()) {
    return fail(reply, issuer, 400, 'invalid_grant', 'refresh_token 无效或已过期')
  }
  const user = await findUserById(payload.userId)
  if (!user) return fail(reply, issuer, 400, 'invalid_grant', '授权用户不存在')
  const tokens = await buildTokenPair({
    ...user,
    familyId: payload.familyId || user.familyId || null,
  })
  const payloadBody: TokenSuccessBody = {
    access_token: tokens.accessToken,
    token_type: 'Bearer',
    expires_in: tokens.expiresIn,
    refresh_token: tokens.refreshToken,
  }
  server.log.info({ userId: user.id }, 'oauth refresh rotated')
  return reply.type('application/json').send(payloadBody)
}

// ─── introspect / revoke 实现 ────────────────────────────────────────────────

/**
 * 组装 introspection 响应。
 *
 * `token_type_hint` 只用来**决定先查哪张表**,绝不用来决定"查不到就算无效":
 * hint 传错(现实中很常见,客户端常把 refresh 当 access 传)时另一边必须兜底再查一次,
 * 否则合法 token 会被报成 active=false,资源服务器随即拒绝一切请求。
 */
async function buildIntrospection(
  server: OAuthServer,
  token: string,
  hint: string | undefined,
): Promise<IntrospectionResponse> {
  const prefersRefresh = hint === 'refresh_token'
  const refreshFirst = prefersRefresh ? tryRefreshTokenIntrospection : tryAccessTokenIntrospection
  const refreshFallback = prefersRefresh
    ? tryAccessTokenIntrospection
    : tryRefreshTokenIntrospection
  const first = await refreshFirst(server, token)
  if (first?.active) return first
  const second = await refreshFallback(server, token)
  if (second?.active) return second
  return first ?? second ?? { active: false }
}

async function tryAccessTokenIntrospection(
  server: OAuthServer,
  token: string,
): Promise<IntrospectionResponse | null> {
  const info = await introspectAccessToken(token)
  if (!info.active) return { active: false }
  if (await isBlacklisted(server, token)) return { active: false }
  return {
    active: true,
    token_type: 'Bearer',
    sub: info.sub,
    client_id: info.clientId,
    scope: info.scope,
    exp: info.exp,
    iat: info.iat,
    iss: info.iss,
    aud: info.aud,
    jti: info.jti,
    token_use: 'access',
    principal_kind: info.principalKind ?? 'user',
  }
}

/**
 * refresh token 的 introspection:JWT 里没有 scope/clientId,只能回 DB 行 +
 * 标准时间戳 claim。注意 `active` 的判据是"未被占位且未过期"——
 * 我们用 `findRefreshToken` 只读判定,**不**消费它(消费只发生在 refresh 授权流程里)。
 */
async function tryRefreshTokenIntrospection(
  _server: OAuthServer,
  token: string,
): Promise<IntrospectionResponse | null> {
  let payload: { userId: string; familyId: string; exp: number }
  try {
    const verified = await verifyRefreshToken(token)
    payload = { ...verified, exp: numericClaim(token, 'exp') }
  } catch {
    return null
  }
  const stored = await findRefreshToken(token)
  if (!stored || stored.revokedAt) return { active: false }
  if (stored.expiresAt && stored.expiresAt.getTime() < Date.now()) return { active: false }
  return {
    active: true,
    sub: payload.userId,
    exp: payload.exp || toEpochSeconds(stored.expiresAt),
    iat: numericClaim(token, 'iat'),
    jti: safeJti(token),
    token_use: 'refresh',
    principal_kind: 'user',
  }
}

function safeJti(token: string): string | undefined {
  try {
    const jti = decodeJwt(token).jti
    return typeof jti === 'string' ? jti : undefined
  } catch {
    return undefined
  }
}

/**
 * 执行吊销。返回 'redis_unavailable' 时调用方必须报 503(不能假报成功)。
 *
 * 判定顺序同 introspection:hint 不可信,两形态都试。
 * 吊销 refresh token 时按 **family** 语义撤销(`revokeFamilyByFamilyId`),
 * 这与 `rotateRefreshTokenFlow` 的重用检测同一口径 —— 同一处语义只允许一处实现。
 */
async function revokePresentedToken(
  server: OAuthServer,
  token: string,
  hint: string | undefined,
): Promise<'revoked' | 'not_found' | 'redis_unavailable'> {
  const wantsRefresh = hint === 'refresh_token'
  const order: Array<'refresh' | 'access'> = wantsRefresh
    ? ['refresh', 'access']
    : ['access', 'refresh']
  let sawToken = false
  for (const kind of order) {
    if (kind === 'access') {
      const info = await introspectAccessToken(token)
      if (!info.active) continue
      sawToken = true
      const exp = info.exp ?? numericClaim(token, 'exp')
      const ok = await blacklistToken(server, token, exp)
      if (!ok) return 'redis_unavailable'
      continue
    }
    const claimed = await claimRefreshToken(token)
    if (!claimed) {
      const stored = await findRefreshToken(token)
      if (stored) sawToken = true
      continue
    }
    sawToken = true
    const familyId = claimed.familyId ?? (await findRefreshToken(token))?.familyId ?? null
    if (familyId) await revokeFamilyByFamilyId(familyId)
    const exp = numericClaim(token, 'exp')
    if (exp > 0) {
      const ok = await blacklistToken(server, token, exp)
      if (!ok) return 'redis_unavailable'
    }
  }
  return sawToken ? 'revoked' : 'not_found'
}

/** 供发现文档/审计读取的当前 PKCE+公开客户端策略快照(单一真相源在 config)。 */
export function currentOAuthPolicySnapshot(): {
  requirePkce: boolean
  allowPublicWithoutSecret: boolean
} {
  return {
    requirePkce: config.OAUTH_REQUIRE_PKCE,
    allowPublicWithoutSecret: config.OAUTH_ALLOW_PUBLIC_WITHOUT_SECRET,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
