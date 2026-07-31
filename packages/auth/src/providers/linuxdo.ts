/**
 * LinuxDO OAuth2 Provider。
 *
 * 文档: https://connect.linux.do(社区 OAuth2 网关)
 * - authorizationUrl: https://connect.linux.do/oauth2/authorize
 * - tokenUrl:         https://connect.linux.do/oauth2/token
 * - userInfoUrl:      https://connect.linux.do/api/user
 * - scope:            user_info
 */

import type {
  OAuthProvider,
  OAuthProviderConfig,
  OAuthTokenResponse,
  OAuthUserInfo,
} from './index.js'

export type LinuxdoProviderConfig = OAuthProviderConfig

/** LinuxDO /api/user 响应 */
interface LinuxdoUser {
  id: number
  username: string
  name?: string
  avatar_url?: string
  email?: string
  trust_level?: number
}

/** LinuxDO token 响应 */
interface LinuxdoTokenResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: string
  error_description?: string
}

export function isLinuxdoConfigured(): boolean {
  return Boolean(
    process.env.LINUXDO_CLIENT_ID &&
    process.env.LINUXDO_CLIENT_SECRET &&
    process.env.LINUXDO_REDIRECT_URI,
  )
}

export function createLinuxdoProvider(config: LinuxdoProviderConfig): OAuthProvider {
  return {
    name: 'linuxdo',
    authorizationUrl: 'https://connect.linux.do/oauth2/authorize',
    tokenUrl: 'https://connect.linux.do/oauth2/token',
    userInfoUrl: 'https://connect.linux.do/api/user',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    scopes: ['user_info'],

    async getAuthorizationUrl(state: string): Promise<string> {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'user_info',
        state,
      })
      return `https://connect.linux.do/oauth2/authorize?${params.toString()}`
    },

    async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      })
      const res = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      })
      const data = (await res.json()) as LinuxdoTokenResponse
      if (!data.access_token) {
        throw new Error(
          `LinuxDO token 交换失败: ${data.error ?? '未知错误'}${data.error_description ? ` — ${data.error_description}` : ''}`,
        )
      }
      return {
        accessToken: data.access_token,
        tokenType: data.token_type ?? 'Bearer',
        expiresIn: data.expires_in,
      }
    },

    async fetchUserInfo(accessToken: string): Promise<OAuthUserInfo> {
      const res = await fetch(this.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        throw new Error(`LinuxDO userinfo 拉取失败: HTTP ${res.status}`)
      }
      const user = (await res.json()) as LinuxdoUser
      return {
        openId: String(user.id),
        unionId: String(user.id),
        nickname: user.name ?? user.username,
        email: user.email,
        avatar: user.avatar_url,
      }
    },
  }
}
