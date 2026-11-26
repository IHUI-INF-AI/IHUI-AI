// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​​​‌‍‍​​‌‌​​‌‌​‍⁠

// @vitest-environment jsdom
/**
 * R8:画中画监看窗的「收起/展开」按钮语义。
 *
 * 这条不碰窗口几何(Rust 侧另有单测),只钉 UI 契约:收起成功后按钮必须变成
 * 「展开」,再点一次必须回到「收起」。若桥返回失败,状态不得假装翻转。
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const bridge = vi.hoisted(() => ({
  toggleAiPipCollapsed: vi.fn(),
}))

vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: () => true,
  toggleAiPipCollapsed: bridge.toggleAiPipCollapsed,
  closeAiPipWindow: vi.fn(),
  handoverAiPipWindow: vi.fn(),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setTitle: vi.fn().mockResolvedValue(undefined),
    setAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@ihui/api-client', () => ({
  buildBrowserWsUrl: (sessionId: string) => `ws://test/${sessionId}`,
  setBrowserWsToken: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (state: { token: string }) => string) =>
    selector({ token: 'test-token' }),
}))

vi.mock('@/hooks/use-browser-pip-labels', () => ({
  useBrowserPipLabels: () => ({
    title: 'PIP monitor',
    emptyState: 'Nothing to run',
    readOnly: 'Read-only',
    handover: 'Take over',
    connecting: 'Connecting',
    running: 'Running',
    waiting: 'Waiting for you',
    gate: 'Login or verification page',
    error: 'Screen disconnected',
    stalled: (seconds: number) => `Screen has not updated for ${seconds}s`,
    tooSmall: 'Window too small',
    checkpointProgress: (done: number, total: number) => `Checkpoint ${done}/${total}`,
    checkpointWaiting: (label: string) => `Waiting for you: ${label}`,
    checkpointTimeout: (label: string) => `Waiting timed out: ${label}`,
    continueLabel: 'Done, continue',
    taskFailed: 'Action not delivered',
    requirements: 'Run requirements',
    task: 'Task',
    pin: 'Pin on top',
    unpin: 'Unpin',
    reconnect: 'Reconnect',
    close: 'Close',
    minimize: 'Minimize',
    expandWindow: 'Expand',
    expandTask: 'Expand task details',
    collapseTask: 'Collapse task details',
    checkpointLabels: {},
  }),
}))

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
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.readyState = 3
  }
}

describe('AiPipMonitor R8 收起/展开按钮', () => {
  beforeEach(() => {
    bridge.toggleAiPipCollapsed.mockReset()
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    cleanup()
  })

  it('收起成功后按钮变「展开」,再点回到「收起」', async () => {
    bridge.toggleAiPipCollapsed.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const { AiPipMonitor } = await import('../ai-pip-monitor')

    render(<AiPipMonitor sessionId="sess-r8" />)

    const minimize = await screen.findByRole('button', { name: 'Minimize' })
    fireEvent.click(minimize)
    await waitFor(() => {
      expect(bridge.toggleAiPipCollapsed).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Expand' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
    await waitFor(() => {
      expect(bridge.toggleAiPipCollapsed).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('button', { name: 'Minimize' })).toBeTruthy()
    })
  })

  it('桥失败不翻转按钮语义', async () => {
    bridge.toggleAiPipCollapsed.mockRejectedValueOnce(new Error('boom'))
    const { AiPipMonitor } = await import('../ai-pip-monitor')

    render(<AiPipMonitor sessionId="sess-r8" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Minimize' }))
    await waitFor(() => expect(bridge.toggleAiPipCollapsed).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Minimize' })).toBeTruthy()
  })

  it('收起态重开(窗口仅 32px 高)首帧就显示「展开」', async () => {
    const original = window.innerHeight
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 32 })
    try {
      const { AiPipMonitor } = await import('../ai-pip-monitor')
      render(<AiPipMonitor sessionId="sess-r8" />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Expand' })).toBeTruthy()
      })
    } finally {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: original })
    }
  })
})
