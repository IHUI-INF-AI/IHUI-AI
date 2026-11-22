// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ws-chat 断线补发 / 幂等去重 / 跨实例限流接线的行为锁(2026-11-01)。
 *
 * 这三枚工具模块(`ws-dedup` / `ws-rate-limit` / `ws-replay-buffer`)自旧架构迁移过来后
 * 一直只有 import、没有生产调用点(守门 121 现读点名)。本用例钉的是**装上车之后的线形**:
 * 补发只补加入时刻之前的、去重键必须带发信人作用域、限流拒绝走 4002 且不广播、
 * system 帧不进回放缓冲、不带 since 就一次都不读缓冲。
 *
 * 判据一律走真实处理器 + 真实工具模块(真 Fastify + 真 ws 客户端),只把 ioredis 换成
 * 替身;不在测试里重写一遍控制流(§22c)。测试不连生产 Redis/PG。
 */
import { createHash } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import { WebSocket } from 'ws'
import { wsChat } from '../../src/plugins/ws-chat.js'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
})

/** 替身读数:测试断言全部从这里取,不猜时序 */
const h = vi.hoisted(() => {
  const reset = (): void => {
    h.dedupKeys.length = 0
    h.replayReads.length = 0
    h.buffered.length = 0
    h.seen.clear()
    h.zcard.value = 1
    h.lrange.value = []
  }
  return {
    dedupKeys: [] as string[],
    replayReads: [] as string[],
    /** 进回放缓冲的 (房间 key, 信封 JSON) */
    buffered: [] as { key: string; value: string }[],
    /** 已存在的去重键:SET ... NX 的"键已在"臂靠它复现 */
    seen: new Set<string>(),
    /** 滑动窗口 zcard 的脚本值:>BURST(50) 才让 checkWsRateLimit 判超限 */
    zcard: { value: 1 },
    /** ws:replay:<room> 的原始列表内容 */
    lrange: { value: [] as string[] },
    reset,
  }
})

vi.mock('ioredis', () => {
  class FakeRedis {
    on(): void {
      /* 订阅器与工具层的 error 监听在替身下不产事件 */
    }
    async psubscribe(): Promise<string> {
      return 'PSUBSCRIBE'
    }
    async quit(): Promise<string> {
      return 'OK'
    }
    async publish(): Promise<number> {
      return 0
    }
    /** 只服务 `SET key val EX ttl NX` 形态(去重的那一格) */
    async set(
      key: string,
      _value: string,
      ...args: Array<string | number>
    ): Promise<string | null> {
      h.dedupKeys.push(key)
      if (args.includes('NX')) {
        if (h.seen.has(key)) return null
        h.seen.add(key)
      }
      return 'OK'
    }
    async lrange(key: string, _start: number, _stop: number): Promise<string[]> {
      h.replayReads.push(key)
      return h.lrange.value
    }
    pipeline(): {
      rpush: (...a: unknown[]) => never
      ltrim: (...a: unknown[]) => never
      expire: (...a: unknown[]) => never
      zremrangebyscore: (...a: unknown[]) => never
      zadd: (...a: unknown[]) => never
      zcard: (...a: unknown[]) => never
      pexpire: (...a: unknown[]) => never
      exec: () => Promise<Array<[null, unknown]>>
    } {
      const calls: Array<{ name: string; args: unknown[] }> = []
      // 链式 API:每个命令记一笔,exec 时按调用序回吐 [err, result](zcard 取脚本值)
      const p = {
        rpush: (...args: unknown[]) => track('rpush', args),
        ltrim: (...args: unknown[]) => track('ltrim', args),
        expire: (...args: unknown[]) => track('expire', args),
        zremrangebyscore: (...args: unknown[]) => track('zremrangebyscore', args),
        zadd: (...args: unknown[]) => track('zadd', args),
        zcard: (...args: unknown[]) => track('zcard', args),
        pexpire: (...args: unknown[]) => track('pexpire', args),
        exec: async (): Promise<Array<[null, unknown]>> =>
          calls.map(({ name, args }) => {
            if (name === 'rpush') h.buffered.push({ key: String(args[0]), value: String(args[1]) })
            if (name === 'zcard') return [null, h.zcard.value]
            return [null, 1]
          }),
      }
      const track = (name: string, args: unknown[]): never => {
        calls.push({ name, args })
        // 真 ioredis 返回 pipeline 自身以便链式;类型上写成 never 会逼调用方只用 exec
        return p as never
      }
      return p
    }
  }
  return { default: FakeRedis }
})

// 只用 HTTP 错误分支的翻译函数;真模块会把整个 shared 包拖进来(与本票判据无关)
vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: (e: unknown): string => String(e),
}))

vi.mock('../../src/plugins/auth.js', () => ({
  authenticate: async (): Promise<void> => undefined,
}))

vi.mock('../../src/plugins/ws-helpers.js', () => ({
  WS_CLOSE: { TOO_MANY_CONNECTIONS: 4005, RATE_LIMITED: 4002 },
  WsUserConnectionLimiter: class {
    acquire(): boolean {
      return true
    }
    release(): void {
      /* 槽位与本票判据无关 */
    }
    currentCount(): number {
      return 1
    }
  },
  WsRateLimiter: class {
    allow(): boolean {
      return true
    }
    reset(): void {
      /* 本机防洪窗口刻意放开:本票要量的是跨实例那一层 */
    }
  },
  wsAuth: async (_socket: unknown, token?: string): Promise<string | null> =>
    token === 'valid' ? 'u-1' : null,
}))

const dedupKeyFor = (scopedId: string): string =>
  `ws:dedup:${createHash('sha256').update(scopedId).digest('hex')}`

interface Session {
  client: WebSocket
  /** 服务端已推给本连接的业务帧(排除 join/left 等房间事件) */
  frames: Array<Record<string, unknown>>
  closed: Promise<number>
}

function open(port: number, path: string): Session {
  const client = new WebSocket(`ws://127.0.0.1:${port}${path}`)
  const frames: Array<Record<string, unknown>> = []
  client.on('message', (buf) => {
    const obj = JSON.parse(buf.toString()) as Record<string, unknown>
    if (obj.type !== 'room') frames.push(obj)
  })
  const closed = new Promise<number>((resolve) => {
    client.on('close', (code) => resolve(code))
  })
  return { client, frames, closed }
}

async function waitUntil(pred: () => boolean, ms = 3000): Promise<void> {
  const until = Date.now() + ms
  while (!pred()) {
    if (Date.now() > until)
      throw new Error(`等待超时,当前替身读数=${JSON.stringify(h.buffered.length)}`)
    await new Promise((r) => setTimeout(r, 10))
  }
}

async function opened(port: number, path: string): Promise<Session> {
  const s = open(port, path)
  await new Promise<void>((resolve, reject) => {
    s.client.on('open', () => resolve())
    s.client.on('error', reject)
  })
  return s
}

describe('ws-chat 回放/去重/跨实例限流接线', () => {
  let server: FastifyInstance
  let port = 0

  beforeAll(async () => {
    server = Fastify({ logger: false })
    await server.register(fastifyWebsocket)
    // 插件按 server.redis 取连接(getRedis()):替身只服务 IDOR 判定与本机持久化
    Object.assign(server, {
      redis: {
        async hgetall(): Promise<Record<string, string>> {
          return {}
        },
        async sismember(): Promise<number> {
          return 1
        },
        async sadd(): Promise<number> {
          return 1
        },
        async srem(): Promise<number> {
          return 1
        },
        async expire(): Promise<number> {
          return 1
        },
        async publish(): Promise<number> {
          return 0
        },
        async lpush(): Promise<number> {
          return 1
        },
        async ltrim(): Promise<string> {
          return 'OK'
        },
      },
    })
    await server.register(wsChat)
    await server.listen({ port: 0, host: '127.0.0.1' })
    const address = server.server.address()
    if (address === null || typeof address === 'string') throw new Error('未能取得监听端口')
    port = address.port
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    h.reset()
  })

  it('① 带 since 重连:只补发加入时刻之前的缓冲帧,按序推给该连接', async () => {
    const past = Date.now() - 60_000
    const future = Date.now() + 60_000
    h.lrange.value = [
      JSON.stringify({ ts: past, data: { id: 'm-old', type: 'text', text: 'old', ts: past } }),
      JSON.stringify({ ts: future, data: { id: 'm-new', type: 'text', text: 'new', ts: future } }),
    ]
    const s = await opened(port, '/ws/room/r1?token=valid&since=1')
    await waitUntil(() => s.frames.some((f) => f.id === 'm-old'))
    s.client.close()
    expect(
      s.frames.map((f) => f.id),
      '加入之后的消息会实时到达,补发不得再送一次',
    ).toEqual(['m-old'])
    expect(h.replayReads).toContain('ws:replay:r1')
  })

  it('② 不带 since:一次都不读回放缓冲(默认连接不多挂 await)', async () => {
    const s = await opened(port, '/ws/room/r1?token=valid')
    s.client.send(JSON.stringify({ type: 'text', text: 'hi' }))
    await waitUntil(() => h.buffered.length === 1)
    expect(h.replayReads, '缺省不补发').toHaveLength(0)
    s.client.close()
  })

  it('③ 同一发信人的重复 clientMessageId 只处理一次,且去重键带发信人作用域', async () => {
    const peer = await opened(port, '/ws/room/r1?token=valid')
    const s = await opened(port, '/ws/room/r1?token=valid')
    const frame = JSON.stringify({ type: 'text', text: 'hi', clientMessageId: 'cm-1' })
    s.client.send(frame)
    s.client.send(frame)
    await waitUntil(() => h.dedupKeys.length === 2)
    // 两帧都真去查了键,但第二帧命中"键已存在" ⇒ 只广播一次
    expect(h.dedupKeys[0], '裸 id 会让他人抢先占键静默吞消息').toBe(dedupKeyFor('u-1:cm-1'))
    expect(peer.frames.filter((f) => f.text === 'hi')).toHaveLength(1)
    s.client.close()
    peer.client.close()
  })

  it('④ 跨实例限流超限:连接以 4002 关闭,业务帧不得广播', async () => {
    h.zcard.value = 999
    const peer = await opened(port, '/ws/room/r2?token=valid')
    const s = await opened(port, '/ws/room/r2?token=valid')
    s.client.send(JSON.stringify({ type: 'text', text: 'flood' }))
    expect(await s.closed, '超限应由服务端关闭').toBe(4002)
    await new Promise((r) => setTimeout(r, 50))
    expect(
      peer.frames.filter((f) => f.text === 'flood'),
      '限流必须在广播之前拦住',
    ).toHaveLength(0)
    expect(h.buffered, '被限流的消息不进回放缓冲').toHaveLength(0)
    peer.client.close()
  })

  it('⑤ system 帧广播但不进回放缓冲', async () => {
    const s = await opened(port, '/ws/room/r3?token=valid')
    s.client.send(JSON.stringify({ type: 'text', text: 'kept' }))
    await waitUntil(() => h.buffered.length === 1)
    s.client.send(JSON.stringify({ type: 'system', text: 'sys' }))
    await new Promise((r) => setTimeout(r, 50))
    expect(h.buffered).toHaveLength(1)
    const envelope = JSON.parse(h.buffered[0]!.value) as { data?: { type?: string } }
    expect(envelope.data?.type).toBe('text')
    s.client.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
