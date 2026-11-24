// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketClient, type WebSocketLike, type LivenessTimeoutDiagnostics } from '../src/ws-client.js'

/**
 * 活性看门狗判死诊断成对测试(对标 Cursor RendererPing `stacks=true`:判死必留证据)。
 *
 * 背景:此前判死只静默 close(),上层只看到普通 onClose,无法区分"看门狗判死"与
 * "正常断线",线上休眠唤醒 / TCP 半开假死无从观测。本测试锁定:
 * ① 判死回调带正确结构化字段;② 诊断绝不携带 URL/token(凭据不进日志);
 * ③ 每次连接只报一次;④ 未武装不误报;⑤ 回调抛错不阻断重连;⑥ 换代归旧代际。
 */
interface DiagSocket extends WebSocketLike {
  closeCalls: number
  sent: string[]
  open(): void
  message(data: unknown): void
}

function makeSocket(): DiagSocket {
  const socket: DiagSocket = {
    readyState: 0,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    closeCalls: 0,
    sent: [],
    send(data: string) {
      socket.sent.push(data)
    },
    close() {
      socket.closeCalls += 1
      if (socket.readyState === 3) return
      socket.readyState = 3
      socket.onclose?.()
    },
    open() {
      socket.readyState = 1
      socket.onopen?.()
    },
    message(data: unknown) {
      socket.onmessage?.({ data })
    },
  }
  return socket
}

interface Harness {
  client: WebSocketClient<{ kind: string }>
  sockets: DiagSocket[]
  diagnostics: ReturnType<typeof vi.fn>
}

function makeHarness(opts?: {
  heartbeatInterval?: number
  livenessTimeoutMs?: number
  onLivenessTimeout?: (d: LivenessTimeoutDiagnostics) => void
}): Harness {
  const sockets: DiagSocket[] = []
  const diagnostics = vi.fn()
  const onLivenessTimeout = opts?.onLivenessTimeout ?? diagnostics
  const client = new WebSocketClient<{ kind: string }>(
    {
      // URL 里埋一个假 token,用来验证诊断绝不外泄它
      urlBuilder: (token) => `ws://test/?token=SECRET_${token}`,
      tokenProvider: () => 'access-token',
      messageGuard: (d): d is { kind: string } =>
        typeof d === 'object' && d !== null && typeof (d as { kind?: unknown }).kind === 'string',
      webSocketFactory: () => {
        const s = makeSocket()
        sockets.push(s)
        return s
      },
      heartbeatInterval: opts?.heartbeatInterval ?? 1000,
      livenessTimeoutMs: opts?.livenessTimeoutMs ?? 3000,
    },
    { onLivenessTimeout },
  )
  return { client, sockets, diagnostics }
}

const flush = async () => {
  await vi.advanceTimersByTimeAsync(0)
  await vi.advanceTimersByTimeAsync(0)
}

describe('WS 看门狗判死诊断(onLivenessTimeout)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('① 判死时回调带正确结构化字段(代际/超时/阈值/readyState=OPEN)', async () => {
    const h = makeHarness()
    h.client.connect()
    await flush()
    const first = h.sockets[0]!
    first.open()
    first.message('pong')
    // 第 3 拍恰好 =3000 不判死,第 4 拍(4000ms)判死
    await vi.advanceTimersByTimeAsync(4100)

    expect(h.diagnostics).toHaveBeenCalledTimes(1)
    const d = h.diagnostics.mock.calls[0]![0] as LivenessTimeoutDiagnostics
    expect(d.timeoutMs).toBe(3000)
    expect(d.sinceLastPongMs).toBeGreaterThan(3000)
    expect(d.generation).toBe(0)
    // 诊断先于 close 采集,故此刻仍是 OPEN=1(而非 CLOSED=3)
    expect(d.readyState).toBe(1)
    expect(first.closeCalls).toBeGreaterThanOrEqual(1)
  })

  it('② 诊断绝不携带 URL / token(凭据不进日志)', async () => {
    const h = makeHarness()
    h.client.connect()
    await flush()
    h.sockets[0]!.open()
    h.sockets[0]!.message('pong')
    await vi.advanceTimersByTimeAsync(4100)

    expect(h.diagnostics).toHaveBeenCalledTimes(1)
    const d = h.diagnostics.mock.calls[0]![0] as Record<string, unknown>
    expect(Object.keys(d).sort()).toEqual(['generation', 'readyState', 'sinceLastPongMs', 'timeoutMs'])
    const serialized = JSON.stringify(d)
    expect(serialized).not.toContain('SECRET')
    expect(serialized).not.toContain('token')
    expect(serialized).not.toContain('ws://')
  })

  it('③ 每次连接只报一次(close 异步窗口内多拍不重复上报)', async () => {
    // 用一个不触发 onclose 的 socket 模拟"close 已发但 onclose 迟到",
    // 让心跳定时器继续跑,验证闩锁只放行第一次判死诊断。
    const sockets: DiagSocket[] = []
    const diagnostics = vi.fn()
    const client = new WebSocketClient<{ kind: string }>(
      {
        urlBuilder: () => 'ws://test/',
        tokenProvider: () => 't',
        messageGuard: (d): d is { kind: string } => typeof d === 'object' && d !== null,
        webSocketFactory: () => {
          const s = makeSocket()
          // 覆盖 close:只计数,既不触发 onclose 也不改 readyState —— 模拟
          // "close 帧已发但底层连接仍显示 OPEN、onclose 迟到"的真实窗口。
          // clearTimers 不发生 + readyState 仍 OPEN ⇒ 多拍能再进判死分支。
          s.close = () => {
            s.closeCalls += 1
          }
          sockets.push(s)
          return s
        },
        heartbeatInterval: 1000,
        livenessTimeoutMs: 3000,
      },
      { onLivenessTimeout: diagnostics },
    )
    client.connect()
    await flush()
    const first = sockets[0]!
    first.open()
    first.message('pong')
    // 跑 12 拍(远超阈值),close 不会触发 onclose,定时器一直活着
    await vi.advanceTimersByTimeAsync(12000)
    expect(first.closeCalls).toBeGreaterThan(1) // 确认确实多拍进了判死分支
    expect(diagnostics).toHaveBeenCalledTimes(1) // 但诊断只上报一次
  })

  it('④ 从未收到 pong 的连接不武装 ⇒ 不误报诊断', async () => {
    const h = makeHarness()
    h.client.connect()
    await flush()
    h.sockets[0]!.open()
    await vi.advanceTimersByTimeAsync(10000)
    expect(h.diagnostics).not.toHaveBeenCalled()
    expect(h.sockets[0]!.closeCalls).toBe(0)
  })

  it('⑤ 诊断回调抛错不阻断 close → 重连主链路', async () => {
    const boom = vi.fn((_d: LivenessTimeoutDiagnostics) => {
      throw new Error('diagnostics sink down')
    })
    const h = makeHarness({ onLivenessTimeout: boom })
    h.client.connect()
    await flush()
    const first = h.sockets[0]!
    first.open()
    first.message('pong')
    await vi.advanceTimersByTimeAsync(4100)
    expect(boom).toHaveBeenCalledTimes(1)
    // 回调抛错后主链路照常:close 发生 + 重连出新 socket
    expect(first.closeCalls).toBeGreaterThanOrEqual(1)
    await vi.advanceTimersByTimeAsync(1100)
    expect(h.sockets.length).toBeGreaterThanOrEqual(2)
  })

  it('⑥ 换代后判死诊断归旧代际,新连接可独立再报一次', async () => {
    const h = makeHarness()
    h.client.connect()
    await flush()
    const first = h.sockets[0]!
    first.open()
    first.message('pong')
    h.client.updateToken()
    await flush()
    const second = h.sockets[1]!
    second.open()
    second.message('pong')
    await vi.advanceTimersByTimeAsync(4100)

    // 旧 socket 在换代时已被 close,其定时器已清;只有新连接判死上报
    expect(h.diagnostics).toHaveBeenCalledTimes(1)
    const d = h.diagnostics.mock.calls[0]![0] as LivenessTimeoutDiagnostics
    expect(d.generation).toBe(1)
  })
})
