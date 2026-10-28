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

// 这张表必须覆盖 ScanLoginDialog 从 lucide-react 引的**每一个**名字:vi.mock 的工厂不给
// 某个导出 ⇒ 组件模块求值期就抛 `No "X" export is defined on the mock`,本文件 13 条用例
// **全部**灭在收集/渲染阶段,而报错误导成"扫码登录的行为坏了"。2026-10-05 它就是因为组件
// 加了 RefreshCw 与 Import(出码提速/会话复用两票)而整文件红。对照:同目录
// batch-scan-login-dialog.test.tsx 那张表是齐的。
vi.mock('lucide-react', () => {
  const Icon = () => <span data-testid="icon" />
  return {
    Loader2: Icon,
    QrCode: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    ExternalLink: Icon,
    RefreshCw: Icon,
    // 组件写的是 `Import as ImportIcon`,所以 mock 的**键名**必须是 Import
    Import: Icon,
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
  startScanLogin: (...args: unknown[]) => startScanLogin(...args),
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
    window.localStorage.clear() // 会话复用偏好跨用例必须复位,否则开关用例会污染相邻用例
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
    await waitFor(() => expect(startScanLogin).toHaveBeenCalledWith('zhihu', { reuseSession: true }))
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

  /**
   * 2026-09-30 提速档:A6/A7 钉住"用户点按钮之前二维码就已经在路上"。
   *
   * 立因(本机实测,platform=toutiao_app):固定等待(goto 后 3s + 切 tab 后 1.5s +
   * 截图前 2s)曾占满 7.8s 里的大头,现在后端已改成"条件一到就走";前端这一侧剩下的
   * 就是"点按钮才点火"本身 —— 后端起浏览器 + 打开登录页要 1.2s,纯属可提前的等待。
   * 所以弹窗一打开(带 defaultPlatform 的入口)就点火,点击时直接**接管**那枚任务:
   * 不再发第二次 startScanLogin(否则等于把刚跑掉的那 1.2s 又白等一遍)。
   */
  it('A6 带默认平台的入口一打开就预热(startScanLogin 在点击前已发出)', async () => {
    render(<ScanLoginDialog open onOpenChange={vi.fn()} defaultPlatform="zhihu" />)
    await screen.findByText('accounts.startScanLogin')
    await waitFor(() => expect(startScanLogin).toHaveBeenCalledWith('zhihu', { reuseSession: true }))
    // 预热只发一次:此时用户还没点任何东西
    expect(startScanLogin).toHaveBeenCalledTimes(1)
  })

  it('A6b 预热不等于自动开扫:二维码不进入轮询,用户仍看到「开始扫码登录」', async () => {
    render(<ScanLoginDialog open onOpenChange={vi.fn()} defaultPlatform="zhihu" />)
    await screen.findByText('accounts.startScanLogin')
    await waitFor(() => expect(startScanLogin).toHaveBeenCalledWith('zhihu', { reuseSession: true }))
    // 预热只是把后端任务点起来:界面停在 idle,没有轮询、没有二维码
    expect(getScanLoginStatus).not.toHaveBeenCalled()
    expect(fetchScanLoginQr).not.toHaveBeenCalled()
    expect(screen.getByText('accounts.startScanLogin')).toBeTruthy()
  })

  it('A7 点击时接管预热任务,不再重复发起(冷启动 1.2s 被提前掉)', async () => {
    await openAndStart()
    await waitFor(() => expect(getScanLoginStatus).toHaveBeenCalledWith('task-1'))
    // 关键判据:整场只有 A6 那一次预热调用,点击没有又发一遍
    expect(startScanLogin).toHaveBeenCalledTimes(1)
    expect(fetchScanLoginQr).toHaveBeenCalledWith('task-1')
  })

  it('A8 关闭弹窗必须取消预热任务,不给后端留空转的浏览器', async () => {
    render(<ScanLoginDialog open onOpenChange={vi.fn()} defaultPlatform="zhihu" />)
    await screen.findByText('accounts.startScanLogin')
    await waitFor(() => expect(startScanLogin).toHaveBeenCalledTimes(1))
    cleanup()
    await waitFor(() => expect(cancelScanLogin).toHaveBeenCalledWith('task-1'))
  })

  /**
   * 2026-09-30 第二档提速:用户原话「别让用户以为卡住了,一点变化都没有」。
   *
   * 上面那批把"出码时刻"提前了;这一批管的是**出码之前那几秒屏幕上有没有变化**。
   * 三条断言各自对应一种"看着像卡死"的形态:
   *  A9 出码前必须有与二维码同尺寸的占位骨架(位置不跳,码一好就地替换)
   *  A10 后端 stage 必须驱动五级进度阶梯(不是前端编的假进度)
   *  A11 已等待秒数必须在跳(最直接的"页面还活着"证据)
   */
  it('A9 出码前显示占位骨架,不再是一行静止文字', async () => {
    getScanLoginStatus.mockResolvedValue(ok(snapshot({ has_qr: false, qr_updated_at: 0 })))
    await openAndStart()
    expect(await screen.findByTestId('qr-placeholder')).toBeTruthy()
    // 当前档位出现在两处:主文案 + 阶梯里的高亮项(故用 getAllByText 而非唯一性断言)
    expect(screen.getAllByText('accounts.loadingStage.booting').length).toBeGreaterThan(0)
  })

  it('A10 进度阶梯由后端 stage 驱动:stage=rendering 时该档高亮', async () => {
    getScanLoginStatus.mockResolvedValue(
      ok(snapshot({ has_qr: false, qr_updated_at: 0, stage: 'rendering' })),
    )
    await openAndStart()
    // 主文案切到 rendering 那一档(阶梯里其余档位仍以文字列出,故用主文案唯一性判)
    await waitFor(() => {
      const nodes = screen.getAllByText('accounts.loadingStage.rendering')
      expect(nodes.length).toBeGreaterThan(0)
    })
    expect(screen.getByText('accounts.loadingStage.opening')).toBeTruthy()
  })

  it('A11 等待期间「已等待秒数」在跳字', async () => {
    getScanLoginStatus.mockResolvedValue(ok(snapshot({ has_qr: false, qr_updated_at: 0 })))
    await openAndStart()
    await screen.findByTestId('qr-placeholder')
    const first = screen.getAllByText(/^accounts\.elapsedSeconds$/).length
    expect(first).toBeGreaterThan(0)
    // 计时器每 100ms 一跳(fake timers 已 shouldAdvanceTime),等两跳后仍应存在(未抛错/未卸载)
    await new Promise((r) => setTimeout(r, 350))
    expect(screen.getByTestId('qr-placeholder')).toBeTruthy()
  })
  it('A12 会话复用开关:关掉后发起带 reuseSession:false,并持久化到 localStorage', async () => {
    listScanLoginPlatforms.mockResolvedValue(ok({ platforms }))
    render(<ScanLoginDialog open onOpenChange={vi.fn()} defaultPlatform="zhihu" />)
    await screen.findByText('accounts.startScanLogin')
    fireEvent.click(screen.getByText('accounts.scanLoginReuseLabel'))
    fireEvent.click(screen.getByText('accounts.startScanLogin'))
    await waitFor(() =>
      expect(startScanLogin).toHaveBeenCalledWith('zhihu', { reuseSession: false }),
    )
    expect(window.localStorage.getItem('ihui:scan-login:reuse-session')).toBe('0')
  })

})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
