// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /sso/login 授权页对 admin 的默认落点断言(2026-10-17 立)。
 *
 * 该页是子项目/桌面深链跳来的授权页,核心契约是"把 sso_code 跳回 redirect"。本测试钉两条边界:
 *   - 无显式 redirect + admin ⇒ sso_code 跟着跳到监控大屏(而非首页);
 *   - 有显式 redirect ⇒ 目标逐字不变(子项目回跳契约不被大屏落点旁路);
 *   - 无显式 redirect + 普通用户 ⇒ 维持首页,不误跳大屏。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'

const h = vi.hoisted(() => {
  const push = vi.fn()
  const replace = vi.fn()
  return {
    push,
    replace,
    params: { value: new URLSearchParams('') },
    user: { value: { id: 'u1', roleId: 0 } as { id: string; roleId?: number } },
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push, replace: h.replace, prefetch: () => {} }),
  useSearchParams: () => h.params.value,
}))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/stores/auth', () => {
  const state = { token: 'jwt-access', user: h.user.value }
  const store: any = (selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state
  store.getState = () => ({ token: 'jwt-access', user: h.user.value })
  return { useAuthStore: store }
})
vi.mock('@/stores/login-dialog', () => {
  const state = { isOpen: false, mode: 'login', redirectUrl: null, setMode: vi.fn() }
  const store: any = (selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state
  store.getState = () => ({ ...state, setMode: vi.fn() })
  store.setState = vi.fn()
  return { useLoginDialogStore: store }
})
vi.mock('@/hooks/use-auth-bootstrap', () => ({ useAuthBootstrap: () => ({ ready: true }) }))
vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async () => ({ success: true, data: { code: 'SSOCODE' } })),
}))
vi.mock('@ihui/api-client', () => ({ refreshAccessTokenOnce: vi.fn(async () => null) }))
vi.mock('@ihui/shared', () => ({
  buildSsoRedirectUrl: (target: string, code: string) =>
    `${target}${target.includes('?') ? '&' : '?'}sso_code=${code}`,
  SSO_CLIENT_IDS: { DESKTOP: 'desktop', WEB: 'web' },
}))
vi.mock('@ihui/ui-react', () => ({
  Button: (props: any) => <button onClick={props.onClick}>{props.children}</button>,
}))
vi.mock('@/components/auth/AuthShell', () => ({
  AuthShell: ({ children }: any) => <div>{children}</div>,
  AuthShellPage: ({ children }: any) => <div>{children}</div>,
}))
vi.mock('@/components/login/LoginFormContent', () => ({ LoginFormContent: () => null }))
vi.mock('@/components/login/RegisterFormContent', () => ({ RegisterFormContent: () => null }))
vi.mock('@/components/login/ForgotPasswordForm', () => ({ ForgotPasswordForm: () => null }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import SsoLoginPage from '../PageClient'

beforeEach(() => {
  h.push.mockReset()
  h.replace.mockReset()
  h.params.value = new URLSearchParams('')
  h.user.value = { id: 'u1', roleId: 0 }
  // 守卫探测用同源 HEAD —— 桩掉,断言不依赖"探测恰好失败"
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ type: 'basic', ok: true, status: 200 }) as unknown as Response),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('/sso/login 对 admin 的默认落点', () => {
  it('无显式 redirect + admin ⇒ sso_code 跳向监控大屏', async () => {
    h.user.value = { id: 'u1', roleId: 1 }
    h.params.value = new URLSearchParams('client_id=web')
    const { getByRole } = render(<SsoLoginPage />)
    getByRole('button').click()
    await waitFor(() => {
      expect(h.push).toHaveBeenCalledWith('/admin/monitor/wallboard?sso_code=SSOCODE')
    })
  })

  it('有显式 redirect + admin ⇒ 目标逐字不变(子项目回跳契约优先)', async () => {
    h.user.value = { id: 'u1', roleId: 1 }
    h.params.value = new URLSearchParams('redirect=%2Fchat%2Fhistory&client_id=web')
    const { getByRole } = render(<SsoLoginPage />)
    getByRole('button').click()
    await waitFor(() => {
      expect(h.push).toHaveBeenCalledWith('/chat/history?sso_code=SSOCODE')
    })
    expect(h.push).not.toHaveBeenCalledWith('/admin/monitor/wallboard?sso_code=SSOCODE')
  })

  it('无显式 redirect + 普通用户 ⇒ 维持首页', async () => {
    h.user.value = { id: 'u1', roleId: 0 }
    h.params.value = new URLSearchParams('client_id=web')
    const { getByRole } = render(<SsoLoginPage />)
    getByRole('button').click()
    await waitFor(() => {
      expect(h.push).toHaveBeenCalledWith('/?sso_code=SSOCODE')
    })
    expect(h.push).not.toHaveBeenCalledWith('/admin/monitor/wallboard?sso_code=SSOCODE')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
