// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketClient, type WebSocketLike } from '../src/ws-client.js'

/**
 * 活性看门狗成对测试:根治休眠唤醒 / TCP 半开时 onclose 不触发的假连接态。
 *
 * 竞品对标(Cursor appmap 图):渲染层 ping/pong 是配对 channel(renderer-ping 有
 * renderer_handlers、renderer-pong 有 mainOn),并单独广播 power-state。我们服务端
 * ws-broadcast.ts:659 也回纯 'pong',但客户端此前把 pong 直接吞掉、不记时间,
 * 重连只靠 onclose —— 半开时 ping 空发、_isConnected 停在 true,通知/广播全静默。
 *
 * 断言口径:① 收到过 pong 后停发 pong ⇒ 看门狗主动 close 并触发重连;
 * ② 从未收到 pong 的连接(不支持协议的服务端)不被误杀;
 * ③ pong 按时回来 ⇒ 长静默也不会误杀正常连接。
 */

interface LivenessSocket extends WebSocketLike {
  readonly url: string
  closeCalls: number
  sent: string[]
  open(): void
  message(data: unknown): void
}

function makeSocket(url: string): LivenessSocket {
  const socket: LivenessSocket = {
    url,
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
      // 真实 WebSocket 的 close() 会异步触发 onclose;这里同步触发以便断言重连链,
      // 且必须走 onclose 才能证明看门狗复用了既有重连+补增量链路而非另起炉灶。
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
  sockets: LivenessSocket[]
  onOpen: ReturnType<typeof vi.fn>
  onClose: ReturnType<typeof vi.fn>
}

function makeHarness(opts?: { heartbeatInterval?: number; livenessTimeoutMs?: number }): Harness {
  const sockets: LivenessSocket[] = []
  const onOpen = vi.fn()
  const onClose = vi.fn()
  const client = new WebSocketClient<{ kind: string }>(
    {
      urlBuilder: (token) => `ws://test/?token=${token}`,
      tokenProvider: () => 'access-token',
      messageGuard: (d): d is { kind: string } =>
        typeof d === 'object' && d !== null && typeof (d as { kind?: unknown }).kind === 'string',
      webSocketFactory: (url) => {
        const s = makeSocket(url)
        sockets.push(s)
        return s
      },
      heartbeatInterval: opts?.heartbeatInterval ?? 1000,
      livenessTimeoutMs: opts?.livenessTimeoutMs ?? 3000,
    },
    { onOpen, onClose },
  )
  return { client, sockets, onOpen, onClose }
}

/** 在假计时器下清空微任务 + 宏任务,让 connectInternal 的同步链与 finally 跑完 */
const flush = async () => {
  await vi.advanceTimersByTimeAsync(0)
  await vi.advanceTimersByTimeAsync(0)
}

describe('WS 活性看门狗(pong 缺失判死)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('① 收到过 pong 后停发 ⇒ 主动 close 并复用 onclose 重连链(消除假连接态)', async () => {
    const h = makeHarness()
    h.client.connect()
    await flush()
    const first = h.sockets[0]!
    first.open()
    expect(h.client.isConnected).toBe(true)

    // 服务端回过一次 pong ⇒ 看门狗武装
    first.message('pong')
    // 之后 TCP 半开:pong 再也不来,但 onclose 也不来(模拟休眠唤醒)
    // 阈值 3000ms 是严格大于;第 3 拍恰好 =3000 不判死,第 4 拍(4000ms)才触发
    await vi.advanceTimersByTimeAsync(4100)

    expect(first.closeCalls).toBeGreaterThanOrEqual(1)
    expect(h.onClose).toHaveBeenCalled()
    // 重连调度已挂上(重连延迟 1s 起);推进后必须有新 socket
    await vi.advanceTimersByTimeAsync(1100)
    expect(h.sockets.length).toBeGreaterThanOrEqual(2)
  })

  it('② 从未收到 pong 的服务端 ⇒ 不武装、不误杀(降级兼容旧形态)', async () => {
    const h = makeHarness()
    h.client.connect()
    await flush()
    const first = h.sockets[0]!
    first.open()
    // 服务端全程不回 pong,只发 ping
    await vi.advanceTimersByTimeAsync(10000)
    expect(first.closeCalls).toBe(0)
    expect(h.sockets.length).toBe(1)
    expect(first.sent.filter((s) => s === 'ping').length).toBeGreaterThan(0)
  })

  it('③ pong 按时回来 ⇒ 长静默也不误杀正常连接', async () => {
    const h = makeHarness({ heartbeatInterval: 1000, livenessTimeoutMs: 3000 })
    h.client.connect()
    await flush()
    const first = h.sockets[0]!
    first.open()
    first.message('pong')
    // 每拍都回 pong,连续 8 拍(8s)远超 3s 阈值,但每次都在窗口内 ⇒ 不判死
    for (let i = 0; i < 8; i++) {
      await vi.advanceTimersByTimeAsync(1000)
      first.message('pong')
    }
    expect(first.closeCalls).toBe(0)
    expect(h.sockets.length).toBe(1)
    expect(h.client.isConnected).toBe(true)
  })

  it('④ 换代后旧 socket 的迟到 pong 不会武装新连接的看门狗', async () => {
    const h = makeHarness()
    h.client.connect()
    await flush()
    const first = h.sockets[0]!
    first.open()
    h.client.updateToken()
    await flush()
    const second = h.sockets[1]!
    second?.open()
    // 旧 socket 的迟到消息被代际守卫丢弃,不能把 lastPongAt 写到新连接上
    first.message('pong')
    expect(first.closeCalls).toBeGreaterThanOrEqual(1)
    expect(h.client.isConnected).toBe(true)
  })
})
