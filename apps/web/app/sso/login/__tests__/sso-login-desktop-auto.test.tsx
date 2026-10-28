// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端"在浏览器中登录"的自动签发(2026-10-13 立,用户要求"已登录直接获取,不需要手点")。
 *
 * 判据四条:
 *   ① client_id=desktop **且** redirect 是自定义协议(ihui://) **且** 已登录 ⇒ 无需点击,
 *      自动调 /api/auth/sso/code 并 `location.href` 回跳 deep-link;
 *   ② 只触发一次:exchanging 状态翻转会引发重渲染、generateCodeAndRedirect 每渲染换引用,
 *      effect 重跑不得把签发打成两发;
 *   ③ 反例(站内 redirect / client_id=web)⇒ 不自动 —— 那是子项目跳来的授权页,
 *      直接甩走会砍断它的回跳契约(授权按钮仍在,原样手点);
 *   ④ 反例(sso=oidc)⇒ 不走签发这条闸 —— OIDC 有它自己的自动回跳。
 *
 * 与 sso-login-return-target.test.tsx(判据侧)互补:那份断言"跳去哪才安全",
 * 这份断言"什么时候**自动**跳、什么时候必须等用户"。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'

const pushMock = vi.hoisted(() => vi.fn())
const queryRef = vi.hoisted(() => ({ current: '' }))
const locationHrefRef = vi.hoisted(() => ({ writes: [] as string[] }))
const fetchApiMock = vi.hoisted(() => vi.fn(async () => ({ success: true, data: { code: 'SSOCODE' } })))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(queryRef.current),
}))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

// 已登录态:本页"自动签发"的前置条件就是 token + user 都在位(bootstrap 已 ready)
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
vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))
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

/** 收集对 window.location.href 的赋值(deep-link 回跳走的是它,不是 router.push) */
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
  fetchApiMock.mockClear()
  queryRef.current = ''
  locationHrefRef.writes.length = 0
  restoreLocation = captureLocationHref()
})

afterEach(() => {
  cleanup()
  restoreLocation?.()
  restoreLocation = null
})

const desktopDeepLinkQuery = `redirect=${encodeURIComponent('ihui://sso')}&client_id=desktop`

describe('/sso/login 桌面深链"已登录自动签发"', () => {
  it('① 已登录 + client_id=desktop + ihui:// 回跳:无需点击即签发并回跳 deep-link', async () => {
    queryRef.current = desktopDeepLinkQuery
    render(<SsoLoginPage />)

    await waitFor(() => {
      expect(locationHrefRef.writes).toEqual(['ihui://sso?sso_code=SSOCODE'])
    })
    expect(fetchApiMock).toHaveBeenCalledTimes(1)
    // 签发请求带着正确的 clientId 与深链落点(落点过的是与手动授权同一把判据)
    const [, options] = fetchApiMock.mock.calls[0] as unknown as [string, { body: string }]
    expect(JSON.parse(options.body)).toEqual({
      clientId: 'desktop',
      redirectUri: 'ihui://sso',
    })
  })

  it('② effect 重跑只签发一发(exchanging 翻转引发的重渲染不得重复签发)', async () => {
    queryRef.current = desktopDeepLinkQuery
    render(<SsoLoginPage />)

    await waitFor(() => {
      expect(locationHrefRef.writes.length).toBeGreaterThanOrEqual(1)
    })
    // 留两拍给 effect 在 exchanging true/false 与 generateCodeAndRedirect 换引用下重跑
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(fetchApiMock).toHaveBeenCalledTimes(1)
  })

  it('③ 反例:站内 redirect(子项目授权页)不自动甩走,授权按钮仍在', async () => {
    queryRef.current = `redirect=${encodeURIComponent('/admin/users')}&client_id=web`
    render(<SsoLoginPage />)

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(fetchApiMock).not.toHaveBeenCalled()
    expect(locationHrefRef.writes).toEqual([])
    expect(pushMock).not.toHaveBeenCalled()
    // 已登录分支渲染的是授权卡片(按钮可手动触发)
    expect(document.querySelector('button')).toBeTruthy()
  })

  it('④ 反例:sso=oidc 走 OIDC 自己的自动回跳,不进签发闸', async () => {
    queryRef.current = `sso=oidc&redirect=${encodeURIComponent('ihui://sso/callback')}`
    render(<SsoLoginPage />)

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('ihui://sso/callback')
    })
    expect(fetchApiMock).not.toHaveBeenCalled()
    expect(locationHrefRef.writes).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
