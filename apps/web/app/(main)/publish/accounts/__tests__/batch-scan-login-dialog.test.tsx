// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批量扫码弹窗行为测试(2026-09-16 立)。
 *
 * 锁定用户反馈的两个缺陷不再复发:
 * 1. 关闭弹窗后队列仍在后台跑,不停弹出新的浏览器窗口 → 关闭即停(取消队列 + 关闭当前会话);
 * 2. 点"停止队列"半天没反应 → 点击立即反馈(按钮转"正在停止")且当场关闭当前浏览器会话。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { BatchScanLoginDialog } from '../BatchScanLoginDialog'

const startExternalScanLogin = vi.fn()
const closeBrowserSession = vi.fn()
const createBrowserSession = vi.fn()
const detectLoginFromCdp = vi.fn()
const listScanLoginPlatforms = vi.fn()
const openCdpSession = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return {
    Loader2: Icon,
    QrCode: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    SkipForward: Icon,
    Clock: Icon,
    MinusCircle: Icon,
    ListChecks: Icon,
    Monitor: Icon,
    ExternalLink: Icon,
  }
})

vi.mock('@ihui/ui-react', () => ({
  Button: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...rest}>{children}</button>
  ),
  Dialog: ({ children, open }: React.PropsWithChildren<{ open?: boolean }>) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
}))

vi.mock('@ihui/api-client', () => ({
  startExternalScanLogin: (platform: string) => startExternalScanLogin(platform),
  createBrowserSession: (args: unknown) => createBrowserSession(args),
  detectLoginFromCdp: (sid: string, platform: string) => detectLoginFromCdp(sid, platform),
  closeBrowserSession: (sid: string) => closeBrowserSession(sid),
  listScanLoginPlatforms: () => listScanLoginPlatforms(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}))

vi.mock('@/stores/work-panel', () => ({
  useWorkPanelStore: (selector: (s: { openCdpSession: typeof openCdpSession }) => unknown) =>
    selector({ openCdpSession }),
}))

const QUEUE = ['zhihu', 'bilibili']

function renderDialog(open: boolean) {
  return <BatchScanLoginDialog open={open} onOpenChange={() => {}} queuePlatforms={QUEUE} />
}

/** 启动队列:等待平台表就绪 → 点"开始批量扫码" → 等到第 1 个平台已拉起 */
async function startQueue() {
  await waitFor(() => expect(screen.getByText('accounts.batchScanStart')).toBeTruthy())
  fireEvent.click(screen.getByText('accounts.batchScanStart'))
  await waitFor(() => expect(startExternalScanLogin).toHaveBeenCalledWith('zhihu'))
}

beforeEach(() => {
  vi.clearAllMocks()
  listScanLoginPlatforms.mockResolvedValue({
    success: true,
    data: {
      platforms: [
        { platform: 'zhihu', name: '知乎', login_url: 'https://www.zhihu.com/signin' },
        {
          platform: 'bilibili',
          name: '哔哩哔哩',
          login_url: 'https://passport.bilibili.com/login',
        },
      ],
    },
  })
  startExternalScanLogin.mockImplementation((platform: string) =>
    Promise.resolve({
      success: true,
      data: { session_id: `s-${platform}`, platform, browser: 'Google Chrome', profile_used: true },
    }),
  )
  // 检测始终"未登录",让队列停在轮询里,模拟用户扫码前的等待态
  detectLoginFromCdp.mockResolvedValue({
    success: true,
    data: { detected: false, cookies_count: 0, account_id: null },
  })
  closeBrowserSession.mockResolvedValue({ success: true })
})

afterEach(() => {
  cleanup()
})

describe('BatchScanLoginDialog 关闭/停止行为', () => {
  it('关闭弹窗立即停止队列:关掉当前会话且不再拉起下一个平台', async () => {
    const { rerender } = render(renderDialog(true))
    await startQueue()

    // 关闭弹窗(模拟点 X / Esc:父组件把 open 置 false)
    rerender(renderDialog(false))

    await waitFor(() => expect(closeBrowserSession).toHaveBeenCalledWith('s-zhihu'))
    // 队列已停:第 2 个平台永远不会被拉起
    await new Promise((r) => setTimeout(r, 400))
    expect(startExternalScanLogin).toHaveBeenCalledTimes(1)
    expect(startExternalScanLogin).not.toHaveBeenCalledWith('bilibili')
  })

  it('点"停止队列"立即反馈并当场关闭浏览器会话', async () => {
    render(renderDialog(true))
    await startQueue()

    fireEvent.click(screen.getByText('accounts.batchScanStop'))

    // 立即(不等轮询间隔)关闭当前会话
    await waitFor(() => expect(closeBrowserSession).toHaveBeenCalledWith('s-zhihu'))
    // 按钮/进度区立刻转为"正在停止",不再是"点了没反应"
    await waitFor(() =>
      expect(screen.getAllByText('accounts.batchScanStopping').length).toBeGreaterThan(0),
    )

    await new Promise((r) => setTimeout(r, 400))
    expect(startExternalScanLogin).toHaveBeenCalledTimes(1)
  })
})
