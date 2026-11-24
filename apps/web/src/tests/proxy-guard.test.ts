// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 受保护页守卫:access(15min)过期 ≠ 会话结束(2026-10-26 立)。
 *
 * 病灶:proxy.ts 只验 `auth_token`(access JWT),过期就 307 到 /sso/login;该页只有
 * 企业 SSO 回跳才自动返回,普通打回停在授权卡片 ⇒ 用户感知「后台待一会儿就要重新登录」。
 * 修法:`refresh_token`(30d)仍在时放行到页面,交客户端 bootstrap / 401 拦截器静默刷新
 * 并续种 auth_token;无 refresh 的匿名访问照旧 307。
 *
 * 这里锁的是守卫的**分叉本身**,不是下游页面行为:
 *  - access 有效 ⇒ 放行;
 *  - access 过期 + refresh 在 ⇒ 放行(本轮修复的核心,摘掉即翻红);
 *  - access 过期 + 无 refresh ⇒ 307(守卫不能被放宽成"任何请求都进");
 *  - 非受保护路径 ⇒ 放行(射程不得扩大)。
 */
import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyAccessTokenEdge = vi.hoisted(() => vi.fn<(token: string) => Promise<unknown>>())

vi.mock('@/lib/auth-utils', () => ({ verifyAccessTokenEdge }))

import { proxy } from '../../proxy'

/**
 * proxy 只读三样:cookie、host 头、nextUrl(pathname/search/clone)。
 * 这里用最小桩而不是真 NextRequest:jsdom 环境下 NextRequest.cookies 对测试构造的
 * header 容器解析不稳(实测 get 恒 undefined),会把"判据没跑"伪装成"守卫拒绝"。
 */
function request(path: string, cookies: Record<string, string> = {}): NextRequest {
  const url = new URL(`https://aizhs.top${path}`)
  return {
    headers: new Headers({ host: 'aizhs.top' }),
    nextUrl: Object.assign(url, { clone: () => new URL(url.href) }),
    cookies: {
      get: (name: string) => (cookies[name] !== undefined ? { value: cookies[name] } : undefined),
    },
  } as unknown as NextRequest
}

/** NextResponse.next() 带 x-middleware-next;307 才是重定向。 */
function isRedirect(res: Response): boolean {
  return res.status >= 300 && res.status < 400
}

beforeEach(() => {
  verifyAccessTokenEdge.mockReset()
  verifyAccessTokenEdge.mockImplementation(async (token: string) =>
    token === 'valid-access' ? { sub: 'u1' } : null,
  )
})

describe('proxy 守卫:access 过期但 refresh 在场 ⇒ 放行(会话可恢复)', () => {
  it('access 有效 ⇒ 放行', async () => {
    const req = request('/admin/users', { auth_token: 'valid-access' })
    expect(req.cookies.get('auth_token')?.value).toBe('valid-access')
    const res = await proxy(req)
    expect(isRedirect(res)).toBe(false)
    expect(verifyAccessTokenEdge).toHaveBeenCalledWith('valid-access')
  })

  it('access 过期(验签失败)⇒ 不再 307,放行给客户端续期', async () => {
    const res = await proxy(request('/admin/users', { auth_token: 'expired', refresh_token: 'rt' }))
    expect(isRedirect(res)).toBe(false)
  })

  it('access 过期且无 refresh ⇒ 仍然 307 到 /sso/login(守卫没被放宽)', async () => {
    const res = await proxy(request('/admin/users', { auth_token: 'expired' }))
    expect(isRedirect(res)).toBe(true)
    expect(res.headers.get('location')).toContain('/sso/login')
    expect(res.headers.get('location')).toContain(encodeURIComponent('/admin/users'))
  })

  it('无任何 cookie ⇒ 307(匿名访问照旧被拦)', async () => {
    const res = await proxy(request('/admin/users'))
    expect(isRedirect(res)).toBe(true)
    expect(res.headers.get('location')).toContain('/sso/login')
  })

  it('非受保护路径即使无 cookie 也放行(射程不扩大)', async () => {
    const res = await proxy(request('/agents'))
    expect(isRedirect(res)).toBe(false)
    expect(verifyAccessTokenEdge).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
