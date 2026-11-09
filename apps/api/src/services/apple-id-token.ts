// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Apple `id_token` 验签(2026-11-08 P0)。
 *
 * 旧实现在 `auth-extended.ts` 里只把 id_token 第二段 base64 解出 `sub`,
 * 不校验签名 ⇒ 任何人本地自签一枚 JWT 就能冒充任意 Apple 账号登录。
 *
 * 本模块按 Apple 官方 JWKS 验签,全部 fail-closed:
 *  - `alg` 只接受 RS256(含 `none` 在内的一律拒绝);
 *  - `iss` 必须是 https://appleid.apple.com;
 *  - `aud` 必须包含传入的 client id(支持数组);
 *  - `exp` / `iat` 必须存在且有效;`sub` 必须是非空字符串;
 *  - 公钥按 `kid` 缓存;未知 `kid` 强制刷新一次 JWKS 后仍无 ⇒ 拒绝。
 */
import { decodeProtectedHeader, importJWK, jwtVerify } from 'jose'

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'
const APPLE_ISSUER = 'https://appleid.apple.com'

/** JWKS 本地缓存时长:Apple 轮换密钥时最多 6h 后生效;未知 kid 会立即强制刷新。 */
const JWKS_CACHE_TTL_MS = 6 * 60 * 60 * 1000
/** 密钥拉取超时:认证路径不得被第三方网络挂起。 */
const JWKS_FETCH_TIMEOUT_MS = 5_000
/** 允许的时钟偏移(秒)。 */
const CLOCK_TOLERANCE_SECONDS = 30

type AppleVerifyKey = Awaited<ReturnType<typeof importJWK>>

let keyCache = new Map<string, AppleVerifyKey>()
let cacheFetchedAt = 0
let refreshing: Promise<void> | null = null

/** 仅供夹具清空模块级 JWKS 缓存,生产代码不得调用。 */
export function resetAppleJwksCacheForTest(): void {
  keyCache = new Map()
  cacheFetchedAt = 0
  refreshing = null
}

async function fetchAppleJwks(): Promise<void> {
  const res = await fetch(APPLE_JWKS_URL, {
    signal: AbortSignal.timeout(JWKS_FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Apple JWKS 获取失败: HTTP ${res.status}`)
  const data = (await res.json()) as { keys?: Array<Record<string, unknown>> }
  const keys = Array.isArray(data.keys) ? data.keys : []
  const next = new Map<string, AppleVerifyKey>()
  for (const jwk of keys) {
    if (!jwk || jwk.kty !== 'RSA' || typeof jwk.kid !== 'string') continue
    try {
      next.set(jwk.kid, await importJWK(jwk as Parameters<typeof importJWK>[0], 'RS256'))
    } catch {
      // 单把脏 key 不影响其余 key(仍然 fail-closed:该 kid 视为不存在)
    }
  }
  keyCache = next
  cacheFetchedAt = Date.now()
}

async function loadAppleJwks(forceRefresh: boolean): Promise<void> {
  const fresh = keyCache.size > 0 && Date.now() - cacheFetchedAt < JWKS_CACHE_TTL_MS
  if (!forceRefresh && fresh) return
  if (refreshing) {
    await refreshing
    if (!forceRefresh) return
  }
  refreshing = fetchAppleJwks()
  try {
    await refreshing
  } finally {
    refreshing = null
  }
}

/**
 * 验证 Apple id_token 并返回可信身份。
 *
 * @throws 任何签名/声明不合法都会抛错;调用方必须据此拒绝登录(fail-closed)。
 */
export async function verifyAppleIdToken(
  idToken: string,
  clientId: string,
): Promise<{ sub: string; email?: string }> {
  if (!clientId) throw new Error('Apple client id 未配置')

  let header: ReturnType<typeof decodeProtectedHeader>
  try {
    header = decodeProtectedHeader(idToken)
  } catch {
    throw new Error('Apple id_token 头部格式无效')
  }
  if (header.alg !== 'RS256') throw new Error(`Apple id_token alg 不允许: ${header.alg ?? 'none'}`)
  if (typeof header.kid !== 'string' || header.kid.length === 0) {
    throw new Error('Apple id_token 缺少 kid')
  }

  const kid = header.kid
  if (keyCache.size === 0 || Date.now() - cacheFetchedAt >= JWKS_CACHE_TTL_MS) {
    await loadAppleJwks(false)
  }
  let key = keyCache.get(kid)
  if (!key) {
    // 未知 kid:强制刷新一次再判定,仍无则拒绝
    await loadAppleJwks(true)
    key = keyCache.get(kid)
  }
  if (!key) throw new Error(`Apple id_token kid 不存在: ${kid}`)

  const { payload } = await jwtVerify(idToken, key, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: clientId,
    clockTolerance: CLOCK_TOLERANCE_SECONDS,
  })

  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw new Error('Apple id_token exp 无效或已过期')
  }
  if (typeof payload.iat !== 'number' || payload.iat > now + CLOCK_TOLERANCE_SECONDS) {
    throw new Error('Apple id_token iat 无效')
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Apple id_token 缺少 sub')
  }

  return {
    sub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
