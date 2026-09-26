// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ws-chat 槽位租约的回归测试(2026-09-26 反向缺陷收口票)。
 *
 * 钉的是与"迟到回调多还一格"方向相反的那格:acquire 成功之后、socket.on('close')
 * 注册之前,还要过一次 await(IDOR 校验)。这一段里的任何退出路径若没人 release,
 * 该用户的连接计数就只增不减 —— 攒到上限后他连不上,而账面看不出为什么。
 *
 * 判据一律走**真实处理器**(真 Fastify + 真 ws 客户端),不重写一遍控制流:
 * 自己照抄一份再测,测的就是抄件而不是被审代码(§22c「镜像测试只复读实现就是复读机」)。
 * 被替身接管的只有三处外部依赖:Redis 连接(ioredis)/ 鉴权与限流原语(ws-helpers)/
 * HTTP 鉴权(auth)。替身的目的正是把"槽位"变成一个可直接读数的计数器。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import { WebSocket } from 'ws'
import { wsChat } from '../../src/plugins/ws-chat.js'

interface Counter {
  acquires: number
  releases: number
  balance: number
  /** 见到负数 = release 比 acquire 多(双还 ⇒ 限流统计穿负,比漏还更隐蔽) */
  minBalance: number
}

/** 共享状态必须造在 vi.hoisted 里:vi.mock 工厂在 import 阶段就会跑,那时模块顶层还没求值 */
const h = vi.hoisted(() => {
  const counters = new Map<
    string,
    {
      acquires: number
      releases: number
      balance: number
      minBalance: number
    }
  >()
  const limiterInstances: string[] = []
  const redisBehavior = {
    /** deny ⇒ hgetall 给出"别人建的房"且 sismember=0;allow ⇒ 房间不存在(放行) */
    ownership: 'allow' as 'allow' | 'deny',
    /** 测试手里捏着的闸门:让 IDOR 那次 await 停住,制造"await 窗口内断线" */
    gate: null as Promise<void> | null,
  }
  const one = (userId: string): Counter => {
    let c = counters.get(userId)
    if (!c) {
      c = { acquires: 0, releases: 0, balance: 0, minBalance: 0 }
      counters.set(userId, c)
    }
    return c
  }
  const total = (): number => {
    let n = 0
    for (const c of counters.values()) n += c.balance
    return n
  }
  const snapshot = (): { acquires: number; releases: number; minBalance: number } => {
    let acquires = 0
    let releases = 0
    let minBalance = 0
    for (const c of counters.values()) {
      acquires += c.acquires
      releases += c.releases
      minBalance = Math.min(minBalance, c.minBalance)
    }
    return { acquires, releases, minBalance }
  }
  return { counters, one, total, snapshot, limiterInstances, redisBehavior }
})

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
})

vi.mock('ioredis', () => {
  class FakeSubscriber {
    on(): void {
      /* 订阅器在测试里不产事件 */
    }
    async psubscribe(): Promise<string> {
      return 'PSUBSCRIBE'
    }
    async quit(): Promise<string> {
      return 'OK'
    }
  }
  return { default: FakeSubscriber }
})

// 只用 HTTP 错误分支的翻译函数;真模块会把整个 shared 包拖进来(与本票判据无关)
vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: (e: unknown): string => String(e),
}))

vi.mock('../../src/plugins/auth.js', () => ({
  authenticate: async (): Promise<void> => undefined,
}))

vi.mock('../../src/plugins/ws-helpers.js', () => {
  class WsUserConnectionLimiterStub {
    constructor(max: number) {
      h.limiterInstances.push(`max=${max}`)
    }
    acquire(userId: string): boolean {
      const c = h.one(userId)
      c.acquires += 1
      c.balance += 1
      c.minBalance = Math.min(c.minBalance, c.balance)
      return true
    }
    release(userId: string): void {
      const c = h.one(userId)
      c.releases += 1
      c.balance -= 1
      c.minBalance = Math.min(c.minBalance, c.balance)
    }
    currentCount(userId: string): number {
      return h.one(userId).balance
    }
  }
  class WsRateLimiterStub {
    allow(): boolean {
      return true
    }
    reset(): void {
      /* 防洪窗口清零:与本票判据无关 */
    }
  }
  return {
    WS_CLOSE: { TOO_MANY_CONNECTIONS: 4005, RATE_LIMITED: 4002 },
    WsUserConnectionLimiter: WsUserConnectionLimiterStub,
    WsRateLimiter: WsRateLimiterStub,
    // 保持"鉴权是异步的"这一形态:租约窗口就是从一次 await 之后开始的
    wsAuth: async (_socket: unknown, token?: string): Promise<string | null> =>
      token === 'valid' ? 'u-1' : null,
  }
})

/** 连一次,**等服务端**把它关掉(拒绝路径用);返回服务端给的 close code */
function serverCloses(port: number, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(`ws://127.0.0.1:${port}${path}`)
    client.on('error', reject)
    client.on('close', (code) => resolve(code))
  })
}

/** 连一次,**由客户端**主动关闭(正常路径用);等服务端把这一次关闭走完 */
function clientCloses(port: number, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(`ws://127.0.0.1:${port}${path}`)
    client.on('error', reject)
    client.on('close', (code) => resolve(code))
    client.on('open', () => {
      client.close()
    })
  })
}

async function waitForZero(pred: () => boolean, ms = 2000): Promise<void> {
  const until = Date.now() + ms
  while (!pred()) {
    if (Date.now() > until) throw new Error(`等待超时,当前计数=${JSON.stringify(h.snapshot())}`)
    await new Promise((r) => setTimeout(r, 10))
  }
}

describe('ws-chat 槽位租约:acquire 之后的每条退出路径恰好 release 一次', () => {
  let server: FastifyInstance
  let port = 0

  beforeAll(async () => {
    server = Fastify({ logger: false })
    await server.register(fastifyWebsocket)
    // 插件按 server.redis 取连接(getRedis()):替身只服务 IDOR 判定与清理路径
    Object.assign(server, {
      redis: {
        async hgetall(): Promise<Record<string, string>> {
          if (h.redisBehavior.gate) await h.redisBehavior.gate
          return h.redisBehavior.ownership === 'deny'
            ? { createdBy: 'someone-else', name: 'r' }
            : {}
        },
        async sismember(): Promise<number> {
          return h.redisBehavior.ownership === 'deny' ? 0 : 1
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

  it('① IDOR 拒绝(acquire 成功后立刻 return):计数回到基线,不得只增不减', async () => {
    // 接线前置:插件确实构造了限流器(否则下面的读数全是空转,用例会静默恒绿)
    expect(h.limiterInstances.length, '插件未构造 WsUserConnectionLimiter').toBeGreaterThan(0)
    h.redisBehavior.ownership = 'deny'
    for (let i = 0; i < 3; i += 1) {
      const code = await serverCloses(port, '/ws/room/r1?token=valid')
      expect(code, 'IDOR 拒应以 1008 关闭').toBe(1008)
    }
    await waitForZero(() => h.total() === 0)
    const s = h.snapshot()
    expect(s.acquires).toBe(3)
    expect(s.releases, '拿到槽位却没还 = 原缺陷;还两次 = 穿负').toBe(3)
    expect(s.minBalance, 'release 多于 acquire ⇒ 计数穿负').toBe(0)
  })

  it('② 正常连上再断开:release 幂等(与 close 事件同时发生也只生效一次)', async () => {
    h.redisBehavior.ownership = 'allow'
    const before = h.snapshot()
    await clientCloses(port, '/ws/room/r1?token=valid')
    await waitForZero(() => h.total() === 0)
    const after = h.snapshot()
    expect(after.acquires - before.acquires).toBe(1)
    expect(after.releases - before.releases).toBe(1) // 恰好一次,不多不少
    expect(after.minBalance).toBe(0)
  })

  it('③ 断线落在 IDOR 的 await 窗口内(close 监听尚未注册):仍必须恰好还一次', async () => {
    h.redisBehavior.ownership = 'allow'
    let openGate!: () => void
    h.redisBehavior.gate = new Promise<void>((r) => {
      openGate = r
    })
    const client = new WebSocket(`ws://127.0.0.1:${port}/ws/room/r1?token=valid`)
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve())
      client.on('error', reject)
    })
    client.close()
    await new Promise<void>((resolve) => {
      client.on('close', () => resolve())
    })
    // 续体还卡在 await ⇒ 此刻槽位仍被占着(还没轮到任何收尾路径)
    expect(h.total()).toBe(1)
    openGate()
    await waitForZero(() => h.total() === 0)
    h.redisBehavior.gate = null
    const s = h.snapshot()
    expect(s.acquires).toBe(s.releases, '取得与归还得逐笔配平')
    expect(s.minBalance).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
