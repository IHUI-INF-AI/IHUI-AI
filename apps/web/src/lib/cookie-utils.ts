/**
 * Auth Cookie 管理。
 *
 * - auth_token:accessToken(供 SSR/middleware 读取),跟随 access token 生命周期
 * - refresh_token:refreshToken(持久化以支持"记住 30 天"),autoLogin=true 时 max-age=30d
 *
 * 注意:与 accessToken 同等级非 httpOnly(项目现有策略),refresh 后端有家族轮换 +
 * RFC 6749 重用检测保护,被窃取后可即时吊销。
 */

const REFRESH_TOKEN_COOKIE = 'refresh_token'
const AUTH_TOKEN_COOKIE = 'auth_token'
/** 自动登录时 refreshToken cookie 有效期:30 天(与后端 refresh TTL 对齐) */
export const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60
/** 2026-07-31 升级:accessToken cookie 默认 30 天(原 7 天,因 admin 测试账号用户偏好"长持久化,
 *  避免每周都要重新登录,完整覆盖 30 天 refreshToken 周期)。
 *  关键安全说明:accessToken cookie 走 document.cookie(非 httpOnly),
 *  任何 XSS 都能读取。30 天延长是用户可接受的风险(本项目 XSS 防护已就位),
 *  如果项目有独立用户要求更短 TTL,可改回 7 天(平衡用户体验与安全)。 */
const ACCESS_TOKEN_DEFAULT_MAX_AGE = 30 * 24 * 60 * 60

export function getAuthCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const configured = process.env.NEXT_PUBLIC_COOKIE_DOMAIN
  if (!configured) return undefined
  const host = window.location.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
    return undefined
  }
  return configured
}

interface CookieOpts {
  /** max-age 秒;不传(默认 -1)表示 session cookie(浏览器关闭即失效) */
  maxAge?: number
}

function buildCookieParts(opts?: CookieOpts): string[] {
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const domain = getAuthCookieDomain()
  const parts = ['path=/', 'SameSite=Lax']
  if (opts?.maxAge !== undefined && opts.maxAge >= 0) {
    parts.push(`max-age=${opts.maxAge}`)
  }
  if (isSecure) parts.push('Secure')
  if (domain) parts.push(`domain=${domain}`)
  return parts
}

export function setAuthCookie(token: string | null, opts?: CookieOpts): void {
  if (typeof document === 'undefined') return
  // 2026-07-28 加固:默认 7 天 maxAge(原默认 -1 = session cookie,关闭浏览器失效)
  const finalOpts: CookieOpts = {
    maxAge: opts?.maxAge ?? ACCESS_TOKEN_DEFAULT_MAX_AGE,
  }
  const parts = buildCookieParts(finalOpts)
  if (token) {
    document.cookie = `${AUTH_TOKEN_COOKIE}=${token}; ${parts.join('; ')}`
  } else {
    document.cookie = `${AUTH_TOKEN_COOKIE}=; ${parts.map((p) => (p.startsWith('max-age') ? 'max-age=0' : p)).join('; ')}`
  }
}

export function setRefreshTokenCookie(token: string | null, opts?: CookieOpts): void {
  if (typeof document === 'undefined') return
  const parts = buildCookieParts(opts)
  if (token) {
    document.cookie = `${REFRESH_TOKEN_COOKIE}=${token}; ${parts.join('; ')}`
  } else {
    document.cookie = `${REFRESH_TOKEN_COOKIE}=; ${parts.map((p) => (p.startsWith('max-age') ? 'max-age=0' : p)).join('; ')}`
  }
}

export function getRefreshTokenCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)refresh_token=([^;]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export function clearRefreshTokenCookie(): void {
  setRefreshTokenCookie(null, { maxAge: 0 })
}

/**
 * 读取 auth_token cookie 中的 accessToken。
 * 2026-07-25 修复 CSRF:刷新页面后 useAuthStore 内存 token 丢失但 auth_token cookie 仍在,
 * 旧实现只读内存导致 Authorization header 缺失,被 CSRF 插件当作"非 Bearer 请求"拦截。
 * 修复后由 setTokenProvider 兜底读取,保证 CSRF Bearer 豁免分支生效。
 */
export function getAuthCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}
