/**
 * Discord OAuth2 Provider。
 *
 * 文档: https://discord.com/developers/docs/topics/oauth2
 * - authorizationUrl: https://discord.com/oauth2/authorize
 * - tokenUrl:         https://discord.com/api/oauth2/token
 * - userInfoUrl:      https://discord.com/api/users/@me
 * - scope:            identify email
 */

import type {
  OAuthProvider,
  OAuthProviderConfig,
  OAuthTokenResponse,
  OAuthUserInfo,
} from './index.js'

export type DiscordProviderConfig = OAuthProviderConfig

/** Discord /api/users/@me 响应(只列用到的字段) */
interface DiscordUser {
  id: string
  username: string
  global_name?: string | null
  avatar?: string | null
  email?: string | null
  discriminator?: string
}

/** Discord token 响应 */
interface DiscordTokenResponse {
  access_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  error?: string
  error_description?: string
}

/** Discord avatar URL 构造:CDN 路径,avatar 为 null 时用默认头像 */
function buildDiscordAvatarUrl(userId: string, avatar: string | null | undefined): string {
  if (!avatar) return 'https://cdn.discordapp.com/embed/avatars/0.png'
  const ext = avatar.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}`
}

export function isDiscordConfigured(): boolean {
  return Boolean(
    process.env.DISCORD_CLIENT_ID &&
    process.env.DISCORD_CLIENT_SECRET &&
    process.env.DISCORD_REDIRECT_URI,
  )
}

export function createDiscordProvider(config: DiscordProviderConfig): OAuthProvider {
  return {
    name: 'discord',
    authorizationUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    scopes: ['identify', 'email'],

    async getAuthorizationUrl(state: string): Promise<string> {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'identify email',
        state,
        prompt: 'consent',
      })
      return `https://discord.com/oauth2/authorize?${params.toString()}`
    },

    async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      })
      // Discord 要求 Basic Auth(client_id:client_secret base64)
      const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
      const res = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      })
      const data = (await res.json()) as DiscordTokenResponse
      if (!data.access_token) {
        throw new Error(
          `Discord token 交换失败: ${data.error ?? '未知错误'}${data.error_description ? ` — ${data.error_description}` : ''}`,
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
        throw new Error(`Discord userinfo 拉取失败: HTTP ${res.status}`)
      }
      const user = (await res.json()) as DiscordUser
      return {
        openId: user.id,
        nickname: user.global_name ?? user.username,
        email: user.email ?? undefined,
        avatar: buildDiscordAvatarUrl(user.id, user.avatar),
      }
    },
  }
}
