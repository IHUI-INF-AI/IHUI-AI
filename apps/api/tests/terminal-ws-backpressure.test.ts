// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 终端 WS 背压(F-116 第五条链)装车回归。
 *
 * 病灶:`terminal-ws.ts` 的 onData 曾裸 `socket.send`,是四条 ws-* 里唯一漏接
 * 统一背压闸的一条。慢消费者会让 Node 写队列无界堆积;终端帧不能像通知那样
 * 静默丢(xterm 状态会错乱),故本链处置为:超水位 pause PTY(数据留 OS 缓冲)
 * → drain resume → 5s 超时兜底(防半死连接把后台命令永久挂起)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const OVER = 1024 * 1024 + 1

const h = vi.hoisted(() => ({
  dataCb: null as null | ((data: string) => void),
  pauseCalls: 0,
  resumeCalls: 0,
}))

vi.mock('../src/plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => 'u1'),
}))
vi.mock('../src/services/terminal-service.js', () => ({
  getPTYEntry: vi.fn(() => ({
    pty: {
      pause: () => { h.pauseCalls += 1 },
      resume: () => { h.resumeCalls += 1 },
      resize: () => {},
      write: () => {},
      kill: () => {},
    },
    userId: 'u1',
    sessionId: 's1',
  })),
  onData: vi.fn((_sid: string, cb: (data: string) => void) => {
    h.dataCb = cb
    return () => {}
  }),
  onExit: vi.fn(() => () => {}),
  writeInput: vi.fn(),
  closeSession: vi.fn(),
}))

import { wsTerminal } from '../src/plugins/terminal-ws.js'

type FakeSocket = {
  sent: string[]
  sendCalls: number
  bufferedAmount: number
  readyState: number
  closeCalls: Array<{ code?: number; reason?: string }>
  send: (msg: string, cb?: (err?: Error) => void) => void
  close: (code?: number, reason?: string) => void
  on: (ev: string, cb: (...args: unknown[]) => void) => void
  emit: (ev: string, ...args: unknown[]) => Promise<void>
}

function makeSocket(bufferedAmount = 0): FakeSocket {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>()
  const socket: FakeSocket = {
    sent: [],
    sendCalls: 0,
    bufferedAmount,
    readyState: 1,
    closeCalls: [],
    send(msg, cb) {
      socket.sendCalls += 1
      socket.sent.push(msg)
      cb?.()
    },
    close(code, reason) {
      socket.closeCalls.push({ code, reason })
    },
    on(ev, cb) {
      handlers.set(ev, [...(handlers.get(ev) ?? []), cb])
    },
    async emit(ev, ...args) {
      for (const cb of handlers.get(ev) ?? []) cb(...args)
    },
  }
  return socket
}

async function connect(bufferedAmount = 0): Promise<FakeSocket> {
  let routeHandler: ((socket: FakeSocket, request: unknown) => unknown) | null = null
  const server = {
    get(_url: string, _opts: unknown, handler: unknown) {
      routeHandler = handler as (socket: FakeSocket, request: unknown) => unknown
    },
    post(): void {},
    addHook(): void {},
  }
  await (wsTerminal as unknown as (s: unknown, o: unknown) => Promise<void>)(server, {})
  const socket = makeSocket(bufferedAmount)
  routeHandler!(socket, { params: { sessionId: 's1' }, query: { token: 'x' } })
  await vi.advanceTimersByTimeAsync(0)
  return socket
}

describe('终端 WS 背压:超水位停 PTY、drain 恢复、超时兜底', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    h.dataCb = null
    h.pauseCalls = 0
    h.resumeCalls = 0
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('健康连接照常发 output 帧且不暂停 PTY', async () => {
    const socket = await connect()
    h.dataCb!('hello')
    expect(socket.sendCalls).toBe(1)
    expect(JSON.parse(socket.sent[0]!)).toEqual({ type: 'output', data: 'hello' })
    expect(h.pauseCalls).toBe(0)
  })

  it('超水位 ⇒ 不 send、暂停 PTY(数据留 OS 缓冲,不丢帧)', async () => {
    const socket = await connect(OVER)
    h.dataCb!('flood')
    expect(socket.sendCalls).toBe(0)
    expect(h.pauseCalls).toBe(1)
  })

  it('drain 后恢复 PTY,后续帧正常送达', async () => {
    const socket = await connect(OVER)
    h.dataCb!('flood')
    expect(h.pauseCalls).toBe(1)
    socket.bufferedAmount = 0
    await socket.emit('drain')
    expect(h.resumeCalls).toBe(1)
    h.dataCb!('after')
    expect(JSON.parse(socket.sent[0]!)).toEqual({ type: 'output', data: 'after' })
  })

  it('5s 超时兜底:半死连接不 drain 也会恢复,命令不会永久挂起', async () => {
    await connect(OVER)
    h.dataCb!('flood')
    expect(h.pauseCalls).toBe(1)
    await vi.advanceTimersByTimeAsync(5001)
    expect(h.resumeCalls).toBe(1)
  })

  it('断线 close 也恢复 PTY,避免残留暂停挂住后台命令', async () => {
    const socket = await connect(OVER)
    h.dataCb!('flood')
    await socket.emit('close')
    expect(h.resumeCalls).toBe(1)
  })
})
