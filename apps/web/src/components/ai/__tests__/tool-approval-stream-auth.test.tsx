// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 高危工具审批弹窗的 EventSource 通道:access(cookie 内那枚 JWT)过期后必须
 * "续期一次 + 重建一次",失败要响 —— 这条腿哑掉的后果是"审批永不送达"。
 *
 * 四臂与 eventsource-auth-refresh 同一套(逐条对应失效面):
 *  ① 致命(readyState=CLOSED)⇒ 续期一次并重建;
 *  ② 续期失败 ⇒ 不重建、大声报错;
 *  ③ 重建后仍致命 ⇒ 续期总数仍为 1;
 *  ④ 瞬态(CONNECTING)⇒ 一次续期都不发(网络抖动不得当会话失效)。
 *
 * 摘掉新判据即翻红:删掉 tool-approval-dialog.tsx 里 es.onerror 那一整块 ⇒ ①②③ 全红。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'

const api = vi.hoisted(() => ({ refreshAccessTokenOnce: vi.fn<() => Promise<string | null>>() }))

vi.mock('@ihui/api-client', () => ({
  sendToolApprovalResponse: vi.fn(async () => ({ accepted: true })),
  postToolApprovalResponse: vi.fn(async () => undefined),
  refreshAccessTokenOnce: () => api.refreshAccessTokenOnce(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string): string => key,
}))

vi.mock('@/components/feedback', () => ({
  Modal: () => null,
  confirmDialog: vi.fn(async () => null),
}))

import { ToolApprovalDialog } from '../tool-approval-dialog'

class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static instances: FakeEventSource[] = []
  readyState = 0
  onerror: ((e: unknown) => void) | null = null
  constructor(public readonly url: string) {
    FakeEventSource.instances.push(this)
  }
  addEventListener(): void {}
  close(): void {}
  fireFatal(): void {
    this.readyState = FakeEventSource.CLOSED
    this.onerror?.({})
  }
  fireTransient(): void {
    this.readyState = FakeEventSource.CONNECTING
    this.onerror?.({})
  }
}

const esOf = (i: number): FakeEventSource => FakeEventSource.instances[i] as FakeEventSource
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

beforeEach(() => {
  FakeEventSource.instances = []
  api.refreshAccessTokenOnce.mockReset()
  vi.stubGlobal('EventSource', FakeEventSource)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  // 必须还原 console.error 的 spy:vi.spyOn 命中同一个已存在的 spy 时**不会**清空它的
  // calls,不还原 ⇒ 下一条用例读到的 calls[0] 是上一条留下的日志(实测假失败一次)。
  vi.restoreAllMocks()
})

describe('审批流通道:致命档只续期一次并重建一次', () => {
  it('① 致命 ⇒ 续期一次 + 重建第二条 EventSource', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue('fresh')
    render(<ToolApprovalDialog />)
    expect(FakeEventSource.instances).toHaveLength(1)

    act(() => esOf(0)!.fireFatal())
    await settle()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(FakeEventSource.instances).toHaveLength(2)
  })

  it('② 续期失败 ⇒ 不重建,并且大声报一行(不静默)', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue(null)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ToolApprovalDialog />)

    act(() => esOf(0)!.fireFatal())
    await settle()

    expect(FakeEventSource.instances).toHaveLength(1)
    expect(String(err.mock.calls[0]?.[0])).toContain('refresh-failed')
  })

  it('③ 重建后仍致命 ⇒ 续期总数仍为 1(绝不无限重建)', async () => {
    api.refreshAccessTokenOnce.mockResolvedValue('fresh')
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ToolApprovalDialog />)

    act(() => esOf(0)!.fireFatal())
    await settle()
    act(() => esOf(1)!.fireFatal())
    await settle()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(String(err.mock.calls[0]?.[0])).toContain('unauthorized-after-refresh')
  })

  it('④ 对照臂:瞬态抖动 ⇒ 不续期、不重建(交给 EventSource 内置重连)', async () => {
    render(<ToolApprovalDialog />)
    act(() => esOf(0)!.fireTransient())
    await settle()
    expect(api.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(FakeEventSource.instances).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
