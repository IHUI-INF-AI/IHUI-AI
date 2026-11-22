// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { safeDecodeURIComponent } from '@ihui/shared/utils/safe-decode-uri'
import { SESSION_HINT_COOKIE_NAME } from '@ihui/shared/auth/auto-login-policy'

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
  return match?.[1] ? safeDecodeURIComponent(match[1]) : null
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
  return match?.[1] ? safeDecodeURIComponent(match[1]) : null
}

/**
 * 浏览器里是否**曾经**建立过一条 30 天会话(2026-10-27)。
 *
 * 读的是后端下发的非 httpOnly 提示 Cookie(`ihui_session_hint`,值恒 '1'):两条凭据
 * Cookie 都是 httpOnly,JS 永远看不见,而 localStorage 的会话标记会被一次被动失效清掉 ——
 * 两者都读不到时,冷启动闸门(hasUsableRefreshCredential)把「cookie 还在」的老用户
 * 判成匿名,连 /auth/refresh 都不发,表现就是"每次打开都要手点登录"。
 *
 * 与凭据同域同寿命、同批下发同批摘除,所以它只是"值得再试一次"的信号,不是登录态;
 * 值不含任何凭据,被第三方脚本读到也不泄露东西。
 */
export function getSessionHintCookie(): boolean {
  if (typeof document === 'undefined') return false
  return new RegExp(`(?:^|;\\s*)${SESSION_HINT_COOKIE_NAME}=1(?:;|$)`).test(document.cookie)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
