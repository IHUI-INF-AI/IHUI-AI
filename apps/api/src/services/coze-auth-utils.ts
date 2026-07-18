/**
 * Coze OAuth 认证工具。
 * 迁移自 v1.0.2-sealed: server/app/utils/coze_auth_utils.py
 *
 * 提供:
 * - loadCozeOAuthConfig: 加载 OAuth 配置（环境变量优先）
 * - getCozeAccessToken: 获取 access_token（带内存缓存, RS256 JWT 签发）
 *
 * 环境变量:
 * - COZE_OAUTH_APP_ID / COZE_PUBLIC_KEY_ID / COZE_PRIVATE_KEY
 * - COZE_OAUTH_APP_AUD (默认 https://api.coze.cn)
 * - COZE_API_BASE (默认 https://api.coze.cn)
 * - COZE_OAUTH_TOKEN_URL (默认 ${COZE_API_BASE}/api/permission/oauth2/token)
 */

import { env } from 'node:process'
import { randomUUID } from 'node:crypto'
import { SignJWT } from 'jose'

const TOKEN_TTL = 86399 // 24h - 1s, 与 Coze JWT 流程一致

const DEFAULT_COZE_API_BASE = 'https://api.coze.cn'
const DEFAULT_COZE_AUD = 'https://api.coze.cn'

/** 内存缓存: { token, expireTime } */
const tokenCache: { token: string | null; expireTime: number } = {
  token: null,
  expireTime: 0,
}

export interface CozeOAuthConfig {
  clientType: 'jwt'
  clientId: string
  cozeWwwBase: string
  cozeApiBase: string
  privateKey: string
  publicKeyId: string
}

function strToPrivateKey(pem: string): Uint8Array {
  return new TextEncoder().encode(pem)
}

/** 加载 Coze OAuth 配置（环境变量优先） */
export function loadCozeOAuthConfig(): CozeOAuthConfig | null {
  const clientId = env.COZE_OAUTH_APP_ID
  const publicKeyId = env.COZE_PUBLIC_KEY_ID
  const privateKey = env.COZE_PRIVATE_KEY
  if (!clientId || !publicKeyId || !privateKey) return null
  return {
    clientType: 'jwt',
    clientId,
    cozeWwwBase: 'https://www.coze.cn',
    cozeApiBase: env.COZE_API_BASE ?? DEFAULT_COZE_API_BASE,
    privateKey,
    publicKeyId,
  }
}

/** 从环境变量获取私钥 */
export function getPrivateKey(): string | null {
  return env.COZE_PRIVATE_KEY ?? null
}

/** 生成 RS256 签名的 JWT token */
async function buildJwtToken(userUuid: string | null, privateKey: string): Promise<string> {
  const clientId = env.COZE_OAUTH_APP_ID
  const publicKeyId = env.COZE_PUBLIC_KEY_ID
  if (!clientId || !publicKeyId) throw new Error('COZE_OAUTH_APP_ID/COZE_PUBLIC_KEY_ID 未配置')

  const now = Math.floor(Date.now() / 1000)
  const payload: Record<string, string | number> = {
    iss: clientId,
    aud: env.COZE_OAUTH_APP_AUD ?? DEFAULT_COZE_AUD,
    iat: now,
    exp: now + TOKEN_TTL,
    jti: randomUUID().replace(/-/g, ''),
  }
  if (userUuid) payload.session_name = userUuid

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: publicKeyId })
    .sign(strToPrivateKey(privateKey))
}

/**
 * 获取 Coze 访问令牌（异步, 带内存缓存）。
 * 流程:
 * 1. 检查缓存中的 token 是否有效（未过期且非强制刷新）
 * 2. 生成 JWT token（RS256）
 * 3. 调用 Coze 授权接口换取 access_token
 * 4. 缓存 token 以便后续使用
 */
export async function getCozeAccessToken(options: {
  userUuid?: string | null
  privateKey?: string | null
  forceRefresh?: boolean
} = {}): Promise<string | null> {
  const { userUuid = null, privateKey: pkOverride = null, forceRefresh = false } = options
  try {
    const now = Math.floor(Date.now() / 1000)
    if (!forceRefresh && tokenCache.token && tokenCache.expireTime > now) {
      return tokenCache.token
    }

    const clientId = env.COZE_OAUTH_APP_ID
    const publicKeyId = env.COZE_PUBLIC_KEY_ID
    const privateKey = pkOverride ?? getPrivateKey()
    if (!clientId || !publicKeyId || !privateKey) {
      throw new Error('JWT 配置不完整 (COZE_OAUTH_APP_ID/COZE_PUBLIC_KEY_ID/COZE_PRIVATE_KEY)')
    }

    const jwtToken = await buildJwtToken(userUuid, privateKey)
    const tokenUrl =
      env.COZE_OAUTH_TOKEN_URL ??
      `${env.COZE_API_BASE ?? DEFAULT_COZE_API_BASE}/api/permission/oauth2/token`
    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        duration_seconds: TOKEN_TTL,
      }),
    })
    if (!resp.ok) {
      throw new Error(`Coze 授权接口 HTTP ${resp.status}`)
    }
    const result = (await resp.json()) as { access_token?: string }
    if (!result.access_token) {
      throw new Error('Coze 授权响应缺少 access_token')
    }
    tokenCache.token = result.access_token
    tokenCache.expireTime = now + TOKEN_TTL
    return result.access_token
  } catch (e) {
    console.error('[coze-auth-utils] getCozeAccessToken 失败:', e)
    return null
  }
}

/** 清除内存中的 token 缓存（供强制刷新或测试使用） */
export function clearTokenCache(): void {
  tokenCache.token = null
  tokenCache.expireTime = 0
}
