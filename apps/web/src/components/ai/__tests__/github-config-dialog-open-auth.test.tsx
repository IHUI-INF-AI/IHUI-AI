// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y-87 reverse tabnabbing 回归(2026-11-18)。
 *
 * 证的是一件事:GitHub Device Flow 的「打开授权页面」按钮用 window.open 开新窗口时,
 * 第三参必须带 noopener,noreferrer —— 否则被开页面可用 window.opener 反向操纵本窗口。
 * verificationUri 虽来自 GitHub 后端非用户输入(故 P2),但纪律是"所有 window.open 都切断 opener"。
 * 本用例把组件驱动到 auth 态,点按钮,直接断言 window.open 的第三参。
 */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const M = vi.hoisted(() => ({
  open: vi.fn(() => null as unknown),
  requestDeviceCode: vi.fn(),
  pollDeviceToken: vi.fn(),
  fetchGithubStatus: vi.fn(async () => {}),
  fetchStatus: vi.fn(async () => {}),
}))

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('@/components/common', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/feedback', () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/stores/environment-info', () => ({
  useEnvironmentInfoStore: (sel: (s: unknown) => unknown) =>
    sel({
      githubConfigOpen: true,
      closeGithubConfig: vi.fn(),
      githubStatus: { ghConfigured: false },
      fetchGithubStatus: M.fetchGithubStatus,
      fetchStatus: M.fetchStatus,
    }),
}))
vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: (sel: (s: unknown) => unknown) =>
    sel({ activeWorkspace: { path: '/tmp/ws' } }),
}))
vi.mock('@ihui/shared/utils', () => ({ apiFailureToError: (e: unknown) => new Error(String(e)) }))
vi.mock('@ihui/api-client', () => ({
  clearGithubToken: vi.fn(async () => ({ success: true })),
  requestGithubDeviceCode: M.requestDeviceCode,
  pollGithubDeviceToken: M.pollDeviceToken,
  setGithubToken: vi.fn(async () => ({ success: true })),
}))

import { GithubConfigDialog } from '@/components/ai/github-config-dialog'

const VERIFY_URL = 'https://github.com/login/device'

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'open', { configurable: true, value: M.open })
  M.requestDeviceCode.mockResolvedValue({
    success: true,
    data: {
      deviceCode: 'dev-1',
      userCode: 'ABCD-1234',
      verificationUri: VERIFY_URL,
      interval: 60,
      expiresIn: 1800,
    },
  })
  // 轮询保持 pending,避免组件自动关闭/跳转干扰本用例;测试结束 cleanup 会卸载并清 timer
  M.pollDeviceToken.mockResolvedValue({ success: true, data: { status: 'pending', interval: 60 } })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('GithubConfigDialog — Y-87 window.open noopener', () => {
  it('打开授权页面时用 noopener,noreferrer 切断 opener', async () => {
    render(<GithubConfigDialog />)

    // 先点「使用 GitHub 授权」进入 Device Flow auth 态
    fireEvent.click(screen.getByTestId('github-auth-start'))
    await waitFor(() => expect(screen.getByTestId('github-open-auth-page')).toBeDefined())

    // 再点「打开授权页面」
    fireEvent.click(screen.getByTestId('github-open-auth-page'))

    expect(M.open).toHaveBeenCalledTimes(1)
    const [url, target, features] = M.open.mock.calls[0] as string[]
    expect(url).toBe(VERIFY_URL)
    expect(target).toBe('_blank')
    expect(String(features)).toContain('noopener')
    expect(String(features)).toContain('noreferrer')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
