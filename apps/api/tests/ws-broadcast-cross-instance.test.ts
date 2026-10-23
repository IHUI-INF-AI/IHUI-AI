// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍‌​‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D125 另批收口(2026-10-23)/ws/broadcast 跨实例桥接 —— 零真库、零真 Redis。
 * 设计稿 §4.3"多实例缺口"结清:两假 server(各带 redis 桩)共享一条内存总线,
 * 钉死四格:
 *  ① B 实例 broadcastToUser ⇒ A 实例上的 socket 收帧(跨实例送达);
 *  ② 桥接路径如实返回全零计数(本机账不可观测),且**本机连接不双发** ——
 *     publish 回环进本实例 subscriber,由 pmessage 恰好投一次(与 ws-notifications 同调);
 *  ③ 桥接路径仍走**同一**角色门控(mcp 档连接对 conversation 帧是 no-op);
 *  ④ publish 异步失败 ⇒ warn 出声、不静默;载荷 eventClass 取服务端推导(谎报被纠)。
 *
 * FakeRedis 先例照 account-lockout.test.ts(vi.mock('ioredis') 类替身);
 * 假 server harness 照 ws-broadcast-role-gate.test.ts(不连库、不监听端口)。
 */
import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'

const { bus } = vi.hoisted(() => {
  const subs: Array<{ pattern: string; cb: (channel: string, message: string) => void }> = []
  return {
    bus: {
      subs,
      published: [] as Array<{ channel: string; message: string }>,
      rejectNextPublish: false,
      /** 内存总线:publish 同步投递给所有 pattern 匹配者(含发射实例自己的回环) */
      publish(channel: string, message: string): number {
        this.published.push({ channel, message })
        let n = 0
        for (const s of this.subs) {
          if (channel.startsWith(s.pattern.slice(0, -1))) {
            s.cb(channel, message)
            n += 1
          }
        }
        return n
      },
    },
  }
})

vi.mock('ioredis', () => {
  class FakeRedis {
    private handlers: Record<string, Array<(...args: unknown[]) => void>> = {}
    constructor(_url?: string, _opts?: unknown) {}
    on(ev: string, cb: (...args: unknown[]) => void): void {
      ;(this.handlers[ev] ??= []).push(cb)
    }
    async psubscribe(pattern: string): Promise<string> {
      bus.subs.push({
        pattern,
        cb: (channel, message) => {
          for (const h of this.handlers['pmessage'] ?? []) h(pattern, channel, message)
        },
      })
      return 'OK'
    }
    publish(channel: string, message: string): Promise<number> {
      if (bus.rejectNextPublish) {
        bus.rejectNextPublish = false
        return Promise.reject(new Error('redis down (mock)'))
      }
      return Promise.resolve(bus.publish(channel, message))
    }
    async quit(): Promise<string> {
      return 'OK'
    }
  }
  return { default: FakeRedis }
})

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

import IORedis from 'ioredis'
import { wsBroadcast, type BroadcastResult } from '../src/plugins/ws-broadcast.js'

const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'

type BroadcastFn = (
  userId: string,
  event: string,
  data: unknown,
  opts?: { eventClass?: 'conversation' | 'mcp' | 'collab' },
) => BroadcastResult

interface FakeSocket {
  sent: string[]
  send: (msg: string, cb?: (err?: Error) => void) => void
  on: (ev: string, cb: () => void) => void
  close: () => void
}

interface Instance {
  broadcast: (
    event: string,
    data?: unknown,
    opts?: { eventClass?: 'conversation' | 'mcp' | 'collab' },
  ) => BroadcastResult
  connect: (role?: string) => Promise<FakeSocket>
  warns: Array<{ fields: Record<string, unknown>; msg: string }>
}

async function buildInstance(): Promise<Instance> {
  const app = Fastify()
  await app.ready()

  let broadcastFn: BroadcastFn | null = null
  let routeHandler:
    ((socket: FakeSocket, request: { query: Record<string, string> }) => Promise<void>) | null =
    null

  const warns: Array<{ fields: Record<string, unknown>; msg: string }> = []
  const server = {
    log: {
      warn: (fields: Record<string, unknown>, msg: string): void => {
        warns.push({ fields, msg })
      },
      info: (): void => {},
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
    addHook(): void {},
    // 桥接的开关与 publisher:redis 存在 ⇒ 插件建 subscriber + publish 走这条总线
    redis: new IORedis(),
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

describe('D125 ws-broadcast 跨实例桥接', () => {
  it('① B 实例发射 ⇒ A 实例 socket 收帧;返回全零;频道/载荷形态正确', async () => {
    const A = await buildInstance()
    const B = await buildInstance()
    bus.published.length = 0

    const aSock = await A.connect()
    const r = B.broadcast('conversation:updated', { conversationId: 'c1' })

    // 桥接路径本机账不可观测 ⇒ 如实全零(不是"送达 0 = 失败"的假信号)
    expect(r).toEqual({ matched: 0, delivered: 0, gated: 0 })
    expect(bus.published).toHaveLength(1)
    expect(bus.published[0]!.channel).toBe(`broadcast:${USER_A}`)
    expect(JSON.parse(bus.published[0]!.message)).toMatchObject({
      event: 'conversation:updated',
      eventClass: 'conversation',
    })
    expect(aSock.sent).toHaveLength(1)
    expect(JSON.parse(aSock.sent[0]!)).toMatchObject({ event: 'conversation:updated' })
  })

  it('② 本机不双发:两实例各有连接时,每 socket 恰收 1 帧(回环经 pmessage 恰投一次)', async () => {
    const A = await buildInstance()
    const B = await buildInstance()
    const aSock = await A.connect()
    const bSock = await B.connect()

    A.broadcast('collab:lock', { conversationId: 'c1' })

    expect(aSock.sent).toHaveLength(1)
    expect(bSock.sent).toHaveLength(1)
  })

  it('③ 桥接路径门控与本机同判据:mcp 档连接对 conversation 帧仍 no-op', async () => {
    const A = await buildInstance()
    const B = await buildInstance()
    const gated = await A.connect('mcp')

    B.broadcast('conversation:updated', { conversationId: 'c1' })

    expect(gated.sent).toHaveLength(0)
    // 同类帧照收(门控是收窄不是断链)
    B.broadcast('mcp:status', { server: 's1', state: 'connected' })
    expect(gated.sent).toHaveLength(1)
  })

  it('④ publish 异步失败 ⇒ warn 出声不静默;谎报 eventClass 被推导纠正后跨实例仍同判据', async () => {
    const A = await buildInstance()
    const B = await buildInstance()
    const aSock = await A.connect()

    // 谎报:事件名 conversation:updated,声明 mcp ⇒ 服务端推导优先 + warn(发射侧出声)
    bus.published.length = 0
    B.broadcast('conversation:updated', { conversationId: 'c1' }, { eventClass: 'mcp' })
    expect(B.warns.some((w) => w.msg.includes('矛盾'))).toBe(true)
    expect(JSON.parse(bus.published[0]!.message).eventClass).toBe('conversation')
    expect(aSock.sent).toHaveLength(1)

    // publish 失败:warn 出声,返回仍全零(不假装本机直投成功)
    bus.rejectNextPublish = true
    const r = B.broadcast('mcp:status', { server: 's1', state: 'connected' })
    await Promise.resolve() // 让 .catch 落地
    expect(r).toEqual({ matched: 0, delivered: 0, gated: 0 })
    expect(B.warns.some((w) => w.msg.includes('publish 失败'))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍‌​‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
