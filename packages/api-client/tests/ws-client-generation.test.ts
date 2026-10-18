// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import { WebSocketClient, type WebSocketLike } from '../src/ws-client.js'
// G-276:所有权映射(activeByTopic)的判据源在 shared 侧屏障(本包零依赖边界不装
// @ihui/shared,测试经相对路径直引判据源源码;同形先例:parity 套件的跨包对账)。
import { createFrameOwnershipBarrier } from '../../shared/src/sse/frame-ownership-barrier.js'

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

/**
 * G-276:迟到帧不得回写所有权映射(建连 await 窗口代际重验的收尾格)。
 *
 * 上游锚:上游仓 replaceableConversationTransport.ts:84-99 的单向代际守卫 ——
 * 代际递增后,旧代际的迟到帧只丢弃、不投递、不回写任何代际状态。本仓所有权映射
 * (activeByTopic)的判据源是 packages/shared/src/sse/frame-ownership-barrier.ts:
 * activate(ACK)是唯一回写映射的路径,也是唯一推进当前代际的出口。
 *
 * 结构注记:本文件原测 WebSocketClient(其自身无所有权映射;"迟到帧不投递"在
 * ws-client 侧由 cffa4242 的 disposeStaleSocket 路径钉住),映射回写守卫的断言
 * 只能落在屏障判据源上 —— 故本组经跨包相对导入直测判据源。
 */
describe('G-276 迟到帧/迟到 ACK 不得回写所有权映射(屏障单向代际守卫)', () => {
  it('⑤ 迟到 ACK(generation 早于当前代际)不回写所有权映射、不冲刷暂存;迟到帧只丢弃不投递', () => {
    const barrier = createFrameOwnershipBarrier<string>()
    // 新代际(gen 2)ACK 先确立所有权
    barrier.activate({ subscriptionId: 'sub-gen2', topics: ['chat-stream'], generation: 2 })
    expect(barrier.isOwned('chat-stream', 'sub-gen2')).toBe(true)
    // 迟到的旧代际(gen 1)帧:只丢弃 —— 不投递('pass' 不可能)、不暂存、不动状态
    expect(
      barrier.offer({
        topic: 'chat-stream',
        subscriptionId: 'sub-gen1',
        generation: 1,
        frame: 'late',
      }),
    ).toBe('stale')
    expect(barrier.stagedCount()).toBe(0)
    // 迟到的旧代际(gen 1)ACK:不回写映射 —— topic 所有权仍是 gen2,gen1 无从取得
    const flushed = barrier.activate({
      subscriptionId: 'sub-gen1',
      topics: ['chat-stream'],
      generation: 1,
    })
    expect(flushed).toEqual([])
    expect(barrier.isOwned('chat-stream', 'sub-gen2')).toBe(true)
    expect(barrier.isOwned('chat-stream', 'sub-gen1')).toBe(false)
    // 换代前已暂存的旧代际帧,不得借新代际 ACK 之手投递(冲刷按代际过滤)
    const fresh = createFrameOwnershipBarrier<string>()
    fresh.offer({ topic: 'chat-stream', subscriptionId: 'sub-gen1', generation: 1, frame: 'old-1' })
    fresh.offer({ topic: 'chat-stream', subscriptionId: 'sub-gen2', generation: 2, frame: 'new-2' })
    const gen2Flush = fresh.activate({
      subscriptionId: 'sub-gen2',
      topics: ['chat-stream'],
      generation: 2,
    })
    expect(gen2Flush.map((x) => x.frame)).toEqual(['new-2'])
    expect(fresh.isOwned('chat-stream', 'sub-gen2')).toBe(true)
  })

  it('⑥ 反向锁:当前代际 ACK 回写保留 —— 映射照写、暂存照冲、同代际帧照投(行为逐字不变)', () => {
    const barrier = createFrameOwnershipBarrier<string>()
    barrier.offer({ topic: 'chat-stream', subscriptionId: 'sub-gen3', generation: 3, frame: 'a' })
    barrier.offer({ topic: 'chat-stream', subscriptionId: 'sub-gen3', generation: 3, frame: 'b' })
    // 当前代际 ACK:回写保留 —— 映射确立、暂存按原序冲刷
    const flushed = barrier.activate({
      subscriptionId: 'sub-gen3',
      topics: ['chat-stream'],
      generation: 3,
    })
    expect(flushed.map((x) => x.frame)).toEqual(['a', 'b'])
    expect(barrier.isOwned('chat-stream', 'sub-gen3')).toBe(true)
    // 同代际后续帧照常直接投递(不暂存、不丢弃)
    expect(
      barrier.offer({ topic: 'chat-stream', subscriptionId: 'sub-gen3', generation: 3, frame: 'c' }),
    ).toBe('pass')
    // 幂等重 ACK(同代际)不丢所有权
    expect(
      barrier.activate({ subscriptionId: 'sub-gen3', topics: ['chat-stream'], generation: 3 }),
    ).toEqual([])
    expect(barrier.isOwned('chat-stream', 'sub-gen3')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
