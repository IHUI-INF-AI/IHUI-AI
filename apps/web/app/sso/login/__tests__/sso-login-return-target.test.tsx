// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 A3/G-413 —— /sso/login 回跳落点的端到端断言(2026-09-28 立)。
 *
 * 为什么钉在 OIDC 那一跳:企业 SSO 完成后后端 302 回本页带 `sso=oidc`,bootstrap 恢复登录态后
 * 页面**自动**跳转 `redirect` —— 这一跳此前不经过任何判据(既不走 `ensureSsoRedirectAllowed` 的
 * 守卫探测,也不走导航安全判据),而它恰好发生在"会话刚落地"的那一刻。
 *
 * 断言落的是**实际跳转目标**(不是"守卫被调用过"):
 *  - 不安全形态 ⇒ 目标被改写为站内 `/`,外部/自执行的字符串一次都没出现在 push 参数里;
 *  - 正向对照 ⇒ 站内相对路径、白名单外的外站 http(s)(WebView/子项目回跳的设计意图)、
 *    `ihui://` 深链(AGENTS §9 的 SSO 契约)三条都逐字不变。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'

const pushMock = vi.hoisted(() => vi.fn())
const replaceMock = vi.hoisted(() => vi.fn())
const queryRef = vi.hoisted(() => ({ current: '' }))
const locationHrefRef = vi.hoisted(() => ({ writes: [] as string[] }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(queryRef.current),
}))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

// 登录态:OIDC 自动回跳的前置条件是 token + user 都在位(bootstrap 已 ready)
vi.mock('@/stores/auth', () => {
  const state = { token: 'jwt-access', user: { id: 'u1' } }
  const useAuthStore: any = () => state
  useAuthStore.getState = () => state
  return { useAuthStore }
})
vi.mock('@/stores/login-dialog', () => {
  const state = { isOpen: false, mode: 'login', redirectUrl: null, setMode: vi.fn() }
  const useLoginDialogStore: any = (selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state
  useLoginDialogStore.getState = () => ({ ...state, setMode: vi.fn() })
  useLoginDialogStore.setState = vi.fn()
  return { useLoginDialogStore }
})
vi.mock('@/hooks/use-auth-bootstrap', () => ({ useAuthBootstrap: () => ({ ready: true }) }))
vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async () => ({ success: true, data: { code: 'SSOCODE' } })),
}))
vi.mock('@ihui/api-client', () => ({ refreshAccessTokenOnce: vi.fn(async () => null) }))
vi.mock('@ihui/shared', () => ({
  buildSsoRedirectUrl: (target: string, code: string) =>
    `${target}${target.includes('?') ? '&' : '?'}sso_code=${code}`,
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

/** 收集对 window.location.href 的赋值(deep-link 那一支走的是它,不是 router.push) */
function captureLocationHref() {
  const original = window.location
  const writes: string[] = locationHrefRef.writes
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new Proxy(original, {
      set(_target, prop, value) {
        if (prop === 'href') writes.push(String(value))
        return true
      },
      get(target, prop) {
        const raw = Reflect.get(target, prop)
        return typeof raw === 'function' ? raw.bind(target) : raw
      },
    }),
  })
  return () => Object.defineProperty(window, 'location', { configurable: true, value: original })
}

let restoreLocation: (() => void) | null = null

beforeEach(() => {
  pushMock.mockReset()
  replaceMock.mockReset()
  queryRef.current = ''
  locationHrefRef.writes.length = 0
})

afterEach(() => {
  cleanup()
  restoreLocation?.()
  restoreLocation = null
})

function pushedTargets(): string[] {
  return [...pushMock.mock.calls, ...replaceMock.mock.calls].flat().map(String)
}

describe('/sso/login 的 redirect 落点(OIDC 自动回跳)', () => {
  it.each([
    ['自执行协议', 'javascript:alert(document.cookie)'],
    ['协议相对', '//evil.example.com/cb'],
    ['反斜杠伪装站内(浏览器按 //evil 解析)', '/\\evil.example.com/cb'],
  ])('%s:这一跳被改写为站内首页,不产出对外跳转', async (_label, evil) => {
    queryRef.current = `sso=oidc&redirect=${encodeURIComponent(evil)}`
    restoreLocation = captureLocationHref()
    render(<SsoLoginPage />)

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/')
    })
    const targets = [...pushedTargets(), ...locationHrefRef.writes]
    expect(targets.some((t) => t.includes('evil.example.com'))).toBe(false)
    expect(targets.some((t) => t.startsWith('javascript:'))).toBe(false)
  })

  it('正向对照:站内相对路径逐字不变', async () => {
    queryRef.current = 'sso=oidc&redirect=%2Fadmin%2Fusers'
    restoreLocation = captureLocationHref()
    render(<SsoLoginPage />)
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/admin/users')
    })
  })

  it('正向对照:外站 http(s) 与 ihui:// 深链仍是合法落点(不砍断子项目/App 回跳)', async () => {
    queryRef.current = 'sso=oidc&redirect=https%3A%2F%2Fedu.example.com%2Fdashboard'
    restoreLocation = captureLocationHref()
    render(<SsoLoginPage />)
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('https://edu.example.com/dashboard')
    })

    pushMock.mockClear()
    queryRef.current = 'sso=oidc&redirect=ihui%3A%2F%2Fsso%2Fcallback'
    render(<SsoLoginPage />)
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('ihui://sso/callback')
    })
  })

  it('正向对照:授权按钮那一跳同样只带过判据的目标(sso_code 不随畸形值外送)', async () => {
    // `/\evil.example.com/cb` —— 服务端 isSafeRedirectUri 认它"以 / 开头且不 // 开头"会照样签发
    // sso_code,而浏览器把它解析成 https://evil.example.com ⇒ 落点判据必须在这一跳之前收口
    queryRef.current = 'redirect=%2F%5Cevil.example.com%2Fcb&client_id=web'
    restoreLocation = captureLocationHref()
    // 守卫探测用的是同源 HEAD —— 这里桩掉,断言不依赖"探测恰好失败"
    vi.stubGlobal('fetch', vi.fn(async () => ({ type: 'basic', ok: true, status: 200 }) as unknown as Response))
    const { getByRole } = render(<SsoLoginPage />)
    getByRole('button').click()

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/?sso_code=SSOCODE')
    })
    const targets = [...pushedTargets(), ...locationHrefRef.writes]
    expect(targets.some((t) => t.includes('evil.example.com'))).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
