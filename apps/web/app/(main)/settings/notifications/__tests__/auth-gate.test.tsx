// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通知设置页 · 登录态门三态测试(G-932 真缺陷格收口)
 *
 * 立因:`useAuthGate()` 返回 `{ ready, allow }`,而 `allow = ready && isAuthenticated`。
 * 本页(及 settings/privacy、settings/agent-security、knowledge-base)只解构了 `allow`,
 * 渲染面写成 `!allow ⇒ AuthGatePrompt(「请先登录」)`,于是把两件事混成一件:
 *   - 确未登录(ready=true ∧ isAuthenticated=false)⇒ 该显登录引导;
 *   - 登录态确认中(ready=false,冷启动 bootstrap 还在静默刷新)⇒ 该显转圈。
 * 后果:已登录用户冷启动进本页,先被当成"没登录"看到「请先登录」,
 * 等 bootstrap 完成才自己好——正是签到助手 38d41f1c 之后、HEAD 已改判并落地的
 * 「把登录态确认中与确未登录分开」那一型,四枚页面漏接。
 *
 * 用例形状(会在修复前失败、修复后通过):
 *   1. ready=false ⇒ 不得出现 loginRequired,必须出现 loading;
 *   2. ready=true ∧ allow=false ⇒ 出现 loginRequired 且不发请求;
 *   3. allow 由假翻真 ⇒ 门开后自动补拉一次(压住注定 401 的抢跑)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

// 登录态门:默认已登录,让"门开后补拉"用例走真实数据路径;三态各自在例内改。
const authGate = vi.hoisted(() => ({ state: { ready: true, allow: true } }))
vi.mock('@/hooks/use-auth-gate', () => ({
  useAuthGate: () => authGate.state,
}))

const fetchApi = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api', () => ({
  fetchApi: fetchApi,
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// 只替外壳:AuthGatePrompt 必须真渲染传入文案,否则测不出"该页把哪一态当成了未登录"
vi.mock('@/components/common', () => ({
  AuthGatePrompt: ({ message }: { message: string }) => <div>{message}</div>,
  BackButton: () => <div />,
}))

vi.mock('@/components/layout', () => ({
  Container: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/hooks/use-notification', () => ({
  useNotification: () => ({ soundEnabled: false, setSoundEnabled: vi.fn() }),
}))

vi.mock('@ihui/ui-react', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Switch: () => <div />,
}))

vi.mock('lucide-react', () => ({
  Mail: () => <svg />,
  MessageSquare: () => <svg />,
  Bell: () => <svg />,
  Volume2: () => <svg />,
  Loader2: () => <svg />,
}))

import NotificationsPage from '../page'

const okPayload = {
  success: true,
  data: { settings: { emailEnabled: 'true', pushEnabled: 'false' } },
}

describe('通知设置页 · 登录态门三态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authGate.state = { ready: true, allow: true }
    fetchApi.mockResolvedValue(okPayload)
  })

  afterEach(() => {
    cleanup()
    authGate.state = { ready: true, allow: true }
  })

  it('登录态确认中(ready=false)不误显「请先登录」,显加载态且不发请求', async () => {
    authGate.state = { ready: false, allow: false }
    render(<NotificationsPage />)

    // 缺陷现场:allow 把 ready=false 一并算成"未登录" ⇒ 这里会抓到 loginRequired
    await waitFor(() => expect(screen.queryByText('loginRequired')).toBeNull())
    expect(screen.getByText('loading')).toBeTruthy()
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('确未登录(ready=true ∧ allow=false)显登录引导且不发注定 401 的请求', async () => {
    authGate.state = { ready: true, allow: false }
    render(<NotificationsPage />)

    await waitFor(() => expect(screen.getByText('loginRequired')).toBeTruthy())
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('门开(allow 由假翻真)后自动补拉一次', async () => {
    authGate.state = { ready: false, allow: false }
    const { rerender } = render(<NotificationsPage />)
    expect(fetchApi).not.toHaveBeenCalled()

    authGate.state = { ready: true, allow: true }
    rerender(<NotificationsPage />)
    await waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(1))
    expect(fetchApi).toHaveBeenCalledWith('/settings/notifications')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
