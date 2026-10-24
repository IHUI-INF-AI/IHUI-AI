// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L9242(G-998164)ws-broadcast 按连接角色门控事件面 —— 装车回归。
 *
 * 票面三要件:
 *   ① 门控必须是收窄:未声明角色的连接('all' 缺省)= 既有语义,一帧不落;
 *   ② 不合面 ⇒ no-op:可断言的返回值(gated 计数),不抛错、不断连接;
 *   ③ 其他连接不受影响:同一 userId 下不合面连接被跳过时,合面连接照收。
 *
 * G-201:发射帧类别与连接档位改由**服务端按连接身份推导** —— 调用方自报的
 * eventClass / ?role= 统一降级为「可选收窄」,矛盾或想放宽 ⇒ 以推导为准 + warn。
 *
 * harness 形态取自 ws-broadcast-dropped-counter.test.ts(不连库、不监听端口,
 * 直接驱动真实插件装饰出的 broadcastToUser 与真实路由 handler)。
 */
import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'

// 工厂内不引用外层 const(vi.mock 提升早于模块求值),字面量与 USER_A 保持一致。
vi.mock('../src/plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => 'aaaaaaaa-1111-4111-8111-111111111111'),
  WS_CLOSE: { TOO_MANY_CONNECTIONS: 1013 },
  WsUserConnectionLimiter: class {
    acquire(): boolean {
      return true
    }
    release(): void {}
  },
}))
vi.mock('../src/plugins/ws-auto-recovery.js', () => ({
  getWsAutoRecoveryManager: () => ({ setFastify: () => {}, registerPlugin: () => {} }),
}))

import {
  wsBroadcast,
  deriveConnectionRole,
  resolveBroadcastRole,
  resolveBroadcastFrameClass,
} from '../src/plugins/ws-broadcast.js'
import type { BroadcastResult } from '../src/plugins/ws-broadcast.js'

const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'

type BroadcastFn = (
  userId: string,
  event: string,
  data: unknown,
  opts?: { eventClass?: 'conversation' | 'mcp' },
) => BroadcastResult

interface FakeSocket {
  sent: string[]
  send: (msg: string, cb?: (err?: Error) => void) => void
  on: (ev: string, cb: () => void) => void
  close: () => void
  emitClose: () => void
}

async function buildHarness(): Promise<{
  broadcast: (
    event: string,
    data?: unknown,
    opts?: { eventClass?: 'conversation' | 'mcp' },
  ) => BroadcastResult
  connect: (role?: string) => Promise<FakeSocket>
  /** G-201:捕获 server.log.warn,断言"矛盾不静默覆盖" */
  warns: Array<{ fields: Record<string, unknown>; msg: string }>
}> {
  const app = Fastify()
  await app.ready()

  let broadcastFn: BroadcastFn | null = null
  let routeHandler:
    ((socket: FakeSocket, request: { query: Record<string, string> }) => Promise<void>) | null =
    null

  const warns: Array<{ fields: Record<string, unknown>; msg: string }> = []
  const server = {
    // server.metrics 缺席 ⇒ noteDropped 的 `if (server.metrics)` 分支自关,本票不碰计数器。
    log: {
      warn: (fields: Record<string, unknown>, msg: string): void => {
        warns.push({ fields, msg })
      },
    },
    decorate(name: string, fn: unknown): void {
      if (name === 'broadcastToUser') broadcastFn = fn as BroadcastFn
    },
    get(_url: string, _opts: unknown, handler: unknown): void {
      routeHandler = handler as (
        socket: FakeSocket,
        request: { query: Record<string, string> },
      ) => Promise<void>
    },
  }

  await (wsBroadcast as unknown as (s: unknown, o: unknown) => Promise<void>)(server, {})
  if (!broadcastFn || !routeHandler) throw new Error('ws-broadcast 未装饰/未注册路由')

  const makeSocket = (): FakeSocket => {
    const handlers: Record<string, Array<() => void>> = {}
    const socket: FakeSocket = {
      sent: [],
      send(msg: string, cb?: (err?: Error) => void) {
        socket.sent.push(msg)
        cb?.()
      },
      on(ev: string, cb: () => void) {
        ;(handlers[ev] ??= []).push(cb)
      },
      close: () => {},
      emitClose: () => {
        for (const fn of handlers.close ?? []) fn()
      },
    }
    return socket
  }

  return {
    broadcast: (event, data = {}, opts) => broadcastFn!(USER_A, event, data, opts),
    connect: async (role?: string): Promise<FakeSocket> => {
      const socket = makeSocket()
      const query: Record<string, string> = { token: 'x' }
      if (role !== undefined) query.role = role
      await routeHandler!(socket, { query })
      return socket
    },
    warns,
  }
}

describe('L9242 ws-broadcast 按连接角色门控事件面', () => {
  it('① 正向:声明 mcp 角色的连接收到 mcp:status 帧', async () => {
    const h = await buildHarness()
    const mcp = await h.connect('mcp')

    const r = h.broadcast('mcp:status', { server: 's1', state: 'connected' })

    expect(r).toEqual({ matched: 1, delivered: 1, gated: 0 })
    expect(mcp.sent).toHaveLength(1)
    expect(JSON.parse(mcp.sent[0]!).event).toBe('mcp:status')
  })

  it('② 正向:未声明角色的连接 = 既有语义,conversation 与 mcp 两类照收', async () => {
    const h = await buildHarness()
    const legacy = await h.connect()

    const r1 = h.broadcast('conversation:updated', { conversationId: 'c1' })
    const r2 = h.broadcast('mcp:status', { server: 's1', state: 'connected' })

    expect(r1.delivered).toBe(1)
    expect(r1.gated).toBe(0)
    expect(r2.delivered).toBe(1)
    expect(legacy.sent).toHaveLength(2)
  })

  it('③ 反向 no-op:mcp 角色连接对 conversation:updated 是 no-op,同 userId 的默认连接照收,不断连', async () => {
    const h = await buildHarness()
    const gated = await h.connect('mcp')
    const legacy = await h.connect()

    expect(() => h.broadcast('conversation:updated', { conversationId: 'c1' })).not.toThrow()

    // 不合面连接:一帧未收
    expect(gated.sent).toHaveLength(0)
    // 其他连接不受影响:默认连接照收该帧
    expect(legacy.sent).toHaveLength(1)
    expect(JSON.parse(legacy.sent[0]!).event).toBe('conversation:updated')

    // 门控后连接未断:同类帧照收;'all' 角色的默认连接也不被门控(可断言的"不断开")
    const r = h.broadcast('mcp:status', { server: 's1', state: 'connected' })
    expect(r).toEqual({ matched: 2, delivered: 2, gated: 0 })
    expect(gated.sent).toHaveLength(1)
    expect(JSON.parse(gated.sent[0]!).event).toBe('mcp:status')
    expect(legacy.sent).toHaveLength(2)
  })

  it('④ 反向 no-op 返回值可断言:gated 计数精确、delivered=0', async () => {
    const h = await buildHarness()
    const gated = await h.connect('conversation')

    const r = h.broadcast('mcp:status', { server: 's1', state: 'connected' })

    expect(r.matched).toBe(1)
    expect(r.delivered).toBe(0)
    expect(r.gated).toBe(1)
    expect(gated.sent).toHaveLength(0)
  })

  it('⑤ G-201:显式 eventClass 不再压过事件名推导 — 谎报回落推导 + warn;无前缀事件自报仍作收窄', async () => {
    const h = await buildHarness()
    const gated = await h.connect('mcp')
    const legacy = await h.connect()

    // 谎报:事件名是 conversation:updated,调用方声明 mcp ⇒ 服务端推导优先(按 conversation 门控)。
    // 把推导摘回"信调用方"时,mcp 连接会在这里收到 conversation 帧 —— 变异自证。
    const r1 = h.broadcast('conversation:updated', { conversationId: 'c1' }, { eventClass: 'mcp' })
    expect(r1).toEqual({ matched: 2, delivered: 1, gated: 1 })
    expect(gated.sent).toHaveLength(0)
    expect(legacy.sent).toHaveLength(1)
    // 矛盾不静默覆盖:warn 带 declared/applied 出声
    expect(h.warns).toHaveLength(1)
    expect(h.warns[0]!.fields).toMatchObject({
      event: 'conversation:updated',
      declared: 'mcp',
      applied: 'conversation',
    })

    // 无前缀事件 + 声明 eventClass ⇒ 推导不出,自报仍作收窄生效(既有语义保留)
    const r2 = h.broadcast('ops:custom', { n: 1 }, { eventClass: 'conversation' })
    expect(r2).toEqual({ matched: 2, delivered: 1, gated: 1 })
    expect(gated.sent).toHaveLength(0)
    expect(legacy.sent).toHaveLength(2)

    // 无前缀 + 未声明 ⇒ cls = null ⇒ 谁都不门控;且不新增 warn
    const r3 = h.broadcast('ops:custom', { n: 2 })
    expect(r3).toEqual({ matched: 2, delivered: 2, gated: 0 })
    expect(gated.sent).toHaveLength(1)
    expect(legacy.sent).toHaveLength(3)
    expect(h.warns).toHaveLength(1)
  })

  it('⑥ 非法 role 值回落 all(收窄提示不是安全门,不断连)', async () => {
    const h = await buildHarness()
    const conn = await h.connect('nonsense-role')

    const r = h.broadcast('conversation:updated', { conversationId: 'c1' })

    expect(r.delivered).toBe(1)
    expect(conn.sent).toHaveLength(1)
  })
})

/**
 * G-201 身份判定出口(纯函数单测):钉死推导表形状与「自报只许收窄不许放宽」规则。
 * 摘掉出口(改回无条件采信自报)时,下面 rejected 断言必红。
 */
describe('G-201 身份判定出口', () => {
  it('deriveConnectionRole:现存两个身份组合都推导 ceiling=all(今日实测事实)', () => {
    expect(deriveConnectionRole('ws-broadcast', 'user-session')).toBe('all')
    expect(deriveConnectionRole('public-socket', 'admin-session')).toBe('all')
  })

  it('resolveBroadcastRole:无自报 = ceiling;合法收窄生效;非法值回落 ceiling + rejected', () => {
    expect(resolveBroadcastRole({ channel: 'ws-broadcast', principal: 'user-session' })).toEqual({
      role: 'all',
    })
    expect(
      resolveBroadcastRole({ channel: 'ws-broadcast', principal: 'user-session', declared: 'mcp' }),
    ).toEqual({ role: 'mcp' })
    expect(
      resolveBroadcastRole({
        channel: 'public-socket',
        principal: 'admin-session',
        declared: 'conversation',
      }),
    ).toEqual({ role: 'conversation' })
    expect(
      resolveBroadcastRole({
        channel: 'ws-broadcast',
        principal: 'user-session',
        declared: 'nonsense-role',
      }),
    ).toEqual({ role: 'all', rejected: 'nonsense-role' })
  })

  it('resolveBroadcastFrameClass:推导优先,矛盾 rejected;无前缀自报作收窄;两者皆无 = 不门控', () => {
    expect(resolveBroadcastFrameClass('conversation:updated')).toEqual({ cls: 'conversation' })
    expect(resolveBroadcastFrameClass('mcp:status', 'mcp')).toEqual({ cls: 'mcp' })
    expect(resolveBroadcastFrameClass('conversation:updated', 'mcp')).toEqual({
      cls: 'conversation',
      rejected: 'mcp',
    })
    expect(resolveBroadcastFrameClass('ops:custom', 'mcp')).toEqual({ cls: 'mcp' })
    expect(resolveBroadcastFrameClass('ops:custom')).toEqual({ cls: null })
  })
})
