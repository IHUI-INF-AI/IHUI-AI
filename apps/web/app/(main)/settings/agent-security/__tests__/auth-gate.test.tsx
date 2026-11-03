// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 智能体安全页 · 登录态门三态测试(G-932 真缺陷格收口)
 *
 * 立因同 settings/notifications:本页只解构 `allow`(= ready && isAuthenticated),
 * 渲染面 `!allow ⇒ AuthGatePrompt(「请先登录」)`,把"登录态确认中(ready=false,
 * 冷启动 bootstrap 还在静默刷新)"误判成"未登录"。已登录用户冷启动进本页先被踢到
 * 登录引导,是签到助手 38d41f1c 之后 HEAD 已改判并落地的三态分离在本页的漏接。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

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

vi.mock('@/components/common', () => ({
  AuthGatePrompt: ({ message }: { message: string }) => <div>{message}</div>,
  BackButton: () => <div />,
}))

vi.mock('@/components/layout', () => ({
  Container: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@ihui/ui-react', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Switch: () => <div />,
  Button: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
}))

vi.mock('lucide-react', () => ({
  ShieldCheck: () => <svg />,
  ShieldAlert: () => <svg />,
  Gavel: () => <svg />,
  ScanSearch: () => <svg />,
  History: () => <svg />,
  Loader2: () => <svg />,
}))

import AgentSecurityPage from '../page'

describe('智能体安全页 · 登录态门三态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authGate.state = { ready: true, allow: true }
    fetchApi.mockResolvedValue({
      success: true,
      data: {
        prompt_guard_enabled: true,
        prompt_guard_policy: 'flag',
        exec_policy_mode: 'enforce',
        input_scan_enabled: true,
        pipeline_record_enabled: false,
      },
    })
  })

  afterEach(() => {
    cleanup()
    authGate.state = { ready: true, allow: true }
  })

  it('登录态确认中(ready=false)不误显「请先登录」,显加载态且不发请求', async () => {
    authGate.state = { ready: false, allow: false }
    render(<AgentSecurityPage />)

    await waitFor(() => expect(screen.queryByText('loginRequired')).toBeNull())
    expect(screen.getByText('loading')).toBeTruthy()
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('确未登录(ready=true ∧ allow=false)显登录引导且不发注定 401 的请求', async () => {
    authGate.state = { ready: true, allow: false }
    render(<AgentSecurityPage />)

    await waitFor(() => expect(screen.getByText('loginRequired')).toBeTruthy())
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('门开(allow 由假翻真)后自动补拉安全配置', async () => {
    authGate.state = { ready: false, allow: false }
    const { rerender } = render(<AgentSecurityPage />)
    expect(fetchApi).not.toHaveBeenCalled()

    authGate.state = { ready: true, allow: true }
    rerender(<AgentSecurityPage />)
    await waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(1))
    expect(fetchApi).toHaveBeenCalledWith('/agent/security-config')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
