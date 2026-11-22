// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-86 装车证明(2026-10-29):createWebSocketHook 的"有界重连 + HTTP/SSE 降级 + 可见终态"。
 *
 * 四条臂(逐条对应票面失效形态,判据常量一律从源文件 import,§22c 禁止测试复制判据):
 *  ① 正常连上 ⇒ status='connected';
 *  ② 连不上 ⇒ 只重连 max 次(不多不少),耗尽自动改走 SSE 兜底并把内容继续流完
 *     (摘掉 scheduleReconnect 的上限判断 ⇒ 实例数超过 1+max 红;摘掉 openFallback ⇒ degraded 红);
 *  ③ 兜底也不可用(url 为空/握手致命)⇒ status='failed' + stopReason 可归因 + error 非空(不静默);
 *  ④ 终态只出现一次:failed 后长退避到点、页面回前台都不再自动复活(摘掉 wsTerminalRef 门 ⇒
 *     实例数继续涨红);人为 retry() 才给下一次机会。
 *
 * i18n 臂:error 恒为 wsChannel.* 键名(+ICU 参数),端内不得再出现硬编码中文。
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createWebSocketHook,
  DEFAULT_MAX_RECONNECT_ATTEMPTS,
  MAX_FALLBACK_TRANSIENT_RECONNECTS,
} from '../create-websocket-hook'

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

interface Msg {
  type: string
  [key: string]: unknown
}
const msgGuard = (v: unknown): v is Msg =>
  typeof v === 'object' && v !== null && typeof (v as { type?: unknown }).type === 'string'

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
  drop(code = 1006): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code })
  }
}

class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static instances: FakeEventSource[] = []
  readyState = FakeEventSource.CONNECTING
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  constructor(public readonly url: string) {
    FakeEventSource.instances.push(this)
  }
  close(): void {
    this.closed = true
    this.readyState = FakeEventSource.CLOSED
  }
  emitFatal(): void {
    this.readyState = FakeEventSource.CLOSED
    this.onerror?.()
  }
  emitTransient(): void {
    this.readyState = FakeEventSource.CONNECTING
    this.onerror?.()
  }
  push(data: string): void {
    this.onmessage?.({ data })
  }
}

let current: { rerender: () => void; unmount: () => void } | undefined

function build(opts: { maxReconnectAttempts?: number; fallbackUrl?: string | null }) {
  return createWebSocketHook<Msg>({
    urlBuilder: (token) => `wss://stream.test/ws?token=${token ?? ''}`,
    messageGuard: msgGuard,
    heartbeatInterval: 600_000,
    maxReconnectAttempts: opts.maxReconnectAttempts,
    fallback: {
      urlBuilder: () =>
        opts.fallbackUrl === undefined ? 'https://stream.test/sse' : opts.fallbackUrl,
    },
  })
}

/** 断链并把退避阶梯走满:max 次重连后必然进入 handleExhausted(降级裁决点) */
async function exhaust(max: number): Promise<void> {
  for (let i = 0; i < max; i++) {
    const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!
    act(() => ws.drop())
    // 第 i 次重连的退避 = 1000*2^i,留 1ms 余量防同刻度不触发
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
  FakeEventSource.instances = []
  auth.token = 'tok-1'
  vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket)
  vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource)
})

afterEach(async () => {
  await act(async () => current?.unmount())
  current = undefined
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('① 正常连上', () => {
  it('握手成功 ⇒ connected,计数清零,error 静默', () => {
    const useHook = build({ maxReconnectAttempts: 3 })
    const { result } = (current = renderHook(() => useHook()))
    expect(FakeWebSocket.instances).toHaveLength(1)
    act(() => FakeWebSocket.instances[0]!.openSelf())
    expect(result.current.status).toBe('connected')
    expect(result.current.isConnected).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.reconnectAttempt).toBe(0)
  })

  it('默认上限 = DEFAULT_MAX_RECONNECT_ATTEMPTS(常量单源,非测试复制)', () => {
    const useHook = build({})
    const { result } = (current = renderHook(() => useHook()))
    expect(result.current.maxReconnectAttempts).toBe(DEFAULT_MAX_RECONNECT_ATTEMPTS)
  })
})

describe('② 连不上 ⇒ 有界重连后自动转 HTTP/SSE,内容继续流完', () => {
  it('只重连 3 次(初始 1 + 重连 3 = 4 枚握手),耗尽即降级,且再无新握手', async () => {
    const max = 3
    const useHook = build({ maxReconnectAttempts: max })
    const { result } = (current = renderHook(() => useHook()))
    await exhaust(max)

    // 可归因:第 attempt/max 次与放弃路径都读得到
    expect(result.current.reconnectAttempt).toBe(max)
    expect(result.current.maxReconnectAttempts).toBe(max)
    // 恰好 1+max 枚,一枚不多(摘掉上限判断 ⇒ 这里继续涨红)
    expect(FakeWebSocket.instances).toHaveLength(1 + max)
    // 降级腿已接管:状态可见 + SSE 实例恰好 1 枚 + 非静默文案
    expect(result.current.status).toBe('degraded')
    expect(result.current.stopReason).toBeNull()
    expect(result.current.error).toBe('degradedNotice')
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0]!.url).toBe('https://stream.test/sse')

    // 兜底把内容流完:帧走同一条 messageGuard 进 lastMessage
    act(() => FakeEventSource.instances[0]!.push(JSON.stringify({ type: 'delta', data: 'x' })))
    expect(result.current.lastMessage).toEqual({ type: 'delta', data: 'x' })

    // 长退避不再产 WS/ES 握手(有界纪律在耗尽后仍然成立)
    await act(async () => {
      vi.advanceTimersByTime(600_000)
    })
    expect(FakeWebSocket.instances).toHaveLength(1 + max)
    expect(FakeEventSource.instances).toHaveLength(1)
  })

  it('重连过程文案可归因:i18n 键 + ICU {attempt}/{max} 插值,非硬编码', async () => {
    const useHook = build({ maxReconnectAttempts: 2 })
    const { result } = (current = renderHook(() => useHook()))
    act(() => FakeWebSocket.instances[0]!.drop())
    await act(async () => {
      vi.advanceTimersByTime(1001)
    })
    expect(result.current.status).toBe('reconnecting')
    expect(result.current.error).toBe('reconnecting:{"attempt":1,"max":2}')
  })
})

describe('③ 兜底也不可用 ⇒ 可见、可归因的失败终态(不静默)', () => {
  it('兜底地址给不出 ⇒ failed/fallback-unavailable', async () => {
    const max = 2
    const useHook = build({ maxReconnectAttempts: max, fallbackUrl: null })
    const { result } = (current = renderHook(() => useHook()))
    await exhaust(max)
    expect(result.current.status).toBe('failed')
    expect(result.current.stopReason).toBe('fallback-unavailable')
    expect(result.current.error).toBe('fallbackUnavailable')
    expect(FakeEventSource.instances).toHaveLength(0)
  })

  it('降级后兜底握手致命失败 ⇒ failed/fallback-failed', async () => {
    const max = 2
    const useHook = build({ maxReconnectAttempts: max })
    const { result } = (current = renderHook(() => useHook()))
    await exhaust(max)
    expect(result.current.status).toBe('degraded')
    act(() => FakeEventSource.instances[0]!.emitFatal())
    expect(result.current.status).toBe('failed')
    expect(result.current.stopReason).toBe('fallback-failed')
    expect(result.current.error).toBe('fallbackFailed')
  })

  it('兜底瞬态抖动只容忍 MAX_FALLBACK_TRANSIENT_RECONNECTS 轮,超过即终态(兜底也有界)', async () => {
    const max = 2
    const useHook = build({ maxReconnectAttempts: max })
    const { result } = (current = renderHook(() => useHook()))
    await exhaust(max)
    const es = FakeEventSource.instances[0]!
    for (let i = 0; i < MAX_FALLBACK_TRANSIENT_RECONNECTS; i++) {
      act(() => es.emitTransient())
      expect(result.current.status).toBe('degraded')
    }
    act(() => es.emitTransient())
    expect(result.current.status).toBe('failed')
    expect(es.closed).toBe(true)
  })

  it('不配置兜底时耗尽 ⇒ failed/reconnect-exhausted(旧"无兜底"形态也终态可见)', async () => {
    const max = 2
    const hook = createWebSocketHook<Msg>({
      urlBuilder: (token) => `wss://stream.test/ws?token=${token ?? ''}`,
      messageGuard: msgGuard,
      heartbeatInterval: 600_000,
      maxReconnectAttempts: max,
    })
    const { result } = (current = renderHook(() => hook()))
    await exhaust(max)
    expect(result.current.status).toBe('failed')
    expect(result.current.stopReason).toBe('reconnect-exhausted')
    expect(result.current.error).toBe('reconnectExhausted:{"max":2}')
  })
})

describe('④ 终态只出现一次,恢复出口只有人为/网络事件', () => {
  it('failed 后长退避与页面回前台都不复活;retry() 才重新起手', async () => {
    const max = 2
    const useHook = build({ maxReconnectAttempts: max, fallbackUrl: null })
    const { result } = (current = renderHook(() => useHook()))
    await exhaust(max)
    expect(result.current.status).toBe('failed')
    const wsCount = FakeWebSocket.instances.length
    const esCount = FakeEventSource.instances.length

    // 终态唯一性:定时器全走完 + visibilitychange(回前台)都不再产握手
    await act(async () => {
      vi.advanceTimersByTime(600_000)
    })
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(FakeWebSocket.instances).toHaveLength(wsCount)
    expect(FakeEventSource.instances).toHaveLength(esCount)
    expect(result.current.status).toBe('failed')
    expect(result.current.error).toBe('fallbackUnavailable')

    // 人为恢复出口:retry() 复位计数并重新起手(一次,不无限)
    act(() => result.current.retry())
    expect(result.current.status).toBe('connecting')
    expect(result.current.reconnectAttempt).toBe(0)
    expect(FakeWebSocket.instances).toHaveLength(wsCount + 1)
  })

  it('新凭据写回 store = 合法重连机会,终态不门死换票链路', async () => {
    const max = 2
    const useHook = build({ maxReconnectAttempts: max, fallbackUrl: null })
    const { result } = (current = renderHook(() => useHook()))
    await exhaust(max)
    expect(result.current.status).toBe('failed')
    const wsCount = FakeWebSocket.instances.length
    auth.token = 'tok-2'
    // token 变更触发的 effect 在 RTL 下需 rerender 才走到:直接 rerender 模拟 store 更新
    await act(async () => {
      current!.rerender()
    })
    expect(FakeWebSocket.instances).toHaveLength(wsCount + 1)
    expect(result.current.status === 'connecting' || result.current.status === 'reconnecting').toBe(
      true,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
