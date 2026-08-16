/**
 * Auth Cookie 管理。
 *
 * P2-18 修复(2026-08-06):auth_token / refresh_token 已改由后端 httpOnly Set-Cookie 管理,
 * 前端 JS 无法读取/覆盖 httpOnly cookie(document.cookie 对 httpOnly 返回空)。
 * 因此:
 * - setAuthCookie / setRefreshTokenCookie / clearRefreshTokenCookie 改为**空操作**,
 *   保留函数签名以兼容大量调用方;cookie 生命周期(写入/轮换/清除)全部由后端掌控。
 * - getAuthCookie / getRefreshTokenCookie 保留(读 httpOnly 会返回 null,
 *   作为旧版本降级通道——兼容后端仍下发非 httpOnly cookie 的部署;新部署恒返回 null)。
 */

const REFRESH_TOKEN_COOKIE = 'refresh_token'
const AUTH_TOKEN_COOKIE = 'auth_token'
/** 自动登录时 refreshToken cookie 有效期:30 天(与后端 refresh TTL 对齐;现由后端管理) */
export const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60

export function getAuthCookieDomain(): string | undefined {
  // P2-18 修复(2026-08-06):cookie 由后端 Set-Cookie 管理,前端不再需要计算 domain。
  // 保留导出以兼容旧调用方;恒返回 undefined(无 domain 后缀)。
  return undefined
}

interface CookieOpts {
  /** max-age 秒;不传(默认 -1)表示 session cookie(浏览器关闭即失效) */
  maxAge?: number
}

export function setAuthCookie(_token: string | null, _opts?: CookieOpts): void {
  // P2-18 修复(2026-08-06):auth_token 现由后端 httpOnly Set-Cookie 管理,
  // 前端再写同名非 httpOnly cookie 会与 httpOnly cookie 冲突且无法覆盖,故改为空操作。
  // 保留签名(auth store setToken 等调用方不受影响)。
}

export function setRefreshTokenCookie(_token: string | null, _opts?: CookieOpts): void {
  // P2-18 修复(2026-08-06):refresh_token 由后端 httpOnly Set-Cookie 管理,前端写入改为空操作(同上)。
}

export function getRefreshTokenCookie(): string | null {
  // P2-18 修复(2026-08-06):httpOnly cookie JS 读不到,新部署恒返回 null。
  // 保留实现作为旧版本降级通道(后端仍下发非 httpOnly refresh_token 时可读)。
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${REFRESH_TOKEN_COOKIE}=([^;]+)`))
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export function clearRefreshTokenCookie(): void {
  // P2-18 修复(2026-08-06):cookie 由后端管理,登出时后端 logout 响应已清 cookie,
  // 前端无法清除 httpOnly cookie,故此处为空操作。
}

/**
 * 读取 auth_token cookie 中的 accessToken。
 * P2-18 修复(2026-08-06):httpOnly cookie JS 读不到,新部署恒返回 null。
 * 保留实现作为旧版本降级通道(后端仍下发非 httpOnly auth_token 时可读)。
 */
export function getAuthCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${AUTH_TOKEN_COOKIE}=([^;]+)`))
  return match?.[1] ? decodeURIComponent(match[1]) : null
}
