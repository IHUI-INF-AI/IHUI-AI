// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-66 接线断言(2026-11-11 立):/callback 落点(OAuthCallbackHandler)登录成功后
 * 必须调用扩展发送端 @/lib/ext-auth-relay,且把后端响应里的 token/refreshToken/expiresIn
 * 原样交给它。摘掉接线(或字段传错)即翻红;发送端自身的形状/降级由
 * src/lib/__tests__/ext-auth-relay.test.ts 钉,本文件不复算判据。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup, screen } from '@testing-library/react'

const h = vi.hoisted(() => {
  const push = vi.fn()
  const replace = vi.fn()
  return {
    push,
    router: { push, replace, prefetch: () => {} },
    fetchApi: vi.fn(),
    notifyExtensionAuth: vi.fn(),
    params: { value: new URLSearchParams('') },
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => h.router,
  useSearchParams: () => h.params.value,
}))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/link', () => ({
  default: ({ children }: { children?: never }) => <span>{children}</span>,
}))
vi.mock('@/lib/api', () => ({ fetchApi: h.fetchApi }))
vi.mock('@/lib/ext-auth-relay', () => ({ notifyExtensionAuth: h.notifyExtensionAuth }))
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

import { OAuthCallbackHandler } from '../OAuthCallbackHandler'

beforeEach(() => {
  h.push.mockReset()
  h.fetchApi.mockReset()
  h.notifyExtensionAuth.mockReset()
  h.params.value = new URLSearchParams('code=abc&state=s&platform=wechat')
})

afterEach(() => cleanup())

describe('OAuth 回调落点 → 扩展发送端接线(DBG-66)', () => {
  it('登录成功:token/refreshToken/expiresIn 交给 notifyExtensionAuth', async () => {
    h.fetchApi.mockResolvedValue({
      success: true,
      data: { token: 'a', refreshToken: 'r', expiresIn: 7200, user: { id: 'u1', roleId: 0 } },
    })
    render(<OAuthCallbackHandler provider="generic" />)
    await waitFor(() => expect(h.notifyExtensionAuth).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(h.notifyExtensionAuth).toHaveBeenCalledWith({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 7200,
    })
  })

  it('回调失败(不换出 token):不得向扩展发送', async () => {
    h.fetchApi.mockResolvedValue({ success: false, error: 'bad state' })
    render(<OAuthCallbackHandler provider="generic" />)
    // 等错误态渲染落地(即 .then 分支已走完),再断言发送端从未被调用
    await waitFor(() => expect(screen.getByText('failedTitle')).toBeTruthy(), { timeout: 3000 })
    expect(h.notifyExtensionAuth).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
