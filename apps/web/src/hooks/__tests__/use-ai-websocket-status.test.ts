// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-86(2026-10-29) 装车证明:五个 AI provider 的失败终态可见、可归因。
 *
 * 本文件只断言**现读事实**,不替票面"已兜底"背书:
 *  ① 反例(WS 正常):握手成功 ⇒ status='connected',全程不构造任何 EventSource
 *     (证明正常路径不会误启兜底腿);
 *  ② 正例(握手全败):有界重连耗尽 ⇒ status='failed' + stopReason='reconnect-exhausted'
 *     + errorMessage 非空 —— 即"不静默、不无限重连";此前 wrap 层只给 Event('error'),
 *     UI 读不出"正在重连"与"已放弃"的区别;
 *  ③ 有界性:握手总数恰为 1 + max(枚),多一轮或少一轮都说明阶梯被改坏。
 *
 * 票面 4 的"fallback 接管并收到流"正例在本层**无法**写真:五 provider 均未传
 * fallback,且既有 SSE(/api/ai/chat/stream、/llm/complete/stream)是 POST + 请求体,
 * 而兜底腿契约是 EventSource(GET、urlBuilder 只收 token),无法承载 capability.start{prompt}。
 * 该能力的契约级正例见 create-websocket-hook.test.ts 的 ② 组(工厂层已覆盖)。
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_MAX_RECONNECT_ATTEMPTS } from '../create-websocket-hook'
import { useAIWebSocket } from '../use-ai-websocket'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

const auth = vi.hoisted(() => ({ token: 'tok-1' as string | null }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: Object.assign(
    (sel: (s: { token: string | null }) => unknown) => sel({ token: auth.token }),
    { getState: () => ({ token: auth.token }) },
  ),
}))

// WS 源解析依赖 window.location/Tauri 探测,本用例只验状态机,固定成可控地址
vi.mock('@/lib/ws-url', () => ({
  buildWsUrl: (path: string, token?: string | null) =>
    `wss://stream.test${path}?token=${token ?? ''}`,
}))

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []
  readyState = FakeWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this)
  }
  send(): void {}
  close(): void {
    this.readyState = FakeWebSocket.CLOSED
  }
  openSelf(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }
  drop(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code: 1006 })
  }
}

/** 兜底腿探针:任何一次构造都说明"未配置 fallback 的 provider 仍被接上了兜底"(票面缺口) */
class ProbeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static instances: ProbeEventSource[] = []
  readyState = ProbeEventSource.CONNECTING
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  constructor(public readonly url: string) {
    ProbeEventSource.instances.push(this)
  }
  close(): void {
    this.readyState = ProbeEventSource.CLOSED
  }
}

let current: { unmount: () => void } | undefined

/** 把退避阶梯走满:第 i 次重连退避 = 1000*2^i */
async function exhaust(max: number): Promise<void> {
  for (let i = 0; i < max; i++) {
    const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!
    act(() => ws.drop())
    await act(async () => {
      vi.advanceTimersByTime(1000 * 2 ** i + 1)
    })
  }
  const last = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!
  act(() => last.drop())
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeWebSocket.instances = []
  ProbeEventSource.instances = []
  auth.token = 'tok-1'
  vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket)
  vi.stubGlobal('EventSource', ProbeEventSource as unknown as typeof EventSource)
})

afterEach(async () => {
  await act(async () => current?.unmount())
  current = undefined
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('① 反例:WS 正常 ⇒ 不启用任何兜底腿', () => {
  it('qwen 握手成功 ⇒ status=connected,EventSource 构造 0 枚', () => {
    const { result } = (current = renderHook(() => useAIWebSocket('qwen')))
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0]!.url).toContain('/cozeZhsApi/ws/qwen/stream')

    act(() => FakeWebSocket.instances[0]!.openSelf())
    expect(result.current.status).toBe('connected')
    expect(result.current.isConnected).toBe(true)
    expect(result.current.errorMessage).toBeNull()
    expect(result.current.stopReason).toBeNull()
    expect(ProbeEventSource.instances).toHaveLength(0)
  })

  it('未激活 provider 不建连:选 generic 时只开 1 条,且走 generic 路径', () => {
    const { result } = (current = renderHook(() => useAIWebSocket('generic')))
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0]!.url).toContain('/v1/ai/capabilities/ws/stream')
    act(() => FakeWebSocket.instances[0]!.openSelf())
    expect(result.current.status).toBe('connected')
  })
})

describe('② 正例:握手全败 ⇒ 有界耗尽后失败终态可见、可归因(不静默挂死)', () => {
  it('deepseek 全败 ⇒ status=failed / stopReason=reconnect-exhausted / errorMessage 非空', async () => {
    const max = DEFAULT_MAX_RECONNECT_ATTEMPTS
    const { result } = (current = renderHook(() => useAIWebSocket('deepseek')))
    await exhaust(max)

    expect(result.current.status).toBe('failed')
    expect(result.current.stopReason).toBe('reconnect-exhausted')
    expect(result.current.errorMessage).not.toBeNull()
    expect(result.current.errorMessage).toContain('reconnectExhausted')
    expect(result.current.reconnectAttempt).toBe(max)
    expect(result.current.maxReconnectAttempts).toBe(max)
    // 票面缺口实证:未配 fallback ⇒ 不出现兜底腿(此处 0 枚即"无 HTTP/SSE 兜底")
    expect(ProbeEventSource.instances).toHaveLength(0)
  })

  it('终态后长退避不再产握手(有界纪律)', async () => {
    const max = DEFAULT_MAX_RECONNECT_ATTEMPTS
    ;(current = renderHook(() => useAIWebSocket('zhipu')))
    await exhaust(max)
    const count = FakeWebSocket.instances.length
    await act(async () => {
      vi.advanceTimersByTime(600_000)
    })
    expect(FakeWebSocket.instances).toHaveLength(count)
    expect(ProbeEventSource.instances).toHaveLength(0)
  })

  it('retry() 是唯一人为恢复出口:复位计数并重新起手一次', async () => {
    const max = DEFAULT_MAX_RECONNECT_ATTEMPTS
    const { result } = (current = renderHook(() => useAIWebSocket('doubao')))
    await exhaust(max)
    expect(result.current.status).toBe('failed')
    const count = FakeWebSocket.instances.length

    act(() => result.current.retry())
    expect(result.current.status).toBe('connecting')
    expect(result.current.reconnectAttempt).toBe(0)
    expect(FakeWebSocket.instances).toHaveLength(count + 1)
  })
})

describe('③ 有界性:握手总数恰为 1 + max(枚)', () => {
  it('默认上限下不多不少', async () => {
    const max = DEFAULT_MAX_RECONNECT_ATTEMPTS
    ;(current = renderHook(() => useAIWebSocket('qwen')))
    await exhaust(max)
    expect(FakeWebSocket.instances).toHaveLength(1 + max)
  })

  it('中途连上即清零重连计数(阶梯不被上一轮污染)', async () => {
    const { result } = (current = renderHook(() => useAIWebSocket('qwen')))
    act(() => FakeWebSocket.instances[0]!.drop())
    await act(async () => {
      vi.advanceTimersByTime(1001)
    })
    expect(result.current.reconnectAttempt).toBe(1)
    act(() => FakeWebSocket.instances[1]!.openSelf())
    expect(result.current.reconnectAttempt).toBe(0)
    expect(result.current.status).toBe('connected')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
