// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import { WebSocketClient, type WebSocketLike } from '../src/ws-client.js'

/**
 * G-816007 成对测试:建连 await 窗口的代际重验。
 *
 * 上游故障形态(conversationProjectionStore.ts:428-447 点名的 `fault.subscription.notOwned`
 * 卡死根因同族):`connect()` 的 ticket await 窗口内发生换代时,旧建连若只判
 * closedByUser 就会照旧接管 this.ws —— 旧 socket 被顶出后无任何 close 路径,成为
 * 服务端可见的孤儿连接。实现侧要求:入口捕获代际、ticket await 后重验、过期 socket
 * 必须**真的 close**(不是"忽略回调"就算完)、换代后的 connect 不得被旧代际在飞标志吞掉。
 */

interface RecordedSocket extends WebSocketLike {
  readonly url: string
  closeCalls: number
  sent: string[]
  open(): void
  message(data: unknown): void
}

function makeSocket(url: string): RecordedSocket {
  const socket: RecordedSocket = {
    url,
    readyState: 0, // WS_CONNECTING
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
      socket.readyState = 2 // WS_CLOSED
    },
    open() {
      socket.readyState = 1 // WS_OPEN
      socket.onopen?.()
    },
    message(data: unknown) {
      socket.onmessage?.({ data })
    },
  }
  return socket
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/** 清空微任务 + 宏任务,让 connectInternal 的 await 链与 finally 跑完 */
const flush = () => new Promise<void>((r) => setTimeout(r, 0))

interface Harness {
  client: WebSocketClient<{ kind: string }>
  sockets: RecordedSocket[]
  ticketGate: ReturnType<typeof createDeferred<string>>
  onOpen: ReturnType<typeof vi.fn>
  onMessage: ReturnType<typeof vi.fn>
  onClose: ReturnType<typeof vi.fn>
}

function makeHarness(opts?: { ticketMode?: 'deferred-first' | 'immediate' }): Harness {
  const sockets: RecordedSocket[] = []
  const ticketGate = createDeferred<string>()
  let ticketCalls = 0
  const onOpen = vi.fn()
  const onMessage = vi.fn()
  const onClose = vi.fn()
  const client = new WebSocketClient<{ kind: string }>(
    {
      urlBuilder: (token) => `ws://test/?token=${token}`,
      tokenProvider: () => 'access-token',
      messageGuard: (d): d is { kind: string } =>
        typeof d === 'object' && d !== null && typeof (d as { kind?: unknown }).kind === 'string',
      ticketProvider: () => {
        ticketCalls += 1
        return opts?.ticketMode === 'immediate'
          ? Promise.resolve(`ticket-${ticketCalls}`)
          : ticketCalls === 1
            ? ticketGate.promise
            : Promise.resolve(`ticket-${ticketCalls}`)
      },
      webSocketFactory: (url) => {
        const s = makeSocket(url)
        sockets.push(s)
        return s
      },
      heartbeatInterval: 60_000,
    },
    { onOpen, onMessage, onClose },
  )
  return { client, sockets, ticketGate, onOpen, onMessage, onClose }
}

describe('G-816007 建连 await 窗口的代际重验', () => {
  it('① ticket await 窗口内 updateToken 换代 ⇒ 旧建连被废弃(不接管 this.ws),换代真关旧 socket', async () => {
    const h = makeHarness()
    h.client.connect()
    await flush()
    // 换代发生在 ticket await 窗口内(第一个 ticket 还没换回来)
    h.client.updateToken()
    await flush()
    // 新代际连接建成并打开
    expect(h.sockets.length).toBe(1)
    const liveSocket = h.sockets[0]!
    liveSocket.open()
    expect(h.onOpen).toHaveBeenCalledTimes(1)
    // 旧建连的 ticket 此刻才返回 ⇒ 旧建连必须放弃:不得再建 socket、不得接管 this.ws
    h.ticketGate.resolve('ticket-stale')
    await flush()
    expect(h.sockets.length).toBe(1)
    expect(h.sockets[0]).toBe(liveSocket)
    expect(h.onOpen).toHaveBeenCalledTimes(1)
    // 活连接照常收发,旧 ticket 的事件无从投递
    liveSocket.message(JSON.stringify({ kind: 'live' }))
    expect(h.onMessage).toHaveBeenCalledTimes(1)
    // 换代必须**真的 close** 旧 socket(updateToken 直关;close 次数 ≥1,"忽略回调"不算通过)
    const closeBefore = liveSocket.closeCalls
    h.client.updateToken()
    await flush()
    expect(liveSocket.closeCalls).toBeGreaterThan(closeBefore)
    h.client.disconnect()
  })

  it('② 过期代际的回调进来 ⇒ socket 被 close(不只忽略)', async () => {
    const h = makeHarness({ ticketMode: 'immediate' })
    h.client.connect()
    await flush()
    expect(h.sockets.length).toBe(1)
    const staleSocket = h.sockets[0]!
    staleSocket.open()
    expect(h.onOpen).toHaveBeenCalledTimes(1)
    // 换代:updateToken 自己会 close 旧 socket(≥1 次)
    h.client.updateToken()
    await flush()
    expect(h.sockets.length).toBe(2)
    expect(staleSocket.closeCalls).toBeGreaterThanOrEqual(1)
    // 迟到的旧代际事件:onmessage / onopen 都必须触发 close(disposeStaleSocket 幂等),不是静默忽略
    const before = staleSocket.closeCalls
    staleSocket.message(JSON.stringify({ kind: 'late' }))
    expect(staleSocket.closeCalls).toBeGreaterThan(before)
    staleSocket.open()
    expect(staleSocket.closeCalls).toBeGreaterThan(before + 1)
    // 新代际 socket 打开后,事件不重复投递、onOpen 只来自两代各自的正常开连
    h.sockets[1]!.open()
    expect(h.onMessage).not.toHaveBeenCalled()
    expect(h.onOpen).toHaveBeenCalledTimes(2)
    h.client.disconnect()
  })

  it('③ 同代际 connect 并发去重:只建一条连接;正常单连接不得误关(反向锁)', async () => {
    const h = makeHarness()
    h.client.connect()
    h.client.connect()
    h.client.connect()
    await flush()
    h.ticketGate.resolve('ticket-1')
    await flush()
    expect(h.sockets.length).toBe(1)
    const socket = h.sockets[0]!
    socket.open()
    // 正常单连接:任何路径都不得误关
    expect(socket.closeCalls).toBe(0)
    expect(h.client.isConnected).toBe(true)
    h.client.disconnect()
  })

  it('④ 换代后的 connect 不被旧代际在飞标志吞掉;旧 finally 不清新代际在飞标志', async () => {
    const h = makeHarness()
    h.client.connect()
    await flush()
    // 旧建连在飞时换代:换代触发的 connect 必须真发起新建连(不被在飞标志吞掉)
    h.client.updateToken()
    await flush()
    expect(h.sockets.length).toBe(1)
    h.sockets[0]!.open()
    expect(h.onOpen).toHaveBeenCalledTimes(1)
    expect(h.client.isConnected).toBe(true)
    // 旧建连过期退出,finally 不得清掉新代际的在飞标志 ⇒ 后续 connect 仍同代际去重
    h.ticketGate.resolve('ticket-stale')
    await flush()
    const socketsBefore = h.sockets.length
    h.client.connect()
    h.client.connect()
    await flush()
    expect(h.sockets.length).toBe(socketsBefore)
    h.client.disconnect()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
