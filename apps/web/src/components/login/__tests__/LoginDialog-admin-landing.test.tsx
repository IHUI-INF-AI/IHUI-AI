// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 用户要求「监控大屏在用 admin 账号登录时第一时间切换到显示监控大屏」的组件级接线断言(2026-10-17 立)。
 *
 * 为什么钉在 `desktop-sso-success` 这条事件:LoginDialog 的登录成功落点只有一条实现
 * (`handleLoginSuccess`),表单登录成功与桌面深链换 token 成功都走它。这里用「派发事件」这条
 * 确定性入口真渲染组件、真跑那个回调,验的是**实际跳转目标**,而不是"助手函数被调用过":
 *   - 管理员 + 无显式目标 ⇒ 落到 `/admin/monitor/wallboard`;
 *   - 普通用户 + 无显式目标 ⇒ 不跳(维持留在当前页);
 *   - 带显式目标(登录守卫带回)⇒ 目标逐字不变,不被大屏落点旁路。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'

const pushMock = vi.hoisted(() => vi.fn())
const dialogState = vi.hoisted(() => ({
  isOpen: false,
  mode: 'login',
  redirectUrl: null as string | null,
  close: vi.fn(),
  setMode: vi.fn(),
}))
const authState = vi.hoisted(() => ({ user: null as { roleId?: number; role?: string } | null }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
}))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('lucide-react', () => ({ ExternalLink: () => null }))
vi.mock('@ihui/ui-react', () => ({
  Button: (props: Record<string, unknown>) => <button>{props.children as never}</button>,
  Dialog: ({ open, children }: { open?: boolean; children?: never }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children?: never }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: never }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: never }) => <div>{children}</div>,
}))
vi.mock('@/components/auth/AuthShell', () => ({
  AuthShell: ({ children }: { children?: never }) => <div>{children}</div>,
}))
vi.mock('@/lib/tauri-bridge', () => ({
  openEmbeddedBrowser: vi.fn(),
  openExternalUrl: vi.fn(async () => true),
}))
vi.mock('@/lib/sso-desktop-bridge', () => ({ rememberSsoEmbeddedWindow: vi.fn() }))
vi.mock('@ihui/shared', () => ({
  buildSsoLoginUrl: () => 'https://example.test/sso/login',
  SSO_CLIENT_IDS: { DESKTOP: 'desktop', WEB: 'web' },
  WEB_BASE: 'https://aizhs.top',
}))
vi.mock('@/hooks/use-desktop', () => ({ useDesktop: () => ({ isDesktop: false }) }))
vi.mock('@/hooks/use-media-query', () => ({ useIsMobile: () => false }))
vi.mock('../LoginFormContent', () => ({ LoginFormContent: () => null }))
vi.mock('../RegisterFormContent', () => ({ RegisterFormContent: () => null }))
vi.mock('../ForgotPasswordForm', () => ({ ForgotPasswordForm: () => null }))
vi.mock('../LoginWithTurnstile', () => ({
  LoginWithTurnstile: ({ children }: { children?: never }) => <div>{children}</div>,
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/stores/login-dialog', () => {
  const store: any = (selector?: (s: typeof dialogState) => unknown) =>
    selector ? selector(dialogState) : dialogState
  store.getState = () => dialogState
  store.setState = vi.fn()
  return { useLoginDialogStore: store }
})
vi.mock('@/stores/auth', () => {
  const store: any = (selector?: (s: typeof authState) => unknown) =>
    selector ? selector(authState) : authState
  store.getState = () => authState
  return { useAuthStore: store }
})

import { LoginDialog } from '../LoginDialog'

function fireLoginSuccess() {
  window.dispatchEvent(new Event('desktop-sso-success'))
}

beforeEach(() => {
  pushMock.mockReset()
  dialogState.isOpen = false
  dialogState.mode = 'login'
  dialogState.redirectUrl = null
  authState.user = null
})

afterEach(() => {
  cleanup()
})

describe('LoginDialog 登录成功落点', () => {
  it('管理员 + 无显式目标 → 落到监控大屏', async () => {
    render(<LoginDialog />)
    authState.user = { roleId: 1 }
    fireLoginSuccess()
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/admin/monitor/wallboard')
    })
  })

  it('普通用户 + 无显式目标 → 不跳转(维持留在当前页)', async () => {
    render(<LoginDialog />)
    authState.user = { roleId: 0 }
    fireLoginSuccess()
    await new Promise((r) => setTimeout(r, 400))
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('管理员 + 带显式目标 → 目标逐字不变,不被大屏落点旁路', async () => {
    render(<LoginDialog />)
    authState.user = { roleId: 1 }
    dialogState.redirectUrl = '/chat/history'
    fireLoginSuccess()
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/chat/history')
    })
    expect(pushMock).not.toHaveBeenCalledWith('/admin/monitor/wallboard')
  })

  it('身份缺失 + 无显式目标 → 不跳转', async () => {
    render(<LoginDialog />)
    authState.user = null
    fireLoginSuccess()
    await new Promise((r) => setTimeout(r, 400))
    expect(pushMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
