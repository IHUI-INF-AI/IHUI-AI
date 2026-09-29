// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批量扫码弹窗行为测试(2026-09-16 立;2026-09-29 随内置档换通道更新)。
 *
 * 锁定用户反馈的缺陷不再复发:
 * 1. 关闭弹窗后队列仍在后台跑,不停打开新平台 → 关闭即停;
 * 2. 点"停止队列"半天没反应 → 点击立即停止且不再打开下一个平台;
 * 3. 用户手动关掉浏览器窗口后仍继续打开下一个平台 → 视为结束队列;
 * 4. 外部模式必须在**用户自己日常使用的浏览器**里打开(openExternalUrl),
 *    而不是本应用托管的窗口。
 * 2026-09-29 新增(B1-B6):内置档必须走扫码任务 HTTP 通道(startScanLogin →
 * getScanLoginStatus → fetchScanLoginQr → cancelScanLogin,与单平台弹窗同一契约),
 * 不得再走生产 404 的 CDP 通道;二维码直接显示在本弹窗内;两档轮询失败都不许静默。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { BatchScanLoginDialog } from '../BatchScanLoginDialog'

const openExternalUrl = vi.fn()
const detectLoginFromProfile = vi.fn()
const startScanLogin = vi.fn()
const getScanLoginStatus = vi.fn()
const fetchScanLoginQr = vi.fn()
const cancelScanLogin = vi.fn()
const listScanLoginPlatforms = vi.fn()

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
  listScanLoginPlatforms: () => listScanLoginPlatforms(),
  startScanLogin: (platform: string) => startScanLogin(platform),
  getScanLoginStatus: (taskId: string) => getScanLoginStatus(taskId),
  fetchScanLoginQr: (taskId: string) => fetchScanLoginQr(taskId),
  cancelScanLogin: (taskId: string) => cancelScanLogin(taskId),
}))

vi.mock('@/lib/tauri-bridge', () => ({
  openExternalUrl: (url: string, name?: string) => openExternalUrl(url, name),
  isTauri: () => false,
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}))

const QUEUE = ['zhihu', 'bilibili']

/** 扫码任务状态快照(与后端 ScanLoginTask 同形) */
function scanSnapshot(over: Record<string, unknown> = {}) {
  return {
    task_id: 'task-1',
    user_id: 'u-1',
    platform: 'zhihu',
    status: 'waiting_scan',
    message: '',
    has_qr: false,
    qr_updated_at: 0,
    cookies_count: 0,
    account_id: null,
    created_at: 1,
    completed_at: null,
    ...over,
  }
}

const ok = <T,>(data: T) => Promise.resolve({ success: true as const, data })

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

/** 切到"内置浏览器"档并启动队列(内置档走扫码任务通道) */
async function startInternalQueue() {
  await waitFor(() => expect(screen.getByText('accounts.batchScanStart')).toBeTruthy())
  fireEvent.click(screen.getByText('accounts.batchScanModeInternal'))
  fireEvent.click(screen.getByText('accounts.batchScanStart'))
  await waitFor(() => expect(startScanLogin).toHaveBeenCalledWith('zhihu'))
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
  // 内置档默认:任务起得来、状态停在 waiting_scan(不回二维码),模拟等待用户扫码
  startScanLogin.mockImplementation((platform: string) =>
    ok({
      task_id: `task-${platform}`,
      platform,
      status: 'pending',
      snapshot: scanSnapshot({ task_id: `task-${platform}`, platform }),
    }),
  )
  getScanLoginStatus.mockImplementation((taskId: string) => ok(scanSnapshot({ task_id: taskId })))
  fetchScanLoginQr.mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
  // 停止/关窗/卸载路径必然调到它 —— 不给返回值会让每个用例在 cleanup 阶段炸一次
  cancelScanLogin.mockResolvedValue(ok({ task_id: 'task-1', cancelled: true }))
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-qr')
  globalThis.URL.revokeObjectURL = vi.fn()
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

  it('外部模式不使用扫码任务通道(不 startScanLogin/不轮询任务/不取消任务)', async () => {
    render(renderDialog(true))
    await startQueue()

    await new Promise((r) => setTimeout(r, 300))
    expect(startScanLogin).not.toHaveBeenCalled()
    expect(getScanLoginStatus).not.toHaveBeenCalled()
    expect(cancelScanLogin).not.toHaveBeenCalled()
  })
})

describe('BatchScanLoginDialog 内置档走扫码任务通道(2026-09-29)', () => {
  it('B1 内置模式走扫码任务通道:逐平台调 startScanLogin 并推进队列', async () => {
    getScanLoginStatus.mockImplementation((taskId: string) =>
      ok(scanSnapshot({ task_id: taskId, status: 'success', cookies_count: 2 })),
    )
    const onSuccess = vi.fn()
    render(
      <BatchScanLoginDialog
        open
        onOpenChange={() => {}}
        queuePlatforms={QUEUE}
        onSuccess={onSuccess}
      />,
    )
    await startInternalQueue()

    await waitFor(() => expect(startScanLogin).toHaveBeenCalledWith('bilibili'))
    expect(startScanLogin).toHaveBeenCalledTimes(2)
    expect(getScanLoginStatus).toHaveBeenCalledWith('task-zhihu')
    expect(getScanLoginStatus).toHaveBeenCalledWith('task-bilibili')
    // 两平台都成功入库
    expect(onSuccess).toHaveBeenCalledTimes(2)
  })

  it('B2 二维码直接显示在本弹窗内:has_qr 时经 fetchScanLoginQr 取图渲染', async () => {
    getScanLoginStatus.mockImplementation((taskId: string) =>
      ok(scanSnapshot({ task_id: taskId, has_qr: true, qr_updated_at: 1 })),
    )
    render(renderDialog(true))
    await startInternalQueue()

    const img = await screen.findByTestId('batch-qr-image')
    expect(img.getAttribute('src')).toMatch(/^blob:/)
    expect(fetchScanLoginQr).toHaveBeenCalledWith('task-zhihu')
  })

  it('B3 状态应答失败当场点名:条目 error 且任务被取消,不静默轮到超时', async () => {
    // ApiResult 失败分支:服务端有应答但失败(如线上 CDP 通道那种 404)
    getScanLoginStatus.mockResolvedValue({
      success: false,
      status: 404,
      error: 'Route POST:/api/publish/scan-login/zz/status not found',
      errorCode: 'E_TEST_404',
    })
    render(renderDialog(true))
    await startInternalQueue()

    // 失败原因写进条目 msg,当场可见(旧实现会吞掉继续轮询到超时);两平台都会失败,故 All
    await screen.findAllByText(/not found/i)
    expect(screen.getAllByText(/not found/i)).toHaveLength(2)
    expect(cancelScanLogin).toHaveBeenCalledWith('task-zhihu')
    // 同一任务只轮询一次就判 error,不许反复静默重试
    expect(getScanLoginStatus.mock.calls.filter((c) => c[0] === 'task-zhihu')).toHaveLength(1)
  })

  it('B4 后端报 success 即推进队列:第一平台成功后为 bilibili 起新任务', async () => {
    getScanLoginStatus.mockImplementation((taskId: string) =>
      ok(scanSnapshot({ task_id: taskId, status: 'success' })),
    )
    const onSuccess = vi.fn()
    render(
      <BatchScanLoginDialog
        open
        onOpenChange={() => {}}
        queuePlatforms={QUEUE}
        onSuccess={onSuccess}
      />,
    )
    await startInternalQueue()

    await waitFor(() => expect(startScanLogin).toHaveBeenCalledWith('bilibili'))
    expect(onSuccess).toHaveBeenCalled()
  })

  it('B5 点"停止队列"立即取消当前扫码任务(后端 Chromium 不许挂着)', async () => {
    render(renderDialog(true))
    await startInternalQueue()

    fireEvent.click(screen.getByText('accounts.batchScanStop'))
    await waitFor(() => expect(cancelScanLogin).toHaveBeenCalledWith('task-zhihu'))
  })
})

describe('BatchScanLoginDialog 外部档轮询不再静默(2026-09-29)', () => {
  it('B6 检测应答 success:false → 条目当场 error(不再装作未检测到继续等)', async () => {
    detectLoginFromProfile.mockResolvedValue({ success: false, error: 'profile read failed' })
    render(renderDialog(true))
    await startQueue()

    // 两个平台都当场判 error,不静默重试(旧实现会一直轮询到 2 分钟超时)
    await waitFor(() =>
      expect(screen.getAllByText('accounts.batchScanDetectError')).toHaveLength(2),
    )
    expect(detectLoginFromProfile).toHaveBeenCalledWith('zhihu')
    expect(detectLoginFromProfile).toHaveBeenCalledWith('bilibili')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
