// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 2026-11-24 画中画监看运行时:用 iframe 冒充 PiP 窗口 + FakeWebSocket 直跑
// openBrowserPipMonitor —— 覆盖开窗尺寸/只读 DOM/状态流转/导航提示/接管关闭。
// (canvas 像素绘制依赖真实解码,不在 jsdom 断言范围)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BrowserPipLabels } from '../browser-pip'

vi.mock('@ihui/api-client', () => ({
  buildBrowserWsUrl: (sessionId: string) => `ws://test/${sessionId}`,
  setBrowserWsToken: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: { getState: () => ({ token: 'test-token' }) },
}))

const LABELS: BrowserPipLabels = {
  title: 'PIP monitor',
  emptyState: 'Nothing to run',
  readOnly: 'Read-only',
  handover: 'Take over',
  connecting: 'Connecting',
  running: 'Running',
  waiting: 'Waiting for you',
  gate: 'Login or verification page',
  error: 'Screen disconnected',
  stalled: (seconds) => `Screen has not updated for ${seconds}s`,
  tooSmall: 'Window too small',
  checkpointProgress: (done, total) => `Checkpoint ${done}/${total}`,
  checkpointWaiting: (label) => `Waiting for you: ${label}`,
  checkpointTimeout: (label) => `Waiting timed out: ${label}`,
  continueLabel: 'Done, continue',
  taskFailed: 'Action not delivered',
  checkpointLabels: { ck_payment_confirm_pay: 'Confirm before payment' },
}

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  readyState = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }
  send(data: string): void {
    this.sent.push(data)
  }
  close(): void {
    this.readyState = 3
    this.onclose?.()
  }
  emitOpen(): void {
    this.readyState = 1
    this.onopen?.()
  }
  emitMessage(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent)
  }
}

function makePipWindow(): { win: Window; destroy: () => void } {
  const iframe = document.createElement('iframe')
  document.body.append(iframe)
  const win = iframe.contentWindow
  if (!win) throw new Error('jsdom iframe contentWindow unavailable')
  Object.defineProperty(win, 'outerWidth', { value: 420, configurable: true })
  Object.defineProperty(win, 'outerHeight', { value: 280, configurable: true })
  Object.defineProperty(win, 'closed', {
    get: () => !iframe.isConnected,
    configurable: true,
  })
  Object.defineProperty(win, 'close', {
    value: () => iframe.remove(),
    configurable: true,
  })
  return { win, destroy: () => iframe.remove() }
}

let opened: { win: Window; destroy: () => void } | null = null
let lastRequest: { width?: number; height?: number } | null = null

beforeEach(() => {
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
  // 「接管」会调 window.focus();jsdom 未实现,显式 stub 掉以免测试日志刷警告
  vi.spyOn(window, 'focus').mockImplementation(() => {})
  Object.defineProperty(window, 'documentPictureInPicture', {
    configurable: true,
    value: {
      requestWindow: async (options: { width?: number; height?: number }) => {
        lastRequest = options
        opened = makePipWindow()
        return opened.win
      },
    },
  })
})

afterEach(async () => {
  const { closeBrowserPip } = await import('../browser-pip')
  closeBrowserPip()
  opened?.destroy()
  opened = null
  lastRequest = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete (window as { documentPictureInPicture?: unknown }).documentPictureInPicture
})

describe('openBrowserPipMonitor:真实浮窗 DOM 与状态流转', () => {
  it('开窗尺寸不低于 320×200;只读 DOM 在位;连接/运行状态可见', async () => {
    const { openBrowserPipMonitor } = await import('../browser-pip')
    const onClose = vi.fn()
    const handle = await openBrowserPipMonitor({
      sessionId: 'session-1',
      title: 'Demo tab',
      labels: LABELS,
      onClose,
    })

    expect(handle).not.toBeNull()
    expect(lastRequest?.width).toBeGreaterThanOrEqual(320)
    expect(lastRequest?.height).toBeGreaterThanOrEqual(200)
    const win = opened!.win
    expect(win.document.title).toBe('PIP monitor')
    expect(win.document.body.textContent).toContain('Read-only')
    expect(win.document.body.textContent).toContain('Demo tab')

    const canvas = win.document.querySelector('canvas')
    expect(canvas?.style.pointerEvents).toBe('none')
    expect(win.document.body.textContent).toContain('Connecting')

    const ws = FakeWebSocket.instances[0]!
    expect(ws?.url).toBe('ws://test/session-1')
    ws.emitOpen()
    expect(win.document.body.textContent).toContain('Running')

    ws.emitMessage({
      type: 'navigation',
      url: 'https://accounts.example.com/login',
      title: 'Sign in',
    })
    expect(win.document.body.textContent).toContain('Login or verification page')
    expect(win.document.body.textContent).toContain('accounts.example.com')

    handle!.setPhase('waiting')
    expect(win.document.body.textContent).toContain('Waiting for you')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('服务端人工节点:phase=waiting 顶掉运行中,phase=running 收回', async () => {
    const { openBrowserPipMonitor } = await import('../browser-pip')
    await openBrowserPipMonitor({ sessionId: 'session-3', labels: LABELS })
    const win = opened!.win
    const ws = FakeWebSocket.instances[0]!
    ws.emitOpen()
    expect(win.document.body.textContent).toContain('Running')

    ws.emitMessage({ type: 'phase', phase: 'waiting', reason: 'login required' })
    expect(win.document.body.textContent).toContain('Waiting for you')

    ws.emitMessage({ type: 'phase', phase: 'gate', reason: 'login-or-captcha' })
    expect(win.document.body.textContent).toContain('Login or verification page')

    ws.emitMessage({ type: 'phase', phase: 'running' })
    expect(win.document.body.textContent).toContain('Running')
  })

  it('接管:关闭浮窗 → 回调 onHandover/onClose,且不再收帧', async () => {
    const { openBrowserPipMonitor, isBrowserPipOpen } = await import('../browser-pip')
    const onHandover = vi.fn()
    const onClose = vi.fn()
    await openBrowserPipMonitor({
      sessionId: 'session-2',
      labels: LABELS,
      onHandover,
      onClose,
    })
    const win = opened!.win
    const ws = FakeWebSocket.instances[0]!
    ws.emitOpen()

    const button = Array.from(win.document.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Take over',
    )
    expect(button).toBeTruthy()
    button!.click()

    expect(onHandover).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(isBrowserPipOpen()).toBe(false)
    expect(ws.readyState).toBe(3)
  })

  it('任务条:目标/进度/当前检查点可见,「继续」发出恢复协议', async () => {
    const { openBrowserPipMonitor } = await import('../browser-pip')
    const handle = await openBrowserPipMonitor({ sessionId: 'session-task', labels: LABELS })
    const win = opened!.win
    const ws = FakeWebSocket.instances[0]!
    ws.emitOpen()

    handle!.setTask({
      task_id: 'task_1',
      goal: '完成支付',
      requirements: ['核对金额'],
      checkpoints: [
        { id: 'checkout', label: '进入结算页', status: 'done' },
        { id: 'pay', label: '付款前确认', label_key: 'ck_payment_confirm_pay', status: 'active' },
      ],
    })
    handle!.setPhase('waiting')

    expect(win.document.body.textContent).toContain('完成支付')
    expect(win.document.body.textContent).toContain('Checkpoint 1/2')
    expect(win.document.body.textContent).toContain('Waiting for you: Confirm before payment')

    const continueBtn = Array.from(win.document.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Done, continue',
    )
    expect(continueBtn).toBeTruthy()
    expect((continueBtn as HTMLElement).style.display).not.toBe('none')
    continueBtn!.click()
    expect(ws.sent.some((item) => item.includes('checkpoint_resume'))).toBe(true)
    expect(ws.sent.some((item) => item.includes('"pay"'))).toBe(true)

    ws.emitMessage({
      type: 'phase',
      phase: 'running',
    })
    expect((continueBtn as HTMLElement).style.display).toBe('none')
  })

  it('检查点等待超时:只换提示文案,「继续」仍然可用', async () => {
    const { openBrowserPipMonitor } = await import('../browser-pip')
    const handle = await openBrowserPipMonitor({ sessionId: 'session-timeout', labels: LABELS })
    const win = opened!.win
    FakeWebSocket.instances[0]!.emitOpen()

    handle!.setTask({
      task_id: 'task_timeout',
      goal: '完成支付',
      checkpoints: [
        {
          id: 'pay',
          label: '付款前确认',
          status: 'active',
          entered_at: '2026-11-25T00:00:00Z',
          timed_out: true,
        },
      ],
    })
    handle!.setPhase('waiting')

    expect(win.document.body.textContent).toContain('Waiting timed out: 付款前确认')
    expect(win.document.body.textContent).not.toContain('Waiting for you: 付款前确认')
    const continueBtn = Array.from(win.document.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Done, continue',
    )
    expect(continueBtn).toBeTruthy()
    expect((continueBtn as HTMLElement).style.display).not.toBe('none')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
