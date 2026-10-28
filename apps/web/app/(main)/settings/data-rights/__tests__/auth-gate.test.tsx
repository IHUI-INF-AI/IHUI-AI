// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 数据权利页(GDPR 导出/携带/擦除)· 登录态门三态测试(G-932 真缺陷格收口)
 *
 * 立因同 settings/notifications、privacy、agent-security:本页此前完全没接 useAuthGate,
 * 冷启动 bootstrap 还没收束时就把用户当游客——本页更糟的是三个入口(导出/携带/擦除)
 * 全在门上,游客态点一下就是注定 401 的请求,而「擦除」是破坏性动作。
 *
 * 本文件额外钉住一型「补门补出新缺陷」:handleErase 成功后调 logout(),
 * 于是 allow 由真翻假。若把 !allow 排在 erased 之前,擦除回执会被自己的登录引导顶掉
 * (用户擦完数据看到的是「请先登录」而不是「已擦除」)。三态顺序 = ready → erased → allow。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'

const authGate = vi.hoisted(() => ({ state: { ready: true, allow: true } }))
vi.mock('@/hooks/use-auth-gate', () => ({
  useAuthGate: () => authGate.state,
}))

const fetchApi = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api', () => ({
  fetchApi: fetchApi,
}))

const logout = vi.hoisted(() => vi.fn())
vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (s: { logout: typeof logout }) => unknown) => selector({ logout }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/common', () => ({
  AuthGatePrompt: ({ message }: { message: string }) => <div>{message}</div>,
  BackButton: () => <div />,
}))

vi.mock('@/components/feedback', () => ({
  Alert: ({ title, description }: { title?: string; description?: string }) => (
    <div>
      {title}
      {description}
    </div>
  ),
}))

vi.mock('@ihui/ui-react', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Label: ({ children, htmlFor }: { children?: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  // 真实 Radix Dialog 收起时不渲染任何内容;夹具必须同形,否则「门收起后入口不存在」
  // 这条断言会被夹具本身打穿。
  Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('lucide-react', () => ({
  Download: () => <svg />,
  Share2: () => <svg />,
  Trash2: () => <svg />,
  Loader2: () => <svg />,
  AlertTriangle: () => <svg />,
  FileJson: () => <svg />,
  CheckCircle2: () => <svg />,
  History: () => <svg />,
  ScrollText: () => <svg />,
  LogIn: () => <svg />,
}))

import DataRightsPage from '../page'

const EXPORT_OK = {
  success: true,
  data: {
    user: {
      id: 'u1',
      email: 'a@b.c',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    },
    searchHistory: [],
    auditLogs: [],
  },
}

describe('数据权利页 · 登录态门三态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authGate.state = { ready: true, allow: true }
    fetchApi.mockResolvedValue(EXPORT_OK)
  })

  afterEach(() => {
    cleanup()
    authGate.state = { ready: true, allow: true }
  })

  it('登录态确认中(ready=false)不误显「请先登录」,显加载态且三个入口都不存在', async () => {
    authGate.state = { ready: false, allow: false }
    render(<DataRightsPage />)

    await waitFor(() => expect(screen.queryByText('loginRequired')).toBeNull())
    expect(screen.getByText('loading')).toBeTruthy()
    expect(screen.queryByText('eraseBtn')).toBeNull()
    expect(screen.queryByText('portabilityBtn')).toBeNull()
    expect(screen.queryByText('exportBtn')).toBeNull()
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('确未登录(ready=true ∧ allow=false)显登录引导,破坏性入口随卡一并收起', () => {
    authGate.state = { ready: true, allow: false }
    render(<DataRightsPage />)

    expect(screen.getByText('loginRequired')).toBeTruthy()
    expect(screen.queryByText('eraseBtn')).toBeNull()
    expect(screen.queryByText('portabilityBtn')).toBeNull()
    expect(screen.queryByText('exportBtn')).toBeNull()
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('门开(allow 由假翻真)后入口才出现,点导出才发请求', async () => {
    authGate.state = { ready: false, allow: false }
    const { rerender } = render(<DataRightsPage />)
    expect(screen.queryByText('exportBtn')).toBeNull()

    authGate.state = { ready: true, allow: true }
    rerender(<DataRightsPage />)
    fireEvent.click(screen.getByText('exportBtn'))

    await waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(1))
    expect(fetchApi).toHaveBeenCalledWith('/api/gdpr/export', { method: 'POST' })
  })

  it('擦除成功 → logout() 把 allow 翻假后,回执仍在(不得被自己的登录引导顶掉)', async () => {
    const { rerender } = render(<DataRightsPage />)

    fireEvent.click(screen.getByText('eraseBtn'))
    fireEvent.change(screen.getByLabelText('eraseConfirmText'), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByText('confirm'))

    await waitFor(() =>
      expect(fetchApi).toHaveBeenCalledWith('/api/gdpr/erase', { method: 'POST' }),
    )
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
    expect(screen.getByText('eraseSuccess')).toBeTruthy()

    // logout() 的真实后果:isAuthenticated 落成 false ⇒ allow=false。模拟门翻转后重渲染。
    authGate.state = { ready: true, allow: false }
    rerender(<DataRightsPage />)

    expect(screen.getByText('eraseSuccess')).toBeTruthy()
    expect(screen.queryByText('loginRequired')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
