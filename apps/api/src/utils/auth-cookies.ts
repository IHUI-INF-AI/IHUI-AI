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

function buildCookie(
  name: string,
  value: string,
  maxAge: number | undefined,
  secure: boolean,
): { name: string; value: string; options: Record<string, unknown> } {
  const options: Record<string, unknown> = {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
  }
  if (secure) options.secure = true
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
  const maxAge = remember ? REMEMBER_MAX_AGE : undefined
  // auth_token 跟随 refresh 周期（30d / session）：access JWT 本身 15min 过期，
  // cookie 只是会话标识，真正有效性由 JWT + 刷新链路保证（与前端原 30d 策略一致）。
  const cookies = [
    buildCookie(AUTH_TOKEN_COOKIE, payload.accessToken, maxAge, secure),
    buildCookie(REFRESH_TOKEN_COOKIE, payload.refreshToken, REMEMBER_MAX_AGE, secure),
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
  // 使用 reply.setCookie() 清除 cookie，避免 reply.header('Set-Cookie', ...) 覆盖
  reply.setCookie(AUTH_TOKEN_COOKIE, '', {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure,
    maxAge: 0,
  })
  reply.setCookie(REFRESH_TOKEN_COOKIE, '', {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure,
    maxAge: 0,
  })
}
