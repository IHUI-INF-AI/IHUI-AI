// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 连接器用户授权 state 分流锁(2026-11-24 立)。
 *
 * /callback 页同时服务「飞书扫码登录」与「连接器扫码授权自己账号」,两者靠 state
 * 形状互斥分流。本文件钉死:
 *   ① 连接器 state(base64url.payload + HMAC sig)只走 /api/callback/connectors/oauth,
 *      绝不进登录换 JWT 流程(notifyExtensionAuth 不能被调用);
 *   ② 登录 state(32 位 hex)仍走原登录链路 —— 反向变异保护,防分流吞掉登录。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'

const h = vi.hoisted(() => {
  const push = vi.fn()
  return {
    push,
    router: { push, replace: vi.fn(), prefetch: () => {} },
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

function connectorState(platform = 'feishu'): string {
  const payload = {
    p: platform,
    o: 'user-1',
    u: 'user-1',
    t: '',
    iat: Math.floor(Date.now() / 1000),
    n: 'abc123',
  }
  const raw = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${raw}.c2ln`
}

beforeEach(() => {
  h.push.mockReset()
  h.fetchApi.mockReset()
  h.notifyExtensionAuth.mockReset()
})

afterEach(() => cleanup())

describe('OAuth 回调 state 形状分流', () => {
  it('连接器 state → 只透传 code/state 到连接器回调代理,不进登录流程', async () => {
    const state = connectorState()
    h.params.value = new URLSearchParams(
      `code=auth-code&state=${encodeURIComponent(state)}&platform=feishu`,
    )
    h.fetchApi.mockResolvedValue({ success: true })

    render(<OAuthCallbackHandler provider="generic" />)

    await waitFor(() => expect(h.fetchApi).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(h.fetchApi).toHaveBeenCalledWith(
      `/api/callback/connectors/oauth?${new URLSearchParams({ code: 'auth-code', state }).toString()}`,
    )
    // 登录链路完全未被触发:否则会触发 consent 闸并丢弃 user_access_token
    expect(h.notifyExtensionAuth).not.toHaveBeenCalled()
    expect(h.fetchApi).not.toHaveBeenCalledWith('/api/auth/feishu/callback', expect.anything())
  })

  it('登录 state(32 位 hex)仍走原登录端点 —— 反向变异保护', async () => {
    const state = 'a'.repeat(32)
    h.params.value = new URLSearchParams(`code=auth-code&state=${state}&platform=feishu`)
    h.fetchApi.mockResolvedValue({
      success: true,
      data: { token: 'jwt', user: { id: 'u1', roleId: 0 } },
    })

    render(<OAuthCallbackHandler provider="generic" />)

    await waitFor(() => expect(h.notifyExtensionAuth).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(h.fetchApi).toHaveBeenCalledWith(
      '/api/auth/feishu/callback',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('畸形连接器 state(缺 u / iat 非数字)不误判,回落登录流程', async () => {
    const malformedPayload = btoa(JSON.stringify({ p: 'feishu', o: 'user-1', iat: 'x' })).replace(
      /=+$/,
      '',
    )
    h.params.value = new URLSearchParams(
      `code=auth-code&state=${encodeURIComponent(malformedPayload + '.c2ln')}&platform=feishu`,
    )
    h.fetchApi.mockResolvedValue({
      success: true,
      data: { token: 'jwt', user: { id: 'u1', roleId: 0 } },
    })

    render(<OAuthCallbackHandler provider="generic" />)

    await waitFor(() => expect(h.notifyExtensionAuth).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(h.fetchApi).not.toHaveBeenCalledWith('/api/callback/connectors/oauth', expect.anything())
  })
})
