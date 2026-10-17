// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OAuth 第三方登录回调落点的组件级接线断言(2026-10-17 立)。
 *
 * 覆盖用户要求「监控大屏在用 admin 账号登录时第一时间切换」的**最高影响缺口**:主站登录弹窗里
 * 8 个第三方按钮(微信/钉钉/飞书/企微/GitHub/支付宝/Google/Apple)完成后统一回到
 * /callback(OAuthCallbackHandler),此前一律 `router.push('/')`。本测试真渲染该组件、真跑回调,
 * 断言**实际跳转目标**:
 *   - admin(roleId ≥ 1)⇒ /admin/monitor/wallboard;
 *   - 普通用户 / 身份缺失 ⇒ 维持原有根路径 `/`。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'

const h = vi.hoisted(() => {
  const push = vi.fn()
  const replace = vi.fn()
  return {
    push,
    router: { push, replace, prefetch: () => {} },
    fetchApi: vi.fn(),
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
vi.mock('@/lib/auth-domains', () => ({
  isAuthSubdomainHost: () => false,
  buildMainDomainUrl: (p: string) => `https://aizhs.top${p}`,
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
  h.params.value = new URLSearchParams('code=abc&state=s&platform=wechat')
})

afterEach(() => cleanup())

function respondWith(user: unknown) {
  h.fetchApi.mockResolvedValue({ success: true, data: { token: 'a', refreshToken: 'r', user } })
}

describe('OAuth 回调落点(第三方登录)', () => {
  it('admin(roleId ≥ 1)→ 落到监控大屏', async () => {
    respondWith({ id: 'u1', roleId: 1 })
    render(<OAuthCallbackHandler provider="generic" />)
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/monitor/wallboard'), {
      timeout: 3000,
    })
  })

  it('普通用户 → 仍走原有根路径(不误跳大屏)', async () => {
    respondWith({ id: 'u1', roleId: 0 })
    render(<OAuthCallbackHandler provider="generic" />)
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/'), { timeout: 3000 })
    expect(h.push).not.toHaveBeenCalledWith('/admin/monitor/wallboard')
  })

  it('身份缺失 → 仍走原有根路径(不误判为 admin)', async () => {
    respondWith(null)
    render(<OAuthCallbackHandler provider="generic" />)
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/'), { timeout: 3000 })
    expect(h.push).not.toHaveBeenCalledWith('/admin/monitor/wallboard')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
