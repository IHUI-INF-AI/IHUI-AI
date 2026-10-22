// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /sso/login 话术分档契约(2026-10-22 立)。
 *
 * 背景:本页原本是"外部子项目/桌面深链跳来换 sso_code"的授权页,话术是授权口径
 * (「登录后将为 {clientId} 授权并跳转」「授权并跳转」「授权后将自动跳转回目标应用」)。
 * /login→/sso/login 的 308 摘掉前,普通用户也被那条重定向整页甩到本页,看到的就全是这套
 * 黑话 —— 机主原话"正常用户不应该用 sso"。
 *
 * 契约:clientId=web **且** URL 没有显式 redirect 参数 ⇒ 判定为"本站自己人",话术走 auth
 * 命名空间的普通登录文案;其余(带 redirect 的子项目回跳、非 web 的 desktop/mobile 客户端)
 * 一律保持授权口径不变。签发行为与落点判据一字未动(见 sso-login-admin-landing /
 * sso-login-return-target 两份既有契约)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const h = vi.hoisted(() => {
  const shell: { title?: string; subtitle?: string; footer?: string } = {}
  return {
    push: vi.fn(),
    replace: vi.fn(),
    params: { value: new URLSearchParams('') },
    shell,
    session: {
      value: { token: null as string | null, user: null as Record<string, unknown> | null },
    },
    ready: { value: true },
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push, replace: h.replace, prefetch: () => {} }),
  useSearchParams: () => h.params.value,
}))
// 带 ns 的翻译桩:断言文案来自哪个命名空间,而不是断言字面译文
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => `${ns ?? 'unknown'}:${key}`,
}))
vi.mock('@/stores/auth', () => {
  const store: any = (selector?: (s: any) => unknown) =>
    selector ? selector(h.session.value) : h.session.value
  store.getState = () => h.session.value
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
vi.mock('@/hooks/use-auth-bootstrap', () => ({
  useAuthBootstrap: () => ({ ready: h.ready.value }),
}))
vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async () => ({ success: true, data: { code: 'X' } })),
}))
vi.mock('@ihui/api-client', () => ({ refreshAccessTokenOnce: vi.fn(async () => null) }))
vi.mock('@ihui/shared', () => ({
  buildSsoRedirectUrl: (target: string, code: string) => `${target}?sso_code=${code}`,
  SSO_CLIENT_IDS: { DESKTOP: 'desktop', WEB: 'web' },
}))
vi.mock('@ihui/ui-react', () => ({
  Button: (props: any) => <button onClick={props.onClick}>{props.children}</button>,
}))
vi.mock('@/components/auth/AuthShell', () => ({
  AuthShell: (props: any) => {
    h.shell.title = props.title
    h.shell.subtitle = props.subtitle
    h.shell.footer = props.footer
    return <div>{props.children}</div>
  },
  AuthShellPage: ({ children }: any) => <div>{children}</div>,
}))
vi.mock('@/components/login/LoginFormContent', () => ({ LoginFormContent: () => null }))
vi.mock('@/components/login/RegisterFormContent', () => ({ RegisterFormContent: () => null }))
vi.mock('@/components/login/ForgotPasswordForm', () => ({ ForgotPasswordForm: () => null }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import SsoLoginPage from '../app/sso/login/PageClient'

const LOGGED_OUT = { token: null, user: null }
const LOGGED_IN = { token: 'jwt', user: { id: 'u1', roleId: 0 } }

beforeEach(() => {
  h.push.mockReset()
  h.replace.mockReset()
  h.params.value = new URLSearchParams('')
  h.session.value = LOGGED_OUT
  h.ready.value = true
  h.shell.title = undefined
  h.shell.subtitle = undefined
  h.shell.footer = undefined
})

afterEach(() => {
  cleanup()
})

describe('/sso/login 话术按"本站自己人 vs 授权场景"分档', () => {
  it('未登录 + client_id=web + 无 redirect ⇒ 标题副标题走普通登录文案,不给授权页脚', () => {
    h.params.value = new URLSearchParams('client_id=web')
    render(<SsoLoginPage />)
    expect(h.shell.title).toBe('auth:loginTitle')
    expect(h.shell.subtitle).toBe('auth:loginSubtitle')
    expect(h.shell.footer).toBeUndefined()
  })

  it('未登录 + 带显式 redirect(子项目回跳)⇒ 维持授权口径不变', () => {
    h.params.value = new URLSearchParams('client_id=web&redirect=%2Fchat%2Fhistory')
    render(<SsoLoginPage />)
    expect(h.shell.title).toBe('sso:title')
    expect(h.shell.footer).toBe('sso:footerHint')
  })

  it('未登录 + client_id=desktop ⇒ 维持授权口径不变', () => {
    h.params.value = new URLSearchParams('client_id=desktop&redirect=ihui%3A%2F%2Fsso')
    render(<SsoLoginPage />)
    expect(h.shell.title).toBe('sso:title')
  })

  it('已登录 + client_id=web + 无 redirect ⇒ 出口按钮说「继续进站」而不是「授权并跳转」', () => {
    h.session.value = LOGGED_IN
    h.params.value = new URLSearchParams('client_id=web')
    const { getByRole } = render(<SsoLoginPage />)
    expect(getByRole('button').textContent).toBe('auth:continueToSite')
    expect(h.shell.subtitle).toBe('auth:loggedInContinue')
  })

  it('已登录 + 带显式 redirect ⇒ 出口按钮仍是授权口径(子项目契约不动)', () => {
    h.session.value = LOGGED_IN
    h.params.value = new URLSearchParams('client_id=web&redirect=%2Fchat%2Fhistory')
    const { getByRole } = render(<SsoLoginPage />)
    expect(getByRole('button').textContent).toBe('sso:authorizeAndRedirect')
  })

  // 2026-10-22 生产实测补的一格:SSR 与 hydration 完成前走的是 !ready 骨架分支。
  // 线上 www.aizhs.top/sso/login 渲染出的是 <h1>统一登录</h1> + <p>登录后将为 web 授权并跳转</p>,
  // 因为骨架分支当时还写死 sso:title / sso.subtitle —— 用户第一眼看到的正是这一帧。
  it('bootstrap 未就绪的骨架分支也不许对本站自己人说授权话术', () => {
    h.ready.value = false
    h.params.value = new URLSearchParams('client_id=web')
    render(<SsoLoginPage />)
    expect(h.shell.title).toBe('auth:loginTitle')
    expect(h.shell.subtitle).toBe('auth:loginSubtitle')
  })

  it('骨架分支 + 带显式 redirect ⇒ 仍按授权口径(子项目第一眼就该知道是在授权)', () => {
    h.ready.value = false
    h.params.value = new URLSearchParams('client_id=web&redirect=%2Fchat%2Fhistory')
    render(<SsoLoginPage />)
    expect(h.shell.title).toBe('sso:title')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
