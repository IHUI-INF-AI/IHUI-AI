// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-116 广播链路背压检查 —— 装车回归。
 *
 * 缺陷本体(票面):全部 `ws-*.ts` 中 `bufferedAmount` 出现 0 次 ⇒ 慢消费者(长期不读
 * socket 但仍回 pong)的写队列无界堆积;且 `ws-notifications` 用同步 try/catch 兜
 * `ws.send`,而"连接已断"的写失败走 **callback**,死连接永远摘不掉。
 *
 * 四条链路各自的处置(见 ws-backpressure.ts 头注):
 *  - notifications / broadcast / chat(房间):超阈值 ⇒ 跳过本帧 + 计数,连接保留;
 *  - customer-service(1:1 会话):超阈值 ⇒ 断开连接(无回放缓冲,丢帧补不回来)。
 *  - 四条链路:**写失败一律摘线**(同步抛出与 callback 报错都算)。
 *
 * 不连库、不监听端口:假 socket 驱动真实插件装饰出的投递入口。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const h = vi.hoisted(() => ({
  userId: 'aaaaaaaa-1111-4111-8111-111111111111',
  agent: null as null | { id: string; nickname: string },
  session: null as null | {
    sessionId: string
    userId: string
    status: string
    agentId: string | null
    queuePosition: number
  },
}))

vi.mock('../src/plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => 'aaaaaaaa-1111-4111-8111-111111111111'),
  wsUpgradeRequiresCredential: () => async (): Promise<void> => undefined,
  WS_CLOSE: {
    MISSING_TOKEN: 4001,
    RATE_LIMITED: 4002,
    INVALID_TOKEN: 4003,
    ACCOUNT_CANCELLED: 4004,
    TOO_MANY_CONNECTIONS: 4005,
  },
  WsUserConnectionLimiter: class {
    acquire(): boolean {
      return true
    }
    release(): void {}
    currentCount(): number {
      return 0
    }
  },
  WsRateLimiter: class {
    allow(): boolean {
      return true
    }
    reset(): void {}
  },
}))
vi.mock('../src/plugins/ws-auto-recovery.js', () => ({
  getWsAutoRecoveryManager: () => ({ setFastify: () => {}, registerPlugin: () => {} }),
}))
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async () => undefined),
}))
vi.mock('@ihui/auth', () => ({ generateWsToken: vi.fn(async () => 'ws-token') }))
vi.mock('@ihui/shared', () => ({ toUserFriendlyMessage: (e: unknown): string => String(e) }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
  },
}))
vi.mock('ioredis', () => {
  class FakeRedis {
    on(): void {}
    async psubscribe(): Promise<string> {
      return 'OK'
    }
    async publish(): Promise<number> {
      return 0
    }
    async quit(): Promise<string> {
      return 'OK'
    }
  }
  return { default: FakeRedis }
})
vi.mock('../src/db/customer-service-queries.js', () => ({
  createSession: vi.fn(async () => h.session),
  findSessionBySessionId: vi.fn(async () => h.session),
  assignSession: vi.fn(async () => ({ session: null })),
  closeSession: vi.fn(),
  pickAvailableAgent: vi.fn(async () => null),
  findWaitingSessions: vi.fn(async () => []),
  findAgentByUserId: vi.fn(async () => h.agent),
  updateAgentStatus: vi.fn(),
}))

import {
  WS_BACKPRESSURE_LIMIT_BYTES,
  createBackpressureSkipLedger,
  isWsBackpressured,
  sendWithBackpressure,
} from '../src/plugins/ws-backpressure.js'
import { wsNotifications } from '../src/plugins/ws-notifications.js'
import { wsChat } from '../src/plugins/ws-chat.js'
import { wsCustomerService } from '../src/plugins/ws-customer-service.js'
import { wsBroadcast } from '../src/plugins/ws-broadcast.js'

const OVER = WS_BACKPRESSURE_LIMIT_BYTES + 1

type FailMode = 'none' | 'throw' | 'callback'

interface FakeSocket {
  sent: string[]
  sendCalls: number
  bufferedAmount: number
  readyState: number
  failMode: FailMode
  closeCalls: Array<{ code?: number; reason?: string }>
  send: (msg: string, cb?: (err?: Error) => void) => void
  close: (code?: number, reason?: string) => void
  on: (ev: string, cb: (...args: unknown[]) => void) => void
  emit: (ev: string, ...args: unknown[]) => Promise<void>
}

function makeSocket(opts: { bufferedAmount?: number; failMode?: FailMode } = {}): FakeSocket {
  const handlers = new Map<string, Array<(...args: unknown[]) => unknown>>()
  const socket: FakeSocket = {
    sent: [],
    sendCalls: 0,
    bufferedAmount: opts.bufferedAmount ?? 0,
    readyState: 1,
    failMode: opts.failMode ?? 'none',
    closeCalls: [],
    send(msg: string, cb?: (err?: Error) => void): void {
      socket.sendCalls += 1
      // 真实 ws:连接已关时错误交给 callback;旧代码的同步 try/catch 看不见这一型。
      if (socket.failMode === 'throw') throw new Error('socket is closed')
      if (socket.failMode === 'callback') {
        cb?.(new Error('WebSocket was closed before the message was sent'))
        return
      }
      socket.sent.push(msg)
      cb?.()
    },
    close(code?: number, reason?: string): void {
      socket.closeCalls.push({ code, reason })
    },
    on(ev: string, cb: (...args: unknown[]) => void): void {
      const list = handlers.get(ev) ?? []
      list.push(cb)
      handlers.set(ev, list)
    },
    async emit(ev: string, ...args: unknown[]): Promise<void> {
      for (const cb of handlers.get(ev) ?? []) await cb(...args)
    },
  }
  return socket
}

/** 让 async IIFE 里的注册（wsAuth 之后那一小段同步代码）跑完 */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

type RouteHandler = (socket: FakeSocket, request: unknown) => unknown

// ────────────────────────────── 工具单测 ──────────────────────────────

describe('ws-backpressure 单点:阈值只此一处,判定与发送形态', () => {
  it('阈值是 1MB,且判定严格大于(bufferedAmount === 阈值不算堆积)', () => {
    expect(WS_BACKPRESSURE_LIMIT_BYTES).toBe(1024 * 1024)
    expect(isWsBackpressured({ bufferedAmount: WS_BACKPRESSURE_LIMIT_BYTES } as never)).toBe(false)
    expect(isWsBackpressured({ bufferedAmount: OVER } as never)).toBe(true)
  })

  it('超阈值 ⇒ 不调用 send,结论 skipped(调用方据此决定跳过还是断开)', () => {
    const socket = makeSocket({ bufferedAmount: OVER })
    let failures = 0
    const outcome = sendWithBackpressure(socket as never, 'frame', () => {
      failures += 1
    })
    expect(outcome).toBe('skipped')
    expect(socket.sendCalls).toBe(0)
    expect(failures).toBe(0)
  })

  it('正常连接 ⇒ sent;callback 报错与同步抛出都走 onFailure', () => {
    const ok = makeSocket()
    expect(sendWithBackpressure(ok as never, 'frame', () => {})).toBe('sent')
    expect(ok.sent).toEqual(['frame'])

    let cbFailures = 0
    const cbDead = makeSocket({ failMode: 'callback' })
    expect(sendWithBackpressure(cbDead as never, 'frame', () => (cbFailures += 1))).toBe('sent')
    expect(cbFailures).toBe(1)

    let throwFailures = 0
    const throwDead = makeSocket({ failMode: 'throw' })
    expect(sendWithBackpressure(throwDead as never, 'frame', () => (throwFailures += 1))).toBe(
      'failed',
    )
    expect(throwFailures).toBe(1)
  })

  it('跳过台账:首喊一次,窗口内静默累计,超窗复读', () => {
    let clock = 0
    const ledger = createBackpressureSkipLedger(() => clock)
    expect(ledger.record()).toBe(true)
    clock += 1_000
    expect(ledger.record()).toBe(false)
    expect(ledger.total()).toBe(2)
    clock += 60_000
    expect(ledger.record()).toBe(true)
    expect(ledger.total()).toBe(3)
  })
})

// ────────────────────────────── ① ws-notifications ──────────────────────────────

async function buildNotificationsHarness(): Promise<{
  push: (userId: string, payload: unknown) => void
  connect: (opts?: { bufferedAmount?: number; failMode?: FailMode }) => Promise<FakeSocket>
  warns: Array<{ fields: Record<string, unknown>; msg: string }>
}> {
  let push: ((userId: string, payload: unknown) => void) | null = null
  let routeHandler: RouteHandler | null = null
  const warns: Array<{ fields: Record<string, unknown>; msg: string }> = []

  const server = {
    log: {
      warn(fields: Record<string, unknown>, msg: string): void {
        warns.push({ fields, msg })
      },
      info(): void {},
    },
    decorate(name: string, fn: unknown): void {
      if (name === 'pushNotification') push = fn as (userId: string, payload: unknown) => void
    },
    post(): void {},
    get(_url: string, _opts: unknown, handler: unknown): void {
      routeHandler = handler as RouteHandler
    },
    addHook(): void {},
  }

  await (wsNotifications as unknown as (s: unknown, o: unknown) => Promise<void>)(server, {})
  if (!push || !routeHandler) throw new Error('ws-notifications 未装饰 pushNotification/未注册路由')

  return {
    push: (userId, payload) => push!(userId, payload),
    connect: async (opts) => {
      const socket = makeSocket(opts)
      routeHandler!(socket, { query: { token: 'x' } })
      await flush()
      return socket
    },
    warns,
  }
}

describe('F-116 ws-notifications:超阈值跳过本帧 + 写失败摘线', () => {
  it('慢消费者超阈值 ⇒ 不 send、连接保留;健康连接照收且帧格式不变', async () => {
    const hz = await buildNotificationsHarness()
    const slow = await hz.connect({ bufferedAmount: OVER })
    const healthy = await hz.connect()

    hz.push(h.userId, { id: 'n1' })

    expect(slow.sendCalls, '超阈值还调用 send = 写队列继续堆积').toBe(0)
    expect(healthy.sent).toHaveLength(1)
    expect(JSON.parse(healthy.sent[0]!)).toEqual({ type: 'notification', data: { id: 'n1' } })
    // 跳过不是断开:连接仍在表里,恢复读取后继续收新帧
    slow.bufferedAmount = 0
    hz.push(h.userId, { id: 'n2' })
    expect(slow.sent).toHaveLength(1)
    expect(JSON.parse(slow.sent[0]!).data).toEqual({ id: 'n2' })
    expect(slow.closeCalls).toHaveLength(0)
    expect(hz.warns.some((w) => w.msg.includes('写队列超阈值'))).toBe(true)
  })

  it('ws.send callback 报错 ⇒ 死连接被摘除(后续帧不再命中它)', async () => {
    const hz = await buildNotificationsHarness()
    const dead = await hz.connect({ failMode: 'callback' })
    const healthy = await hz.connect()

    hz.push(h.userId, { id: 'n1' })
    expect(dead.sendCalls, '第一帧应当尝试过').toBe(1)
    expect(healthy.sent).toHaveLength(1)

    hz.push(h.userId, { id: 'n2' })
    // 摘线生效:第二帧不再交给死连接
    expect(dead.sendCalls).toBe(1)
    expect(healthy.sent).toHaveLength(2)
  })
})

// ────────────────────────────── ② ws-broadcast ──────────────────────────────

async function buildBroadcastHarness(): Promise<{
  broadcast: (
    event: string,
    data?: unknown,
  ) => { matched: number; delivered: number; gated: number }
  connect: (opts?: { bufferedAmount?: number; failMode?: FailMode }) => Promise<FakeSocket>
}> {
  let broadcast:
    | ((
        userId: string,
        event: string,
        data: unknown,
      ) => {
        matched: number
        delivered: number
        gated: number
      })
    | null = null
  let routeHandler: RouteHandler | null = null

  const server = {
    metrics: { wsDisconnectsTotal: 0, wsBroadcastDroppedFramesTotal: 0 },
    log: { warn(): void {}, info(): void {} },
    decorate(name: string, fn: unknown): void {
      if (name === 'broadcastToUser') {
        broadcast = fn as (
          userId: string,
          event: string,
          data: unknown,
        ) => { matched: number; delivered: number; gated: number }
      }
    },
    get(_url: string, _opts: unknown, handler: unknown): void {
      routeHandler = handler as RouteHandler
    },
  }

  await (wsBroadcast as unknown as (s: unknown, o: unknown) => Promise<void>)(server, {})
  if (!broadcast || !routeHandler) throw new Error('ws-broadcast 未装饰/未注册路由')

  return {
    broadcast: (event, data = {}) => broadcast!(h.userId, event, data),
    connect: async (opts) => {
      const socket = makeSocket(opts)
      await routeHandler!(socket, { query: { token: 'x' } })
      return socket
    },
  }
}

describe('F-116 ws-broadcast:超阈值跳过并如实不计入 delivered', () => {
  it('慢连接不 send、delivered 不虚报;健康连接照收;连接未被摘掉', async () => {
    const hz = await buildBroadcastHarness()
    const slow = await hz.connect({ bufferedAmount: OVER })
    const healthy = await hz.connect()

    const r = hz.broadcast('mcp:status', { state: 'connected' })

    expect(slow.sendCalls).toBe(0)
    expect(healthy.sent).toHaveLength(1)
    expect(r).toEqual({ matched: 2, delivered: 1, gated: 0 })

    slow.bufferedAmount = 0
    expect(hz.broadcast('mcp:status', { state: 'connected' })).toEqual({
      matched: 2,
      delivered: 2,
      gated: 0,
    })
    expect(slow.sent).toHaveLength(1)
  })

  it('callback 报错仍按既有语义摘线并计数(背压闸不改变失败路径)', async () => {
    const hz = await buildBroadcastHarness()
    await hz.connect({ failMode: 'callback' })
    hz.broadcast('tick', { n: 1 })
    expect(hz.broadcast('tick', { n: 2 })).toEqual({ matched: 0, delivered: 0, gated: 0 })
  })
})

// ────────────────────────────── ③ ws-chat(房间) ──────────────────────────────

async function buildChatHarness(): Promise<{
  broadcastRoom: (roomId: string, payload: unknown) => void
  connect: (
    roomId: string,
    opts?: { bufferedAmount?: number; failMode?: FailMode },
  ) => Promise<FakeSocket>
}> {
  let broadcastRoom: ((roomId: string, payload: unknown) => void) | null = null
  let routeHandler: RouteHandler | null = null

  const server = {
    log: { warn(): void {}, error(): void {}, info(): void {}, debug(): void {} },
    decorate(name: string, fn: unknown): void {
      if (name === 'broadcastRoom') broadcastRoom = fn as (roomId: string, payload: unknown) => void
    },
    get(path: string, a: unknown, b?: unknown): void {
      if (path === '/ws/room/:roomId') routeHandler = (b ?? a) as RouteHandler
    },
    post(): void {},
    delete(): void {},
    addHook(): void {},
  }

  await (wsChat as unknown as (s: unknown, o: unknown) => Promise<void>)(server, {})
  if (!broadcastRoom || !routeHandler) throw new Error('ws-chat 未装饰 broadcastRoom/未注册路由')

  const chatRoute = routeHandler
  return {
    broadcastRoom: (roomId, payload) => broadcastRoom!(roomId, payload),
    connect: async (roomId, opts) => {
      const socket = makeSocket(opts)
      chatRoute(socket, { params: { roomId }, query: {} })
      await flush()
      return socket
    },
  }
}

describe('F-116 ws-chat:房间广播超阈值跳过(有回放缓冲,不断线)', () => {
  it('慢成员不 send、健康成员照收;慢成员恢复后继续收', async () => {
    const hz = await buildChatHarness()
    const slow = await hz.connect('r1', { bufferedAmount: OVER })
    const healthy = await hz.connect('r1')
    // 连接时的 joined 回执各一帧
    expect(slow.sent.length).toBe(1)
    expect(healthy.sent.length).toBe(1)

    hz.broadcastRoom('r1', { type: 'text', text: 'hi' })

    expect(slow.sent).toHaveLength(1)
    expect(healthy.sent).toHaveLength(2)
    expect(JSON.parse(healthy.sent[1]!)).toEqual({ type: 'text', text: 'hi' })
    expect(slow.closeCalls).toHaveLength(0)

    slow.bufferedAmount = 0
    hz.broadcastRoom('r1', { type: 'text', text: 'again' })
    expect(slow.sent).toHaveLength(2)
  })
})

// ────────────────────────────── ④ ws-customer-service(1:1) ──────────────────────────────

async function buildCsHarness(): Promise<{
  connect: (opts?: { bufferedAmount?: number; failMode?: FailMode }) => Promise<FakeSocket>
}> {
  let routeHandler: RouteHandler | null = null
  const server = {
    log: { warn(): void {}, error(): void {}, info(): void {} },
    decorate(): void {},
    get(_url: string, _opts: unknown, handler: unknown): void {
      routeHandler = handler as RouteHandler
    },
  }

  await (wsCustomerService as unknown as (s: unknown, o: unknown) => Promise<void>)(server, {})
  if (!routeHandler) throw new Error('ws-customer-service 未注册路由')

  const csRoute = routeHandler
  return {
    connect: async (opts) => {
      const socket = makeSocket(opts)
      csRoute(socket, { query: { token: 'x', sessionId: 'sess-1' } })
      await flush()
      return socket
    },
  }
}

describe('F-116 ws-customer-service:会话超阈值断开连接(无回放缓冲)', () => {
  it('慢连接被 close(4002) 并移出会话;健康连接照收消息', async () => {
    h.session = {
      sessionId: 'sess-1',
      userId: h.userId,
      status: 'active',
      agentId: null,
      queuePosition: 0,
    }
    const hz = await buildCsHarness()
    const slow = await hz.connect({ bufferedAmount: OVER })
    const healthy = await hz.connect()
    // 连接确认帧各一
    expect(slow.sent).toHaveLength(1)
    expect(healthy.sent).toHaveLength(1)

    await healthy.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'cs_message', data: { content: 'hello' } })),
    )

    // 断开而不是丢帧:客户端收到 close 后重连并重新拉取会话
    expect(slow.closeCalls).toEqual([{ code: 4002, reason: '接收过慢,连接已断开' }])
    expect(slow.sent).toHaveLength(1)
    // 健康连接照收(连自己发的也照常广播,既有语义不变)
    expect(healthy.sent).toHaveLength(2)
    expect(JSON.parse(healthy.sent[1]!)).toMatchObject({ type: 'cs_message' })

    // 已移出会话:再来一条不会再命中慢连接
    await healthy.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'cs_message', data: { content: 'again' } })),
    )
    expect(slow.closeCalls).toHaveLength(1)
    expect(slow.sendCalls).toBe(1)
  })

  it('正常连接行为不变:两端都能收到 cs_typing', async () => {
    h.session = {
      sessionId: 'sess-1',
      userId: h.userId,
      status: 'active',
      agentId: null,
      queuePosition: 0,
    }
    const hz = await buildCsHarness()
    const a = await hz.connect()
    const b = await hz.connect()

    await a.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'cs_typing', data: { isTyping: true } })),
    )

    expect(a.sent).toHaveLength(2)
    expect(b.sent).toHaveLength(2)
    expect(a.sent.every((f) => !f.includes('"error"'))).toBe(true)
    expect(a.closeCalls).toHaveLength(0)
    expect(b.closeCalls).toHaveLength(0)
  })
})

// ────────────────────────────── 形态锁:阈值/判定不在四文件里各写一份 ──────────────────────────────

describe('F-116 形态锁:阈值单点、四条链路都接同一个工具', () => {
  const src = (name: string): string =>
    readFileSync(fileURLToPath(new URL(`../src/plugins/${name}`, import.meta.url)), 'utf8')
  const chains = ['ws-notifications.ts', 'ws-chat.ts', 'ws-customer-service.ts', 'ws-broadcast.ts']

  it.each(chains)('%s 从 ws-backpressure 取阈值与发送单点,不留自己的魔数', (name) => {
    const text = src(name)
    expect(text).toContain("from './ws-backpressure.js'")
    expect(text, '各文件不得再写一份阈值').not.toContain('1024 * 1024')
  })

  it('桶的取值只在工具文件里出现一次', () => {
    expect(src('ws-backpressure.ts').match(/1024 \* 1024/g)).toHaveLength(1)
  })

  it('四条链路都使用 sendWithBackpressure 或 isWsBackpressured', () => {
    for (const name of chains) {
      const text = src(name)
      expect(
        text.includes('sendWithBackpressure(') || text.includes('isWsBackpressured('),
        `${name} 未接背压闸`,
      ).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
