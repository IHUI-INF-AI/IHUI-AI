/**
 * 通用 OIDC Provider(企业 SSO)。
 *
 * 通过 `OIDC_ISSUER/.well-known/openid-configuration` 自动发现 endpoints:
 * - authorization_endpoint
 * - token_endpoint
 * - userinfo_endpoint
 *
 * scope: `openid profile email`(标准 OIDC)
 *
 * id_token 验签(JWKS)由主 agent 后续补充,当前只取 access_token + userinfo。
 */

import type {
  OAuthProvider,
  OAuthProviderConfig,
  OAuthTokenResponse,
  OAuthUserInfo,
} from './index.js'

export interface OidcProviderConfig extends OAuthProviderConfig {
  /** OIDC Issuer URL,如 https://sso.example.com(无尾斜杠) */
  issuer: string
}

/** OIDC Discovery 文档结构(只列用到的字段) */
interface OidcDiscovery {
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
  issuer: string
}

/** OIDC userinfo 响应(标准 claims 子集) */
interface OidcUserInfo {
  sub: string
  name?: string
  preferred_username?: string
  email?: string
  picture?: string
}

/** OIDC token 响应 */
interface OidcTokenResponse {
  access_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  id_token?: string
  error?: string
  error_description?: string
}

/** Discovery 缓存(按 issuer 缓存,进程内 TTL 10 分钟) */
const discoveryCache = new Map<string, { discovery: OidcDiscovery; expiresAt: number }>()
const DISCOVERY_TTL_MS = 10 * 60 * 1000

async function discoverEndpoints(issuer: string): Promise<OidcDiscovery> {
  const cached = discoveryCache.get(issuer)
  if (cached && Date.now() < cached.expiresAt) return cached.discovery

  const url = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    throw new Error(`OIDC discovery 失败: HTTP ${res.status} (${url})`)
  }
  const data = (await res.json()) as OidcDiscovery
  if (!data.authorization_endpoint || !data.token_endpoint || !data.userinfo_endpoint) {
    throw new Error('OIDC discovery 文档缺少必要的 endpoint 字段')
  }
  discoveryCache.set(issuer, { discovery: data, expiresAt: Date.now() + DISCOVERY_TTL_MS })
  return data
}

export function isOidcConfigured(): boolean {
  return Boolean(
    process.env.OIDC_ISSUER &&
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET &&
    process.env.OIDC_REDIRECT_URI,
  )
}

export function createOidcProvider(config: OidcProviderConfig): OAuthProvider {
  const provider: OAuthProvider = {
    name: 'oidc',
    // 占位:实际值由 discoverEndpoints() 异步获取(每次调用 lazy discover + 缓存)
    authorizationUrl: '',
    tokenUrl: '',
    userInfoUrl: '',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    scopes: ['openid', 'profile', 'email'],

    async getAuthorizationUrl(state: string): Promise<string> {
      return buildOidcAuthorizationUrl(config, state)
    },

    async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
      const discovery = await discoverEndpoints(config.issuer)
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      })
      const res = await fetch(discovery.token_endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      })
      const data = (await res.json()) as OidcTokenResponse
      if (!data.access_token) {
        throw new Error(
          `OIDC token 交换失败: ${data.error ?? '未知错误'}${data.error_description ? ` — ${data.error_description}` : ''}`,
        )
      }
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type ?? 'Bearer',
        expiresIn: data.expires_in,
      }
    },

    async fetchUserInfo(accessToken: string): Promise<OAuthUserInfo> {
      const discovery = await discoverEndpoints(config.issuer)
      const res = await fetch(discovery.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        throw new Error(`OIDC userinfo 拉取失败: HTTP ${res.status}`)
      }
      const info = (await res.json()) as OidcUserInfo
      return {
        openId: info.sub,
        nickname: info.preferred_username ?? info.name,
        email: info.email,
        avatar: info.picture,
      }
    },
  }

  return provider
}

/**
 * 同步构造 OIDC 授权 URL(后端 handler 使用)。
 * 内部 await discoverEndpoints 拿到真实 authorization_endpoint 后构造。
 */
export async function buildOidcAuthorizationUrl(
  config: OidcProviderConfig,
  state: string,
): Promise<string> {
  const discovery = await discoverEndpoints(config.issuer)
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
  })
  return `${discovery.authorization_endpoint}?${params.toString()}`
}
