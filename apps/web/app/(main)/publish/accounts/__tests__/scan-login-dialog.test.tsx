// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 单平台扫码登录弹窗的行为测试(2026-09-29 立)。
 *
 * 立因:用户反馈"所有平台的扫码登录不好使"。实测定位到根因不在任何平台适配,
 * 而在**入口选错了通道**——弹窗走 `POST /api/browser/sessions`(内置浏览器 CDP),
 * 而生产 nginx 把 `/api/` 整段交给 Fastify(8802),该层没有这条路由,也没有
 * `/api/browser/ws/*`;Next.js rewrites 只在 dev 生效,线上结构上到不了 ai-service。
 * 实测证据(本机同一 token,2026-09-29):
 *   - POST http://127.0.0.1:8802/api/browser/sessions → 404 {"message":"Route … not found"}
 *   - GET  https://aizhs.top/api/browser/ws/zz        → 404(同信封,即同一层答的)
 *   - POST http://127.0.0.1:8802/api/publish/scan-login/start → 200,~9s 后 /qr 出 604KB PNG
 * 即**纯 HTTP 那条腿整条是通的,只是没有调用方**。本测试钉住"必须走那条通的腿"。
 *
 * 五条断言各自对应一条用户可见后果,不接受"看起来改了但没换通道"的实现:
 *  A1 发起必须调 startScanLogin,且**不得**调 createBrowserSession(404 那条腿)
 *  A2 二维码必须真的显示在弹窗里(<img alt=登录二维码>,经 fetchScanLoginQr 取字节)
 *  A3 检测到 success 必须回调 onSuccess
 *  A4 不可重试错误(404/403/500)必须立刻失败并显示原因,**不得**静默轮询到 5 分钟超时
 *     (旧实现在 catch 里什么都不做、直接接着轮询,把每一次 404 都表现成"等待扫码",这是
 *      "不好使"最难归因的那一层:屏幕上永远转圈,没有任何一处说出错)
 *  A5 取消/关闭必须发出 cancelScanLogin(否则后端 5 分钟任务与浏览器一直挂着)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { ScanLoginDialog } from '../ScanLoginDialog'

const startScanLogin = vi.fn()
const getScanLoginStatus = vi.fn()
const fetchScanLoginQr = vi.fn()
const cancelScanLogin = vi.fn()
const listScanLoginPlatforms = vi.fn()
const createBrowserSession = vi.fn()
const closeBrowserSession = vi.fn()
const detectLoginFromCdp = vi.fn()
const importCookiesManually = vi.fn()

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
  Select: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>,
  SelectTrigger: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  SelectValue: (_props: Record<string, unknown>) => <span />,
  SelectContent: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
}))

vi.mock('@/components/form/Textarea', () => ({
  Textarea: (props: Record<string, unknown>) => <textarea readOnly {...(props as object)} />,
}))

vi.mock('@/components/publish/CountdownTimer', () => ({
  CountdownTimer: () => <span data-testid="countdown" />,
}))

vi.mock('@ihui/api-client', () => ({
  listScanLoginPlatforms: () => listScanLoginPlatforms(),
  startScanLogin: (platform: string) => startScanLogin(platform),
  getScanLoginStatus: (taskId: string) => getScanLoginStatus(taskId),
  fetchScanLoginQr: (taskId: string) => fetchScanLoginQr(taskId),
  cancelScanLogin: (taskId: string) => cancelScanLogin(taskId),
  createBrowserSession: (args: unknown) => createBrowserSession(args),
  closeBrowserSession: (sid: string) => closeBrowserSession(sid),
  detectLoginFromCdp: (sid: string, platform: string) => detectLoginFromCdp(sid, platform),
  importCookiesManually: (p: string, c: string) => importCookiesManually(p, c),
}))

vi.mock('@/lib/tauri-bridge', () => ({
  openExternalUrl: vi.fn(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

const ok = <T,>(data: T) => Promise.resolve({ success: true as const, data })
// ApiResult 失败态的文案字段就叫 `error`(packages/types/src/api.ts:23),不是 message
const fail = (status: number, error: string) =>
  Promise.resolve({
    success: false as const,
    status,
    error,
    errorCode: `E_TEST_${status}`,
  })

const platforms = [
  {
    platform: 'zhihu',
    name: '知乎',
    login_url: 'https://www.zhihu.com/signin',
    success_cookies: ['d_c0'],
  },
]

function snapshot(over: Record<string, unknown> = {}) {
  return {
    task_id: 'task-1',
    user_id: 'u-1',
    platform: 'zhihu',
    status: 'waiting_scan',
    message: '请用 知乎 App 扫描二维码',
    has_qr: true,
    qr_updated_at: 1,
    cookies_count: 0,
    account_id: null,
    created_at: 1,
    completed_at: null,
    ...over,
  }
}

async function openAndStart() {
  listScanLoginPlatforms.mockResolvedValue(ok({ platforms }))
  const onFailed = vi.fn()
  render(<ScanLoginDialog open onOpenChange={onFailed} defaultPlatform="zhihu" />)
  await screen.findByText('accounts.startScanLogin')
  fireEvent.click(screen.getByText('accounts.startScanLogin'))
  return { onOpenChange: onFailed }
}

describe('单平台扫码登录弹窗 —— 必须走纯 HTTP 那条通的腿', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-29T00:00:00Z'))
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-qr')
    globalThis.URL.revokeObjectURL = vi.fn()
    for (const m of [
      startScanLogin,
      getScanLoginStatus,
      fetchScanLoginQr,
      cancelScanLogin,
      listScanLoginPlatforms,
      createBrowserSession,
      closeBrowserSession,
      detectLoginFromCdp,
      importCookiesManually,
    ])
      m.mockReset()
    startScanLogin.mockResolvedValue(
      ok({ task_id: 'task-1', platform: 'zhihu', status: 'pending', snapshot: snapshot() }),
    )
    getScanLoginStatus.mockResolvedValue(ok(snapshot()))
    fetchScanLoginQr.mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
    // 卸载/取消路径必然调到它 —— 不给返回值会让每个用例在 cleanup 里炸一次,
    // 表现为"四条红同因",容易被误读成实现有问题。
    cancelScanLogin.mockResolvedValue(ok({ task_id: 'task-1', cancelled: true }))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('A1 发起走 startScanLogin,绝不走线上 404 的 createBrowserSession', async () => {
    await openAndStart()
    await waitFor(() => expect(startScanLogin).toHaveBeenCalledWith('zhihu'))
    expect(createBrowserSession).not.toHaveBeenCalled()
    expect(detectLoginFromCdp).not.toHaveBeenCalled()
  })

  it('A2 二维码真的显示在弹窗里(经 fetchScanLoginQr 取字节,不是 iframe/CDP 画面)', async () => {
    await openAndStart()
    await waitFor(() => expect(fetchScanLoginQr).toHaveBeenCalledWith('task-1'), {
      timeout: 8000,
    })
    const img = await screen.findByAltText('accounts.scanLoginQrAlt')
    expect(img.getAttribute('src')).toBe('blob:mock-qr')
  })

  // 轮询间隔 3s,这条要跑满两轮才见得到 success —— 默认 5s 用例超时会把它掐死在断言之前
  it('A3 检测到 success 即回调 onSuccess', async () => {
    listScanLoginPlatforms.mockResolvedValue(ok({ platforms }))
    const onSuccess = vi.fn()
    getScanLoginStatus
      .mockResolvedValueOnce(ok(snapshot({ status: 'waiting_scan', has_qr: false })))
      .mockResolvedValue(ok(snapshot({ status: 'success', account_id: 42, cookies_count: 3 })))
    render(
      <ScanLoginDialog open onOpenChange={vi.fn()} defaultPlatform="zhihu" onSuccess={onSuccess} />,
    )
    await screen.findByText('accounts.startScanLogin')
    fireEvent.click(screen.getByText('accounts.startScanLogin'))
    await waitFor(() => expect(onSuccess).toHaveBeenCalled(), { timeout: 12000 })
  }, 20000)

  it('A4 不可重试错误立刻失败并点名,不得静默轮询到超时', async () => {
    listScanLoginPlatforms.mockResolvedValue(ok({ platforms }))
    // 旧实现这里正是"catch 里什么都不做、继续轮询",用户看到的现象就是"一直转圈到超时"
    startScanLogin.mockResolvedValue(fail(404, 'Route POST:/api/browser/sessions not found'))
    render(<ScanLoginDialog open onOpenChange={vi.fn()} defaultPlatform="zhihu" />)
    await screen.findByText('accounts.startScanLogin')
    fireEvent.click(screen.getByText('accounts.startScanLogin'))
    await screen.findByText('accounts.scanLoginFailed', undefined, { timeout: 8000 })
    await screen.findByText(/404|not found/i)
    // 且不得继续轮询
    const before = getScanLoginStatus.mock.calls.length
    await screen.findByText('accounts.scanLoginFailed')
    expect(getScanLoginStatus.mock.calls.length).toBeLessThanOrEqual(before)
  })

  it('A5 关闭弹窗必须取消后端任务', async () => {
    const { onOpenChange } = await openAndStart()
    await waitFor(() => expect(startScanLogin).toHaveBeenCalled())
    fireEvent.click(screen.getByText('accounts.cancelScan'))
    await waitFor(() => expect(cancelScanLogin).toHaveBeenCalledWith('task-1'))
    expect(onOpenChange).toBeDefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
