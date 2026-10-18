// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OAuth 第三方登录回调落点的组件级接线断言(2026-10-17 立;2026-10-18 按用户要求
 * "弹窗让我自己选择"改为:主域 admin 不再自动跳大屏,改经 requestWallboardChoice 弹窗)。
 *
 * 覆盖主站登录弹窗里 8 个第三方按钮(微信/钉钉/飞书/企微/GitHub/支付宝/Google/Apple)
 * 完成后统一回到 /callback(OAuthCallbackHandler)的场景。本测试真渲染该组件、真跑回调,
 * 断言**实际行为**:
 *   - admin(roleId ≥ 1)⇒ 弹「要不要看数据大屏」选择窗(不自动跳);
 *   - 普通用户 / 身份缺失 ⇒ 维持原有根路径 `/`;
 *   - 认证子域 ⇒ 保持整页跳回主域(admin 语义不变,跨域导航弹窗机制不适用)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'

const h = vi.hoisted(() => {
  const push = vi.fn()
  const replace = vi.fn()
  const requestChoice = vi.fn()
  return {
    push,
    requestChoice,
    router: { push, replace, prefetch: () => {} },
    fetchApi: vi.fn(),
    params: { value: new URLSearchParams('') },
    subdomain: false,
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => h.router,
  useSearchParams: () => h.params.value,
}))
vi.mock('@/components/login/WallboardChoiceDialog', () => ({
  requestWallboardChoice: h.requestChoice,
}))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/link', () => ({
  default: ({ children }: { children?: never }) => <span>{children}</span>,
}))
vi.mock('@/lib/api', () => ({ fetchApi: h.fetchApi }))
vi.mock('@/lib/auth-domains', () => ({
  isAuthSubdomainHost: () => h.subdomain,
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
  h.requestChoice.mockReset()
  h.fetchApi.mockReset()
  h.params.value = new URLSearchParams('code=abc&state=s&platform=wechat')
  h.subdomain = false
})

afterEach(() => cleanup())

function respondWith(user: unknown) {
  h.fetchApi.mockResolvedValue({ success: true, data: { token: 'a', refreshToken: 'r', user } })
}

describe('OAuth 回调落点(第三方登录)', () => {
  it('admin(roleId ≥ 1)→ 弹「要不要看数据大屏」选择窗,不自动跳', async () => {
    respondWith({ id: 'u1', roleId: 1 })
    render(<OAuthCallbackHandler provider="generic" />)
    await waitFor(
      () =>
        expect(h.requestChoice).toHaveBeenCalledWith('/admin/monitor/wallboard', {
          stayFallback: '/',
        }),
      { timeout: 3000 },
    )
    expect(h.push).not.toHaveBeenCalled()
  })

  it('普通用户 → 仍走原有根路径(不误弹大屏选择窗)', async () => {
    respondWith({ id: 'u1', roleId: 0 })
    render(<OAuthCallbackHandler provider="generic" />)
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/'), { timeout: 3000 })
    expect(h.requestChoice).not.toHaveBeenCalled()
    expect(h.push).not.toHaveBeenCalledWith('/admin/monitor/wallboard')
  })

  it('身份缺失 → 仍走原有根路径(不误判为 admin)', async () => {
    respondWith(null)
    render(<OAuthCallbackHandler provider="generic" />)
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/'), { timeout: 3000 })
    expect(h.requestChoice).not.toHaveBeenCalled()
    expect(h.push).not.toHaveBeenCalledWith('/admin/monitor/wallboard')
  })

  it('认证子域 → 保持整页跳回主域原语义(admin 不弹窗,跨域导航)', async () => {
    h.subdomain = true
    respondWith({ id: 'u1', roleId: 1 })
    render(<OAuthCallbackHandler provider="generic" />)
    await waitFor(
      () => {
        // 整页导航用 window.location.href(测试环境无法断言赋值),但弹窗链路必然未触发
        expect(h.requestChoice).not.toHaveBeenCalled()
        expect(h.push).not.toHaveBeenCalled()
      },
      { timeout: 3000 },
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
