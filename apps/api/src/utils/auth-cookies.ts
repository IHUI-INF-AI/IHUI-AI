// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Auth Cookie 统一管理（P2-18 修复，2026-08-06）。
 *
 * 背景：auth_token / refresh_token 原由前端 JS 用 document.cookie 写入（非 httpOnly），
 * XSS 可窃取 refresh token 实现持久接管。现改为服务端 Set-Cookie httpOnly：
 * - 前端登录/刷新响应体仍返回 token（存内存发 Bearer），cookie 作为自动携带通道
 *   （SSR/middleware 读取、CSRF 豁免判定、页面刷新后的 cookie 鉴权兜底）。
 * - httpOnly cookie JS 读不到，刷新/恢复链路改走「cookie 自动附带 + 后端从 cookie 读」。
 * - 登出由后端 Set-Cookie Max-Age=0 清除（前端 JS 清不掉 httpOnly）。
 *
 * 兼容性：登录响应体 token 字段不变（前端 setToken 逻辑无感），
 * 仅 cookie 的写入方从「前端 JS」变为「后端 Set-Cookie」。
 */
import type { FastifyReply } from 'fastify'
import { SESSION_HINT_COOKIE_NAME } from '@ihui/shared/auth/auto-login-policy'

const AUTH_TOKEN_COOKIE = 'auth_token'
const REFRESH_TOKEN_COOKIE = 'refresh_token'
/** 自动登录（remember）时 cookie 有效期：30 天（与后端 refresh TTL 对齐） */
const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60
/** 不记住时 session cookie（浏览器关闭失效） */

export interface AuthCookiesPayload {
  accessToken: string
  refreshToken: string
}

function isSecure(request: FastifyReply['request']): boolean {
  return request.protocol === 'https'
}

/**
 * Cookie 域(可选):生产配置 COOKIE_DOMAIN=.aizhs.top 后 auth cookie 在所有子域共享,
 * 使 OIDC 回跳(api.aizhs.top 域设置的 httpOnly cookie)能被前端同源反代
 * (bsm.aizhs.top/api)的请求自动携带 → bootstrap 静默刷新恢复登录态。
 *
 * ⚠️ 这一档不是「本地 dev 就不配」:本机同一个 api 进程同时服务公网与 127.0.0.1:8801,
 * 清掉它会把公网的跨子域共享登录一起打断。所以「当前请求该不该带 Domain」由
 * 下面的 {@link resolveCookieDomain} 逐请求判 host,而不是由部署侧二选一。
 */
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined

/**
 * 剥掉 Host 头的端口段,得到可比对的 hostname。
 *
 * IPv6 必须单独绕:字面量 `[::1]:8801` 里冒号不是端口分隔符,按最后一个冒号切会把地址劈碎;
 * 裸 `::1`(无方括号、多于一个冒号)同理原样返回——切端口切出来的是空串,空串会被
 * 下游 resolveCookieDomain 当成「判不出」而维持配置域,那等于让这条链形同未修。
 */
function hostnameOf(rawHost: string | undefined): string {
  const raw = rawHost?.trim().toLowerCase()
  if (!raw) return ''
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']')
    return end === -1 ? raw : raw.slice(0, end + 1)
  }
  const first = raw.indexOf(':')
  if (first === -1) return raw
  return raw.indexOf(':', first + 1) === -1 ? raw.slice(0, first) : raw
}

/**
 * 只有当请求 host 确实落在 COOKIE_DOMAIN 之内,才发共享域 Cookie;否则退回 host-only。
 *
 * 立因(2026-10-20 本机实锤):此前 `Domain=` 是无条件挂上的,而浏览器按 RFC 6265 §5.2.3
 * 拒收「Domain 不是请求 host 所属域」的 Cookie。于是用 `127.0.0.1:8801`(或任何局域网 IP)
 * 打开本机站点时,auth_token / refresh_token 两条 httpOnly Cookie **从未落地过** ——
 * 内存里的 Bearer 一切正常(界面显示已登录),但只认 Cookie 的 /admin/* 守卫恒 307,
 * SSO「授权并跳转」的守卫探测恒判被拦,刷新页面即掉线。取证:
 *   POST http://127.0.0.1:8801/api/auth/logout
 *   set-cookie: auth_token=; Max-Age=0; Domain=.aizhs.top; Path=/; HttpOnly; SameSite=Lax
 *
 * 方向纪律:降级只在**正向认出 host 不属于该域**时发生。host 取不到 ⇒ 维持配置值,
 * 与改动前逐字相同 —— 不能拿一个畸形输入把生产悄悄降级成 host-only,那会打断
 * api.aizhs.top ↔ bsm.aizhs.top 的共享登录(正是本配置存在的唯一理由)。
 */
export function resolveCookieDomain(rawHost: string | undefined): string | undefined {
  if (!COOKIE_DOMAIN) return undefined
  const host = hostnameOf(rawHost)
  if (!host) return COOKIE_DOMAIN
  const domain = COOKIE_DOMAIN.trim().replace(/^\./, '').toLowerCase()
  if (!domain) return COOKIE_DOMAIN
  return host === domain || host.endsWith(`.${domain}`) ? COOKIE_DOMAIN : undefined
}

/**
 * 取「访客实际面对的 host」。必须走 Fastify 的 request.hostname(代理感知出口)而不是裸读
 * headers.host:X-Forwarded-Host 只在远端地址命中 TRUSTED_PROXIES 时才被采信,与 IP 限流
 * 同一份信任判据(server.ts trustProxy)。裸读 headers.host 会把公网请求判成反代的
 * 127.0.0.1:8802 ⇒ 域内访客被降级成 host-only,api.aizhs.top 设置的共享登录 Cookie
 * 在 bsm.aizhs.top 上就读不到(2026-10-20 公网臂实测踩到);裸读 x-forwarded-host
 * 则等于无条件信任可伪造头。两头都不能图省事。
 */
function requestRawHost(request: FastifyReply['request']): string | undefined {
  return request.hostname || request.headers.host
}

function buildCookie(
  name: string,
  value: string,
  maxAge: number | undefined,
  secure: boolean,
  domain: string | undefined,
  httpOnly = true,
): { name: string; value: string; options: Record<string, unknown> } {
  const options: Record<string, unknown> = {
    path: '/',
    sameSite: 'lax',
    httpOnly,
  }
  if (secure) options.secure = true
  if (domain) options.domain = domain
  if (maxAge !== undefined && maxAge >= 0) options.maxAge = maxAge
  return { name, value, options }
}

/**
 * 登录/刷新成功后设置 httpOnly auth cookie。
 * @param remember 是否"记住登录"（true → cookie 30 天；false → session cookie 关闭浏览器失效）
 */
export function setAuthCookies(
  reply: FastifyReply,
  payload: AuthCookiesPayload,
  remember = true,
): void {
  const secure = isSecure(reply.request)
  const domain = resolveCookieDomain(requestRawHost(reply.request))
  const maxAge = remember ? REMEMBER_MAX_AGE : undefined
  // auth_token 跟随 refresh 周期（30d / session）：access JWT 本身 15min 过期，
  // cookie 只是会话标识，真正有效性由 JWT + 刷新链路保证（与前端原 30d 策略一致）。
  const cookies = [
    buildCookie(AUTH_TOKEN_COOKIE, payload.accessToken, maxAge, secure, domain),
    buildCookie(REFRESH_TOKEN_COOKIE, payload.refreshToken, REMEMBER_MAX_AGE, secure, domain),
    // 会话提示 Cookie(2026-10-27):两条凭据都是 httpOnly、JS 读不到,而 localStorage 的
    // ihui-session-established 会被一次被动失效清掉 —— 都看不见时前端冷启动闸门把「cookie
    // 还在」的老用户判成匿名,连 /auth/refresh 都不发。值恒 '1'、不含凭据、必须非 httpOnly;
    // 寿命取 refresh 的 30d(能不能静默续期只取决于 refresh cookie),不是 auth_token 那档。
    buildCookie(SESSION_HINT_COOKIE_NAME, '1', REMEMBER_MAX_AGE, secure, domain, false),
  ]
  // 使用 reply.setCookie() 设置多个 cookie，避免 reply.header('Set-Cookie', ...)
  // 覆盖同名 header（Fastify 的 reply.header 对同名 header 会覆盖而非追加）。
  for (const cookie of cookies) {
    reply.setCookie(cookie.name, cookie.value, cookie.options)
  }
}

/** 登出：清除 httpOnly auth cookie（前端 JS 无法清除，必须服务端下发）。 */
export function clearAuthCookies(reply: FastifyReply): void {
  const secure = isSecure(reply.request)
  // 摘除必须与下发共用同一个域判据:host-only Cookie 摘不掉带 Domain 的,反之亦然。
  const domain = resolveCookieDomain(requestRawHost(reply.request))
  const clearOptions = (httpOnly: boolean): Record<string, unknown> => ({
    path: '/',
    sameSite: 'lax',
    httpOnly,
    secure,
    ...(domain ? { domain } : {}),
    maxAge: 0,
  })
  // 使用 reply.setCookie() 清除 cookie，避免 reply.header('Set-Cookie', ...) 覆盖
  reply.setCookie(AUTH_TOKEN_COOKIE, '', clearOptions(true))
  reply.setCookie(REFRESH_TOKEN_COOKIE, '', clearOptions(true))
  // 提示 Cookie 必须同批摘:留着它,前端下一次冷启动会对着没有凭据的浏览器发一次
  // /auth/refresh(400 噪声 + 把已登出的浏览器判成"还能救")。
  reply.setCookie(SESSION_HINT_COOKIE_NAME, '', clearOptions(false))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
