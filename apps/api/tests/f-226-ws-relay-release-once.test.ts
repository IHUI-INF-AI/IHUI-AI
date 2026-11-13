// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-226 回归锁(2026-11-13)。
 *
 * 病灶:/ws/relay/ops 的 'error' 与 'close' 各自无条件调用 limiter.release(userId),
 * 而 WS 规范保证 error 之后必然 close ⇒ 同一连接归还两次槽位,maxPerUser=2 形同虚设
 * (每连接每 15s 触发一次重 DB 聚合快照,构成放大面)。
 *
 * 本文件锁:
 *   ① error + close 先后到达 → release 只发生一次、槽位只减一;
 *   ② 仅 close / 仅 error → 各恰好归还一次(不重复也不遗漏);
 *   ③ 重复 close / error-close 交错并发 → 幂等;
 *   ④ 源锁:处理器内只有一条 release 通道,close 与 error 挂同一个收口函数。
 *
 * 不监听真实端口:插件挂在假 server 上,处理函数用伪 socket/request 直接驱动。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  userId: '00000000-0000-4000-8000-0000000000f2',
  releases: [] as string[],
  acquires: 0,
  counts: new Map<string, number>(),
}))

vi.mock('../src/plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => h.userId),
  WS_CLOSE: { INVALID_TOKEN: 4003, TOO_MANY_CONNECTIONS: 4005 },
  WsUserConnectionLimiter: class {
    constructor(private readonly max = 8) {}
    acquire(userId: string): boolean {
      const current = h.counts.get(userId) ?? 0
      if (current >= this.max) return false
      h.counts.set(userId, current + 1)
      h.acquires++
      return true
    }
    release(userId: string): void {
      h.releases.push(userId)
      const current = h.counts.get(userId)
      if (current === undefined) return
      if (current <= 1) h.counts.delete(userId)
      else h.counts.set(userId, current - 1)
    }
  },
}))

vi.mock('@ihui/auth', () => ({
  verifyWsToken: vi.fn(async () => null),
  verifyAccessToken: vi.fn(async () => ({ userId: h.userId, roleId: 1 })),
}))

vi.mock('../src/services/relay-ops-snapshot.js', () => ({
  buildRelayOpsSnapshot: vi.fn(async () => ({})),
}))

import { wsRelayOps } from '../src/plugins/ws-relay-ops.js'

type SocketListener = (...args: unknown[]) => unknown
type RouteHandler = (socket: unknown, request: unknown) => Promise<void>

function makeFakeServer() {
  const routes = new Map<string, RouteHandler>()
  const server = {
    get: vi.fn((path: string, _opts: unknown, handler: RouteHandler) => {
      routes.set(path, handler)
    }),
    addHook: vi.fn(async () => {}),
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  return { server, routes }
}

function makeSocket() {
  const listeners = new Map<string, SocketListener[]>()
  const socket = {
    OPEN: 1,
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn((event: string, cb: SocketListener) => {
      const list = listeners.get(event) ?? []
      list.push(cb)
      listeners.set(event, list)
    }),
  }
  async function emit(event: string, ...args: unknown[]): Promise<void> {
    for (const cb of listeners.get(event) ?? []) await cb(...args)
  }
  return { socket, emit }
}

async function makeRelay(): Promise<RouteHandler> {
  const { server, routes } = makeFakeServer()
  await wsRelayOps(server as never, {})
  const handler = routes.get('/ws/relay/ops')
  if (!handler) throw new Error('ws 路由未注册')
  return handler
}

async function connect(handler: RouteHandler) {
  const { socket, emit } = makeSocket()
  await handler(socket, { query: { token: 'admin-token' } })
  return { socket, emit }
}

const SOURCE = readFileSync(
  fileURLToPath(new URL('../src/plugins/ws-relay-ops.ts', import.meta.url)),
  'utf8',
)

describe('F-226 /ws/relay/ops 每连接只归还一次连接槽位', () => {
  beforeEach(() => {
    h.releases.length = 0
    h.acquires = 0
    h.counts.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('error 后紧接 close → 只 release 一次,槽位只减一', async () => {
    const handler = await makeRelay()
    const a = await connect(handler)
    const b = await connect(handler)
    expect(h.acquires).toBe(2)
    expect(h.counts.get(h.userId)).toBe(2)

    await a.emit('error', new Error('boom'))
    await a.emit('close')

    expect(h.releases).toEqual([h.userId])
    expect(h.counts.get(h.userId)).toBe(1)
    expect(b.socket.close).not.toHaveBeenCalled()
  })

  it('仅 close → 恰好归还一次', async () => {
    const handler = await makeRelay()
    const a = await connect(handler)
    expect(h.counts.get(h.userId)).toBe(1)

    await a.emit('close')

    expect(h.releases).toEqual([h.userId])
    expect(h.counts.has(h.userId)).toBe(false)
  })

  it('仅 error → 恰好归还一次(不遗漏)', async () => {
    const handler = await makeRelay()
    const a = await connect(handler)
    await a.emit('error', new Error('boom'))
    expect(h.releases).toEqual([h.userId])
    expect(h.counts.has(h.userId)).toBe(false)
  })

  it('重复 close 幂等', async () => {
    const handler = await makeRelay()
    const a = await connect(handler)
    await a.emit('close')
    await a.emit('close')
    await a.emit('close')
    expect(h.releases).toEqual([h.userId])
  })

  it('error/close 交错并发 → 仍只归还一次', async () => {
    const handler = await makeRelay()
    const a = await connect(handler)
    await Promise.all([
      a.emit('error', new Error('boom')),
      a.emit('close'),
      a.emit('error', new Error('boom-2')),
      a.emit('close'),
    ])
    expect(h.releases).toEqual([h.userId])
  })

  it('源锁:处理器内只有一条 release 通道', () => {
    expect(SOURCE.match(/limiter\.release\(/g) ?? []).toHaveLength(1)
  })

  it('源锁:close 与 error 挂同一个收口函数', () => {
    const closeHandler = SOURCE.match(/socket\.on\('close',\s*(\w+)\)/)
    const errorHandler = SOURCE.match(/socket\.on\('error',\s*(\w+)\)/)
    expect(closeHandler).not.toBeNull()
    expect(errorHandler).not.toBeNull()
    expect(closeHandler?.[1]).toBe(errorHandler?.[1])
  })
})
