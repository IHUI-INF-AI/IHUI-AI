// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OAuth 回调失败后「返回登录」指向哪儿(2026-10-22 立)。
 *
 * 该链接原本是 /sso/login —— 那是子项目/桌面深链换 sso_code 的授权页,对一个第三方登录
 * 刚失败的普通用户说"去授权页"是同型错误(机主 2026-10-22 反馈"正常用户不应该用 sso")。
 * 正解是 /login:主站登录弹窗软路由。
 *
 * 失败态触发路径取自实现:provider=generic 且 URL 无 platform ⇒ buildApiPath 返回 null
 * ⇒ status='error' ⇒ 渲染失败卡片。next/link 的 mock 必须保留 href,否则锁不住落点。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  params: { value: new URLSearchParams('') },
  fetchApi: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push, replace: h.replace, prefetch: () => {} }),
  useSearchParams: () => h.params.value,
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: never }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@/lib/api', () => ({ fetchApi: h.fetchApi }))
vi.mock('@/lib/auth-domains', () => ({
  isAuthSubdomainHost: () => false,
  buildMainDomainUrl: (p: string) => `https://aizhs.top${p}`,
}))
vi.mock('@/components/login/WallboardChoiceDialog', () => ({
  requestWallboardChoice: vi.fn(),
}))
vi.mock('@/stores/auth', () => {
  const state = {
    token: null as string | null,
    user: null as unknown,
    setToken: vi.fn(),
    setUser: vi.fn(),
  }
  const store: any = (selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state
  store.getState = () => state
  return { useAuthStore: store }
})

import { OAuthCallbackHandler } from '../app/(auth)/callback/OAuthCallbackHandler'

beforeEach(() => {
  h.push.mockReset()
  h.fetchApi.mockReset()
  // 无 platform 的 generic 回调 ⇒ 构造不出回调端点 ⇒ 失败态
  h.params.value = new URLSearchParams('code=abc&state=s')
})

afterEach(() => cleanup())

describe('OAuth 回调失败卡片', () => {
  it('「返回登录」指向普通登录入口 /login,而不是 SSO 授权页', () => {
    render(<OAuthCallbackHandler provider="generic" />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/login')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
