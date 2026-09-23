// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O7:OAuth 2.0 授权服务器 / OIDC 提供方「元数据 + 公钥 + UserInfo」表面(RFC 8414 / OIDC Discovery)。
 *
 * 注册方式(重要):本插件必须以 **不带 prefix** 的方式注册,
 * 因为 RFC 8414 §3.1 要求元数据挂在 issuer 根路径 `/.well-known/...` 下,
 * 第三方 Agent(Claude/ChatGPT connectors、Cursor、Zed、MCP 客户端)只会去根路径探测。
 *   server.register(oauthAuthorizationServerRoutes)   // ← 不加 { prefix: '/api' }
 *
 * 提供端点:
 *  - GET /.well-known/oauth-authorization-server        (RFC 8414 AS metadata)
 *  - GET /.well-known/oauth-authorization-server/*      (RFC 8414 §3.1 路径插入式发现)
 *  - GET /.well-known/openid-configuration              (OIDC Discovery)
 *  - GET /oauth/jwks                                    (RS256 公钥集,签 ID Token 用)
 *  - GET|POST /oauth/userinfo                           (OIDC Core §5.3 UserInfo)
 *
 * 「不编造能力」原则:文档字段一律由 buildAuthorizationServerMetadata(@ihui/auth)从
 * 实际实现的端点集合推导 —— 没有实现的 grant/response_type/alg 不会出现在这里。
 * 若某能力因配置缺失而不可用(如未 provision OIDC 签名私钥),对应端点会明确报错,
 * 而不是让 discovery 撒谎。
 */
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  OPENID_SCOPE,
  buildAuthorizationServerMetadata,
  buildJwks,
  generateAuthorizationCode,
  introspectAccessToken,
  isPublicClientApp,
  resolveGrantedScopes,
  signIdToken,
  type OAuthServerMetadata,
  type OidcDiscoveryDocument,
} from '@ihui/auth'
import { db } from '../db/index.js'
import { oauthPrivateKeys } from '@ihui/database'
import { config } from '../config/index.js'
import { findUserById } from '../db/queries.js'
import {
  createAuditLog,
  createOAuthSession,
  findOAuthAppByClientId,
  listActiveScopeMeta,
} from '../db/oauth-queries.js'
import { precheckAuthorizePkce, type OAuthAppRow } from './auth-extended.js'
import { resolveIssuer } from '../utils/oauth-as.js'
import { logger } from '../utils/logger.js'

/**
 * OIDC 签名密钥在 oauth_private_keys 表里的归属标识(clientId 列 NOT NULL,
 * 但这是"授权服务器自己的"密钥,不属于任何 oauth_apps,故用保留字)。
 * 可通过 env OAUTH_OIDC_KEY_CLIENT_ID 覆盖(多环境隔离时用)。
 */
const OIDC_SIGNING_KEY_OWNER = (): string =>
  process.env.OAUTH_OIDC_KEY_CLIENT_ID?.trim() || 'ihui-oidc-as'

interface SigningKeyRecord {
  kid: string
  privateKeyPem: string
  publicKeyPem: string | null
}

/** 进程内缓存(60s):JWKS/ID Token 每次请求都打库没意义,轮换后最多 60s 生效。 */
const KEY_CACHE_TTL_MS = 60_000
let keyCache: { at: number; keys: SigningKeyRecord[] } | null = null
/** 单飞:并发首请求只生成一次密钥(否则两请求各插一条,JWKS 会抖动)。 */
let inflight: Promise<SigningKeyRecord[]> | null = null

async function queryActiveSigningKeys(): Promise<SigningKeyRecord[]> {
  const rows = await db
    .select({
      id: oauthPrivateKeys.id,
      privateKey: oauthPrivateKeys.privateKey,
      publicKey: oauthPrivateKeys.publicKey,
    })
    .from(oauthPrivateKeys)
    .where(
      and(
        eq(oauthPrivateKeys.clientId, OIDC_SIGNING_KEY_OWNER()),
        eq(oauthPrivateKeys.isActive, 1),
        eq(oauthPrivateKeys.keyType, 'RSA'),
      ),
    )
    .orderBy(desc(oauthPrivateKeys.createdAt))
  return rows
    .filter((r) => Boolean(r.privateKey))
    .map((r) => ({ kid: r.id, privateKeyPem: r.privateKey, publicKeyPem: r.publicKey }))
}

/**
 * 取(必要时首次生成)授权服务器的 RS256 签名密钥对。
 * 首版只支持"单活跃密钥";密钥轮换 = 再插一条 isActive=1 并让旧的置 0(JWKS 会同时列出
 * 宽限期内的公钥,ID Token 的 kid 指向具体那一把,验签方按 kid 选key)。
 * @returns 密钥列表;DB 不可用或生成失败返回空数组(调用方据此报错,不伪造)
 */
export async function getOidcSigningKeys(): Promise<SigningKeyRecord[]> {
  const now = Date.now()
  if (keyCache && now - keyCache.at < KEY_CACHE_TTL_MS) return keyCache.keys
  if (inflight) return inflight
  inflight = (async () => {
    try {
      let keys = await queryActiveSigningKeys()
      if (keys.length === 0) {
        const pair = generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        })
        await db.insert(oauthPrivateKeys).values({
          id: randomUUID(),
          clientId: OIDC_SIGNING_KEY_OWNER(),
          privateKey: pair.privateKey,
          publicKey: pair.publicKey,
          keyType: 'RSA',
          isActive: 1,
        })
        keys = await queryActiveSigningKeys()
      }
      keyCache = { at: now, keys }
      return keys
    } catch (err) {
      logger.warn('[oauth-as] OIDC 签名密钥加载失败(将不签发 id_token)', {
        error: err instanceof Error ? err.message : String(err),
      })
      return []
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** 清缓存(测试与密钥轮换后强制刷新用)。 */
export function resetOidcSigningKeyCache(): void {
  keyCache = null
}

/** 端点路径表(根级注册,与注册说明保持一致)。 */
const AS_PATHS = {
  authorization: '/oauth/authorize',
  token: '/oauth/token',
  jwks: '/oauth/jwks',
  registration: '/oauth/register',
  introspection: '/oauth/introspect',
  revocation: '/oauth/revoke',
  userinfo: '/oauth/userinfo',
} as const

/**
 * discovery 文档构造。
 * scopes_supported = oauth_scope_meta 活跃 scope + openid(OIDC 才有 openid)。
 */
export async function buildAsMetadata(
  issuer: string,
  opts: { oidc: boolean },
): Promise<OAuthServerMetadata | OidcDiscoveryDocument> {
  let scopesSupported: string[] = [OPENID_SCOPE, 'profile']
  try {
    const meta = await listActiveScopeMeta()
    scopesSupported = [
      ...(opts.oidc ? [OPENID_SCOPE, 'profile'] : []),
      ...meta.map((m) => m.scope).filter((s): s is string => typeof s === 'string'),
    ]
  } catch {
    // scope 元数据表不可用不阻塞 discovery:退到静态最小集(不宣称未实现的东西)
  }
  return buildAuthorizationServerMetadata({
    issuer,
    authorizationPath: AS_PATHS.authorization,
    tokenPath: AS_PATHS.token,
    jwksPath: AS_PATHS.jwks,
    registrationPath: AS_PATHS.registration,
    introspectionPath: AS_PATHS.introspection,
    revocationPath: AS_PATHS.revocation,
    userinfoPath: opts.oidc ? AS_PATHS.userinfo : undefined,
    // 只声明真实现的 grant:authorization_code / refresh_token / client_credentials。
    // 既有 /api/oauth/device 是非标准设备码流程(grant_type 未走 urn:...:device_code),
    // 因此不写进 grant_types_supported,避免 discovery 撒谎。
    grantTypes: ['authorization_code', 'refresh_token', 'client_credentials'],
    codeChallengeMethods: ['S256'],
    tokenEndpointAuthMethods: ['client_secret_basic', 'client_secret_post', 'none'],
    scopesSupported,
    oidc: opts.oidc,
    // 与 signIdToken/buildOidcProfileClaims 实际产出的 claims 严格一致
    claimsSupported: [
      'sub',
      'iss',
      'aud',
      'exp',
      'iat',
      'auth_time',
      'nonce',
      'nickname',
      'avatar',
    ],
  })
}

/** 未显式配置 issuer 时,浏览器授权请求转交的 web 同意页(已存在于 apps/web/app/(main)/oauth/authorize)。 */
function webAuthorizeUrl(request: FastifyRequest): string {
  const explicit = process.env.OAUTH_WEB_AUTHORIZE_URL?.trim()
  if (explicit) return explicit
  const firstOrigin = (config.CORS_ORIGIN ?? '').split(',')[0]?.trim()
  const base = /^https?:\/\//.test(firstOrigin ?? '')
    ? (firstOrigin as string).replace(/\/+$/, '')
    : resolveIssuer(request)
  return `${base}/oauth/authorize`
}

/** OIDC 协议级 scope:不进 oauth_scope_meta 目录(目录只登记数据 scope),但必须可用。 */
const PROTOCOL_SCOPES = [OPENID_SCOPE, 'profile']

/** app 实际可授予的 scope = 目录白名单 ∪ 协议 scope。 */
function allowedScopesForApp(app: OAuthAppRow): string[] {
  return [...((app.scopes as string[]) ?? []), ...PROTOCOL_SCOPES]
}

export const oauthAuthorizationServerRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /oauth/authorize — 标准授权端点(RFC 6749 §4.1 / OIDC Core §3.1.1)。
   *
   * 为什么实现在"元数据"文件里:本文件的 discovery 用 AS_PATHS.authorization 声明了它,
   * 声明即须实现(否则发现文档撒谎,第三方 Agent 拿到的 authorization_endpoint 是 404)。
   *
   * 三条分支:
   *  1. 校验失败(参数/白名单/PKCE/scope):redirect_uri 已过白名单时 302 带 error 回跳
   *     (RFC 6749 §4.1.2.1),否则 400 —— 绝不向未校验的 URI 跳转(防开放重定向);
   *  2. 无 Bearer(纯浏览器会话):302 转 web 同意页,由用户点"同意"后经
   *     `/api/auth/oauth/authorize` 发码回跳 —— 同意动作必须由人完成,这里不代替用户发码;
   *  3. 携带 Bearer access token(桌面/CLI/服务端代理已持有用户身份):直接发码 + 302 回跳。
   */
  server.get('/oauth/authorize', async (request, reply) => {
    const parsed = z
      .object({
        client_id: z.string().min(1).max(200),
        redirect_uri: z.string().min(1).max(2048),
        response_type: z.string().max(32).optional(),
        state: z.string().min(1).max(256),
        scope: z.string().max(4000).optional(),
        code_challenge: z.string().max(256).optional(),
        code_challenge_method: z.string().max(10).optional(),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        error_description: parsed.error.issues[0]?.message ?? '参数错误',
      })
    }
    const q = parsed.data
    const app = await findOAuthAppByClientId(q.client_id)
    if (!app || app.isActive !== 1) {
      return reply
        .status(404)
        .send({ error: 'invalid_client', error_description: '应用不存在或已禁用' })
    }
    const redirectUris = (app.redirectUris as string[]) ?? []
    if (!redirectUris.includes(q.redirect_uri)) {
      return reply
        .status(400)
        .send({ error: 'invalid_request', error_description: 'redirect_uri 不在白名单' })
    }
    const backWithError = (error: string, description: string) => {
      const url = new URL(q.redirect_uri)
      url.searchParams.set('error', error)
      url.searchParams.set('error_description', description)
      url.searchParams.set('state', q.state)
      return reply.status(302).header('location', url.toString()).send()
    }
    if (q.response_type && q.response_type !== 'code') {
      return backWithError(
        'unsupported_response_type',
        `不支持的 response_type: ${q.response_type}`,
      )
    }
    const { granted, rejected } = resolveGrantedScopes(q.scope, allowedScopesForApp(app))
    if (rejected.length > 0) {
      return backWithError('invalid_scope', `scope 未被该应用授权: ${rejected.join(' ')}`)
    }
    const pkceError = precheckAuthorizePkce({
      codeChallenge: q.code_challenge,
      codeChallengeMethod: q.code_challenge_method,
      app,
      publicClient: isPublicClientApp(app),
    })
    if (pkceError) return backWithError('invalid_request', pkceError)

    const bearer = (request.headers.authorization ?? '').trim()
    let userId: string | null = null
    if (bearer.startsWith('Bearer ')) {
      const info = await introspectAccessToken(bearer.slice(7).trim())
      userId = info.active ? (info.sub ?? null) : null
    }
    if (!userId) {
      const target = new URL(webAuthorizeUrl(request))
      for (const [key, value] of Object.entries(request.query as Record<string, string>)) {
        target.searchParams.set(key, value)
      }
      return reply.status(302).header('location', target.toString()).send()
    }

    const code = generateAuthorizationCode(
      app.clientId,
      userId,
      granted.join(' '),
      q.redirect_uri,
      600,
    )
    await createOAuthSession({
      code,
      clientId: app.clientId,
      userId,
      state: q.state,
      scope: granted.join(' '),
      codeChallenge: q.code_challenge,
      codeChallengeMethod: q.code_challenge_method,
    })
    await createAuditLog({
      event: 'authorize',
      clientId: app.clientId,
      userId,
      ip: request.ip,
      status: 'success',
    })
    const back = new URL(q.redirect_uri)
    back.searchParams.set('code', code)
    back.searchParams.set('state', q.state)
    return reply.status(302).header('location', back.toString()).send()
  })
  server.get('/.well-known/oauth-authorization-server', async (request, reply) => {
    const issuer = resolveIssuer(request)
    const doc = await buildAsMetadata(issuer, { oidc: true })
    return reply
      .header('cache-control', 'public, max-age=300')
      .header('access-control-allow-origin', '*')
      .send(doc)
  })

  // RFC 8414 §3.1:issuer 含路径时元数据用"路径插入"形式暴露,MCP 客户端普遍走这条。
  server.get('/.well-known/oauth-authorization-server/*', async (request, reply) => {
    const issuer = resolveIssuer(request)
    const doc = await buildAsMetadata(issuer, { oidc: true })
    return reply
      .header('cache-control', 'public, max-age=300')
      .header('access-control-allow-origin', '*')
      .send(doc)
  })

  server.get('/.well-known/openid-configuration', async (request, reply) => {
    const issuer = resolveIssuer(request)
    const doc = await buildAsMetadata(issuer, { oidc: true })
    return reply
      .header('cache-control', 'public, max-age=300')
      .header('access-control-allow-origin', '*')
      .send(doc)
  })

  server.get('/oauth/jwks', async (_request, reply) => {
    const keys = await getOidcSigningKeys()
    const jwks = await buildJwks(keys.map((k) => ({ kid: k.kid, publicKeyPem: k.publicKeyPem })))
    return reply
      .header('cache-control', 'public, max-age=300')
      .header('access-control-allow-origin', '*')
      .send(jwks)
  })

  /**
   * OIDC UserInfo(Core §5.3):Bearer access token → claims。
   * 同时支持 GET 与 POST(form_post 认证除外,凭证只走 Authorization header)。
   * 注:当前 access token 未携带 scope claim(signAccessToken 只写 userId/phone/familyId/roleId),
   * 故无法按 profile scope 收敛返回集;claims 与 ID Token 保持同一最小集,
   * 待 scope 进 claims 后再按 scope 过滤(见 O7 交付说明)。
   */
  const userinfoHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<unknown> => {
    const header = request.headers.authorization ?? ''
    if (!header.startsWith('Bearer ')) {
      return reply
        .status(401)
        .header('www-authenticate', 'Bearer realm="ihui-ai"')
        .send({ error: 'invalid_token', error_description: '缺少 Bearer access token' })
    }
    const info = await introspectAccessToken(header.slice(7).trim())
    if (!info.active || !info.sub) {
      return reply
        .status(401)
        .header('www-authenticate', 'Bearer error="invalid_token"')
        .send({ error: 'invalid_token', error_description: 'access token 无效或已过期' })
    }
    const user = await findUserById(info.sub)
    if (!user) return reply.status(404).send({ error: 'invalid_grant' })
    // claims 集合与 discovery.claims_supported 严格一致(不额外漏出 email/phone)
    return reply.header('cache-control', 'no-store').send({
      sub: user.id,
      nickname: user.nickname ?? undefined,
      avatar: user.avatar ?? undefined,
    })
  }

  server.route({ url: '/oauth/userinfo', method: ['GET', 'POST'], handler: userinfoHandler })
}

/** 供 oauth-tokens.ts 复用:授权成功后签 ID Token(拿不到密钥时返回 null,不阻断 code/token)。 */
export async function issueIdToken(params: {
  issuer: string
  subject: string
  clientId: string
  nonce?: string | null
  scopes: string[]
  profile: { nickname?: string | null; avatar?: string | null }
}): Promise<string | null> {
  if (!params.scopes.includes(OPENID_SCOPE)) return null
  const keys = await getOidcSigningKeys()
  const key = keys[0]
  if (!key) return null
  const claims: Record<string, string | number | undefined> = {}
  if (params.scopes.includes('profile')) {
    if (params.profile.nickname) claims.nickname = params.profile.nickname
    if (params.profile.avatar) claims.avatar = params.profile.avatar
  }
  try {
    return await signIdToken(
      {
        issuer: params.issuer,
        subject: params.subject,
        audience: params.clientId,
        nonce: params.nonce,
        claims,
      },
      key.privateKeyPem,
      key.kid,
    )
  } catch (err) {
    logger.warn('[oauth-as] id_token 签发失败', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
