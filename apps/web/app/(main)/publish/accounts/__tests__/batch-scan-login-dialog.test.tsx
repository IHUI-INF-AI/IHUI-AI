// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批量扫码弹窗行为测试(2026-09-16 立)。
 *
 * 锁定用户反馈的缺陷不再复发:
 * 1. 关闭弹窗后队列仍在后台跑,不停打开新平台 → 关闭即停;
 * 2. 点"停止队列"半天没反应 → 点击立即停止且不再打开下一个平台;
 * 3. 用户手动关掉浏览器窗口后仍继续打开下一个平台 → 视为结束队列;
 * 4. 外部模式必须在**用户自己日常使用的浏览器**里打开(openExternalUrl),
 *    而不是本应用托管的窗口(createBrowserSession)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { BatchScanLoginDialog } from '../BatchScanLoginDialog'

const openExternalUrl = vi.fn()
const detectLoginFromProfile = vi.fn()
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
  detectLoginFromProfile: (platform: string) => detectLoginFromProfile(platform),
  createBrowserSession: (args: unknown) => createBrowserSession(args),
  detectLoginFromCdp: (sid: string, platform: string) => detectLoginFromCdp(sid, platform),
  closeBrowserSession: (sid: string) => closeBrowserSession(sid),
  listScanLoginPlatforms: () => listScanLoginPlatforms(),
}))

vi.mock('@/lib/tauri-bridge', () => ({
  openExternalUrl: (url: string, name?: string) => openExternalUrl(url, name),
  isTauri: () => false,
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

/** 启动队列:等待平台表就绪 → 点"开始批量扫码" → 等到第 1 个平台已在用户浏览器打开 */
async function startQueue() {
  await waitFor(() => expect(screen.getByText('accounts.batchScanStart')).toBeTruthy())
  fireEvent.click(screen.getByText('accounts.batchScanStart'))
  await waitFor(() =>
    expect(openExternalUrl).toHaveBeenCalledWith('https://www.zhihu.com/signin', 'ihui-scan-login'),
  )
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
  // 检测始终"未登录",让队列停在轮询里,模拟用户登录前的等待态
  detectLoginFromProfile.mockResolvedValue({
    success: true,
    data: { detected: false, cookies_count: 0, account_id: null, profile_available: true },
  })
  closeBrowserSession.mockResolvedValue({ success: true })
  // 默认"确实打开了"(真实浏览器/桌面端);弹窗被拦截的场景单独用一个用例覆盖
  openExternalUrl.mockResolvedValue(true)
})

afterEach(() => {
  cleanup()
})

describe('BatchScanLoginDialog 关闭/停止行为', () => {
  it('关闭弹窗立即停止队列:不再打开下一个平台', async () => {
    const { rerender } = render(renderDialog(true))
    await startQueue()

    rerender(renderDialog(false))

    await new Promise((r) => setTimeout(r, 400))
    expect(openExternalUrl).toHaveBeenCalledTimes(1)
    expect(openExternalUrl).not.toHaveBeenCalledWith('https://passport.bilibili.com/login')
  })

  it('点"停止队列"立即反馈并停止后续平台', async () => {
    render(renderDialog(true))
    await startQueue()

    fireEvent.click(screen.getByText('accounts.batchScanStop'))

    await waitFor(() =>
      expect(screen.getAllByText('accounts.batchScanStopping').length).toBeGreaterThan(0),
    )
    await new Promise((r) => setTimeout(r, 400))
    expect(openExternalUrl).toHaveBeenCalledTimes(1)
    expect(detectLoginFromProfile).toHaveBeenCalledWith('zhihu')
  })

  it('用户手动关掉浏览器窗口后结束队列:不再打开下一个平台', async () => {
    // 后端在窗口被关闭后返回该错误(真机实测串);此前被当作普通异常 → 继续打开下一个窗口
    detectLoginFromProfile.mockResolvedValue({
      success: true,
      data: {
        detected: false,
        cookies_count: 0,
        account_id: null,
        error: '浏览器已关闭,请重新发起扫码登录',
      },
    })
    render(renderDialog(true))
    await startQueue()

    await new Promise((r) => setTimeout(r, 400))
    expect(openExternalUrl).toHaveBeenCalledTimes(1)
    expect(openExternalUrl).not.toHaveBeenCalledWith('https://passport.bilibili.com/login')
  })

  it('浏览器拦截新标签页时:立即停止队列并如实提示(不假装已打开)', async () => {
    openExternalUrl.mockResolvedValue(false) // 非用户手势的 window.open 被拦截
    render(renderDialog(true))

    await waitFor(() => expect(screen.getByText('accounts.batchScanStart')).toBeTruthy())
    fireEvent.click(screen.getByText('accounts.batchScanStart'))

    await waitFor(() => expect(screen.getByText('accounts.batchScanPopupBlocked')).toBeTruthy())
    await new Promise((r) => setTimeout(r, 400))
    expect(openExternalUrl).toHaveBeenCalledTimes(1)
    expect(detectLoginFromProfile).not.toHaveBeenCalled()
  })

  it('外部模式不托管浏览器会话(不使用内置浏览器/会话关闭)', async () => {
    render(renderDialog(true))
    await startQueue()

    await new Promise((r) => setTimeout(r, 300))
    expect(createBrowserSession).not.toHaveBeenCalled()
    expect(detectLoginFromCdp).not.toHaveBeenCalled()
    expect(closeBrowserSession).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
