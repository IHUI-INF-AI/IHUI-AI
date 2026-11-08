// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/** 缓存分槽上限:每个 (clientId, userUuid, scope) 一套 token,防止无界增长。 */
const MAX_CACHED_TOKENS = 200

interface CachedToken {
  token: string
  expireTime: number
}

/**
 * 内存缓存(F-270):**按 `clientId|userUuid|scope` 分槽**,不是全局单槽。
 *
 * access_token 是按 JWT 里的 `session_name=userUuid`(以及申请 scope)签发的,
 * 把它放在一个模块级单槽里意味着"A 的 token 会被当 B 的返回"—— 越权/身份错配,
 * 而响应上完全同形。分槽后每个主体各自命中自己的缓存。
 */
const tokenCache = new Map<string, CachedToken>()

function cacheKeyOf(clientId: string, userUuid: string | null, scope: string | null): string {
  // `app` 占位符与真实 userUuid 不会撞:uuid 不含该字面形态且段间有 `|` 分隔。
  return `${clientId}|${userUuid ?? 'app'}|${scope ?? ''}`
}

function readCachedToken(key: string, now: number): string | null {
  const hit = tokenCache.get(key)
  if (!hit) return null
  if (hit.expireTime <= now) {
    tokenCache.delete(key)
    return null
  }
  // 命中后重插:Map 迭代序即淘汰序,让最近使用的槽排到队尾。
  tokenCache.delete(key)
  tokenCache.set(key, hit)
  return hit.token
}

function writeCachedToken(key: string, token: string, expireTime: number): void {
  tokenCache.delete(key)
  tokenCache.set(key, { token, expireTime })
  while (tokenCache.size > MAX_CACHED_TOKENS) {
    const oldest = tokenCache.keys().next().value
    if (oldest === undefined) break
    tokenCache.delete(oldest)
  }
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
export async function getCozeAccessToken(
  options: {
    userUuid?: string | null
    privateKey?: string | null
    forceRefresh?: boolean
    /** 申请的最小权限范围;参与缓存分槽 —— 不同 scope 不得复用同一 token。 */
    scope?: string | null
  } = {},
): Promise<string | null> {
  const {
    userUuid = null,
    privateKey: pkOverride = null,
    forceRefresh = false,
    scope = null,
  } = options
  try {
    const now = Math.floor(Date.now() / 1000)

    const clientId = env.COZE_OAUTH_APP_ID
    const publicKeyId = env.COZE_PUBLIC_KEY_ID
    const privateKey = pkOverride ?? getPrivateKey()
    if (!clientId || !publicKeyId || !privateKey) {
      throw new Error('JWT 配置不完整 (COZE_OAUTH_APP_ID/COZE_PUBLIC_KEY_ID/COZE_PRIVATE_KEY)')
    }

    const cacheKey = cacheKeyOf(clientId, userUuid, scope)
    if (!forceRefresh) {
      const cached = readCachedToken(cacheKey, now)
      if (cached) return cached
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
    const result = (await resp.json()) as { access_token?: string; expires_in?: number }
    if (!result.access_token) {
      throw new Error('Coze 授权响应缺少 access_token')
    }
    // 用真实 TTL;响应没给才退回默认值 —— 固定 24h 会在上游提前吊销时继续回放过期 token。
    const expiresIn =
      typeof result.expires_in === 'number' && result.expires_in > 0
        ? result.expires_in
        : TOKEN_TTL
    writeCachedToken(cacheKey, result.access_token, now + expiresIn)
    return result.access_token
  } catch (e) {
    console.error(
      '[coze-auth-utils] getCozeAccessToken 失败:',
      e instanceof Error ? e.message : String(e),
    )
    return null
  }
}

/** 清除内存中的 token 缓存（供强制刷新或测试使用） */
export function clearTokenCache(): void {
  tokenCache.clear()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
