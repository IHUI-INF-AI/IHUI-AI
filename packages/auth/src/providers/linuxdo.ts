// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LinuxDo OAuth2 Provider。
 *
 * LinuxDo 是 Discourse 社区,自建 OAuth2 端点(非标准三方 SDK):
 * - authorizationUrl: https://connect.linux.do/oauth2/authorize
 * - tokenUrl:         https://connect.linux.do/oauth2/token
 * - userInfoUrl:      https://connect.linux.do/api/user
 * - scope:            user
 *
 * token 交换用 form body 传 client_id/client_secret(LinuxDo 不要求 Basic Auth);
 * userinfo 用 Authorization: Bearer。email 归属以 LinuxDo 返回为准。
 */

import type {
  OAuthProvider,
  OAuthProviderConfig,
  OAuthTokenResponse,
  OAuthUserInfo,
} from './index.js'

export type LinuxdoProviderConfig = OAuthProviderConfig

interface LinuxdoUser {
  id: number
  username?: string
  name?: string | null
  email?: string | null
  avatar_thumb?: string | null
  avatar?: string | null
  /** Discourse 邮箱验证位;字段名依部署而异,兼容多种 */
  verified?: boolean | null
  email_verified?: boolean | null
}

interface LinuxdoTokenResponse {
  access_token?: string
  refresh_token?: string
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

/** 归一化 userinfo 头像相对路径为绝对 URL(LinuxDo 常返回 /user_avatar/... 相对路径)。 */
function normalizeAvatar(baseOrigin: string, raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  if (/^https?:\/\//i.test(raw)) return raw
  return `${baseOrigin}${raw.startsWith('/') ? '' : '/'}${raw}`
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
    scopes: ['user'],

    async getAuthorizationUrl(state: string): Promise<string> {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'user',
        state,
      })
      return `https://connect.linux.do/oauth2/authorize?${params.toString()}`
    },

    async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      })
      const res = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(10_000),
      })
      const data = (await res.json()) as LinuxdoTokenResponse
      if (!data.access_token) {
        throw new Error(
          `LinuxDo token 交换失败: ${data.error ?? '未知错误'}${data.error_description ? ` — ${data.error_description}` : ''}`,
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
      const res = await fetch(this.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        throw new Error(`LinuxDo userinfo 拉取失败: HTTP ${res.status}`)
      }
      const user = (await res.json()) as LinuxdoUser
      const emailVerified = user.email_verified ?? user.verified ?? undefined
      return {
        openId: String(user.id),
        nickname: user.name || user.username,
        email: user.email ?? undefined,
        emailVerified: emailVerified === true,
        avatar: normalizeAvatar('https://linux.do', user.avatar_thumb ?? user.avatar),
      }
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
