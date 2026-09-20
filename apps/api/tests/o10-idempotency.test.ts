// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type preHandlerAsyncHookHandler,
} from 'fastify'
import type { Redis } from 'ioredis'
import type { ApiKeyPermission, AuthenticatedApiKey } from '@ihui/types'
import { getCapability } from '@ihui/types'
import { openIdempotency } from '../src/plugins/open-idempotency.js'

/**
 * O10 开放面幂等重放保护 —— 契约测试(Fastify inject,零真实 Redis / 零真实 DB)。
 *
 * 拓扑刻意复刻生产的钩子组合规则(Fastify lib/route.js:实例级钩子 concat 路由自身数组):
 *   最终 preHandler 链 = [stubGate, 插件的抢槽守卫]
 * stubGate 扮演 capability-guard / open-capability-gate:它先跑,把 request.apiKey 与
 * request.capability 摆好,守卫才有东西可判。守卫**不在这里手挂** —— 它是插件的 onRoute
 * 追加进去的。这么跑才是在验"接线真生效",而不是验我手敲的顺序。
 *
 * 覆盖面:重放等值 / 进行中 409 / 不带 key 零影响 / 凭据隔离 / GET 免疫,再加三条本层自设的
 * 门:stream=true 不占槽、idempotencyRequired=false 不掺和、Redis 挂了 fail-open 放人。
 */

// 插件读 config.IDEMPOTENCY_TTL_SECONDS —— 打桩,免得去跑真的 env zod 校验那套。
vi.mock('../src/config/index.js', () => ({
  config: { IDEMPOTENCY_TTL_SECONDS: 600, NODE_ENV: 'test' },
}))

interface Entry {
  value: string
  expiresAt: number
}

/** 只实现本插件用到的三条命令,语义对齐真 Redis:NX 撞了返回 null 且绝不覆盖旧值。 */
class FakeRedis {
  private readonly map = new Map<string, Entry>()
  /** true = 命令一律 reject,用来踩 fail-open 那条腿。 */
  down = false
  /** 被碰了几次。"不带 key 的行为跟今天完全一致"最硬的证据就是这数压根没动。 */
  calls = 0

  private assertAlive(): void {
    if (this.down) throw new Error('redis connection lost')
  }
  private read(key: string): string | undefined {
    const hit = this.map.get(key)
    if (!hit) return undefined
    if (hit.expiresAt <= Date.now()) {
      this.map.delete(key)
      return undefined
    }
    return hit.value
  }
  async set(key: string, value: string, ...args: (string | number)[]): Promise<'OK' | null> {
    this.assertAlive()
    this.calls += 1
    if (args.includes('NX') && this.read(key) !== undefined) return null
    const pxIndex = args.indexOf('PX')
    const ttlMs = pxIndex >= 0 ? Number(args[pxIndex + 1]) : Number.POSITIVE_INFINITY
    this.map.set(key, {
      value,
      expiresAt: Number.isFinite(ttlMs) ? Date.now() + ttlMs : Number.POSITIVE_INFINITY,
    })
    return 'OK'
  }
  async get(key: string): Promise<string | null> {
    this.assertAlive()
    this.calls += 1
    return this.read(key) ?? null
  }
  async del(key: string): Promise<number> {
    this.assertAlive()
    this.calls += 1
    const had = this.read(key) !== undefined
    this.map.delete(key)
    return had ? 1 : 0
  }
  /** 测试后门:直接种一条"别处还没收的活儿",精确制造进行中碰撞,不用拿真并发赌时序。 */
  seedInflight(key: string): void {
    this.map.set(key, {
      value: JSON.stringify({ status: 'processing', ts: Date.now() }),
      expiresAt: Date.now() + 60_000,
    })
  }
  /** 脏数据入口:认不出的载荷必须被兜住,不能把它当"可重放"吐给客户端。 */
  seedGarbage(key: string, value: string): void {
    this.map.set(key, { value, expiresAt: Date.now() + 60_000 })
  }
  raw(key: string): string | undefined {
    return this.read(key)
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let settle: (() => void) | undefined
  const promise = new Promise<void>((r) => {
    settle = r
  })
  return { promise, resolve: () => settle?.() }
}

function apiKeyOf(id: string): AuthenticatedApiKey {
  return {
    id,
    userId: `owner-${id}`,
    key: 'Bearer ihui_test',
    permissions: ['agents:call', 'agents:read'],
    rateLimit: 60,
    expiresAt: null,
    allowedIps: null,
    allowedModels: null,
    maxTokensPerReq: null,
    blockedIps: null,
    rateLimit5h: null,
    rateLimit1d: null,
    rateLimit7d: null,
  }
}

interface Harness {
  app: FastifyInstance
  redis: FakeRedis
  /** handler 真跑了几个请求 —— 重放该是 1,撞车那把该是 0。 */
  executions: () => number
}

/**
 * @param gate   给了就让 handler 卡在上头等它松手 —— 造"进行中"用,不靠掐毫秒
 * @param scope  这条路由声称的能力(默认 agents:call,目录里它 idempotencyRequired=true)
 */
async function buildHarness(
  gate?: Promise<void>,
  scope: ApiKeyPermission = 'agents:call',
): Promise<Harness> {
  const app = Fastify({ logger: false })
  const redis = new FakeRedis()
  app.decorate('redis', redis as unknown as Redis)
  await app.register(openIdempotency)

  let executions = 0
  const stubGate: preHandlerAsyncHookHandler = async (request) => {
    const header = request.headers['x-test-key-id']
    if (typeof header === 'string' && header) request.apiKey = apiKeyOf(header)
    const entry = getCapability(scope)
    if (!entry) return
    request.capability = entry
    // 与 capability-guard.ts:111-115 同构:登记那个头,但不因为客户端没带就甩 400。
    if (entry.idempotencyRequired && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const raw = request.headers['idempotency-key']
      if (typeof raw === 'string' && raw.trim() !== '') {
        request.idempotencyKey = raw.trim().slice(0, 200)
      }
    }
  }
  // 202 不是手滑:故意挑一个非 200 的档,好让"重放只回 200"这种偷懒实现当场暴雷。
  const handler = async (request: FastifyRequest, reply: FastifyReply): Promise<Record<string, unknown>> => {
    if (gate) await gate
    executions += 1
    reply.status(202)
    return { jobId: `job-${executions}`, executions, body: request.body ?? null }
  }

  // 插件的 onRoute 会把守卫追加到这个数组末尾 —— 别在这儿手动挂第二遍,那就不算测接线的了。
  app.post('/v1/jobs', { preHandler: [stubGate] }, handler)
  app.get('/v1/jobs', { preHandler: [stubGate] }, handler)
  await app.ready()
  return { app, redis, executions: () => executions }
}

const OWNER = 'abc-1'
const KEY = 'idem:key:abc-1:agents:call:req-seeded'

function postWithKey(
  app: FastifyInstance,
  idempotencyKey: string,
  apiKeyId: string = OWNER,
  payload: unknown = {},
) {
  return app.inject({
    method: 'POST',
    url: '/v1/jobs',
    headers: { 'x-test-key-id': apiKeyId, 'idempotency-key': idempotencyKey },
    payload,
  })
}

describe('同 key 重放', () => {
  it('第二次拿到与第一次逐字节相同的 statusCode 与 body,且 handler 只执行了一次', async () => {
    const { app, executions } = await buildHarness()
    const first = await postWithKey(app, 'req-0001', OWNER, { prompt: 'hi' })
    const second = await postWithKey(app, 'req-0001', OWNER, { prompt: 'hi' })

    expect(first.statusCode).toBe(202)
    // 一条线把状态码和包体同时钉死:重放出去的就是那一次的原样结果
    expect([second.statusCode, second.body]).toEqual([first.statusCode, first.body])
    expect(first.json().executions).toBe(1)
    expect(second.json().executions).toBe(1)
    expect(executions()).toBe(1)
    await app.close()
  })

  it('槽位里躺着 processing 记录时,同 key 请求吃 409 且绝不进 handler', async () => {
    const { app, redis, executions } = await buildHarness()
    redis.seedInflight(KEY)
    const res = await postWithKey(app, 'req-seeded')

    expect([res.statusCode, res.json().errorCode]).toEqual([409, 'IDEMPOTENCY_IN_PROGRESS'])
    expect(executions()).toBe(0)
    // 别人的门票不许顺手撤掉 —— 撤了就是把真在跑的那一把的结果给丢了
    expect(redis.raw(KEY)).toContain('"processing"')
    await app.close()
  })

  it('槽位里是认不出的脏数据时:409 且绝不把垃圾当结果吐给客户端(脏键到 TTL 自愈)', async () => {
    const { app, redis, executions } = await buildHarness()
    redis.seedGarbage(KEY, 'not-even-json')
    const res = await postWithKey(app, 'req-seeded')

    // 判据:读不懂的那一把**可能**正是别人在跑的活儿,放行等于拿双计费去赌。
    // 宁可 409 —— 而且这把 key 不会被永久毒化,脏键最多滞留 TTL 就自己蒸发。
    expect([res.statusCode, res.json().errorCode]).toEqual([409, 'IDEMPOTENCY_IN_PROGRESS'])
    expect(executions()).toBe(0)
    expect(res.body).not.toContain('not-even-json')
    await app.close()
  })
})

describe('进行中碰撞(真并发)', () => {
  it('第一棒还卡在 handler 里时,同 key 第二棒 409,且没偷偷跑第二遍', async () => {
    const gate = deferred()
    const { app, executions } = await buildHarness(gate.promise)
    const inflight = postWithKey(app, 'req-0002')
    // 让第一棒钻进 handler 卡住,槽位这时候确实刻着 processing
    await new Promise((resolve) => setImmediate(resolve))
    const collision = await postWithKey(app, 'req-0002')

    expect([collision.statusCode, collision.json().errorCode]).toEqual([409, 'IDEMPOTENCY_IN_PROGRESS'])
    // 撞车那把要是把活儿又跑了一遍,后头就是双计费 —— 这条断言是整个机制的存在理由
    expect(executions()).toBe(0)

    gate.resolve()
    const settled = await inflight
    expect([settled.statusCode, executions()]).toEqual([202, 1])

    // 第一棒正常收口后,同一把钥匙第三次来走的是"重放",不再撞车
    const replayed = await postWithKey(app, 'req-0002')
    expect([replayed.statusCode, replayed.body, executions()]).toEqual([
      settled.statusCode,
      settled.body,
      1,
    ])
    await app.close()
  })
})

describe('回归护栏:没带 key 的世界一寸没动', () => {
  it('无 Idempotency-Key 的写请求:照样每次都真跑,状态码不变,Redis 一次都没被碰', async () => {
    const { app, redis, executions } = await buildHarness()
    const a = await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      headers: { 'x-test-key-id': OWNER },
      payload: {},
    })
    const b = await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      headers: { 'x-test-key-id': OWNER },
      payload: {},
    })

    expect([a.statusCode, b.statusCode]).toEqual([202, 202])
    expect([a.json().executions, b.json().executions]).toEqual([1, 2])
    expect(executions()).toBe(2)
    expect(redis.calls).toBe(0)
    await app.close()
  })

  it('能力目录里 idempotencyRequired=false 的 scope:带了 key 也不掺和', async () => {
    const { app, redis, executions } = await buildHarness(undefined, 'agents:read')
    const res = await postWithKey(app, 'req-0003')

    expect([res.statusCode, executions(), redis.calls]).toEqual([202, 1, 0])
    await app.close()
  })

  it('GET 免疫:同一个 key 连打两次照样两跑,一次 Redis 都不发', async () => {
    const { app, redis, executions } = await buildHarness()
    const headers = { 'x-test-key-id': OWNER, 'idempotency-key': 'req-0004' }
    const a = await app.inject({ method: 'GET', url: '/v1/jobs', headers })
    const b = await app.inject({ method: 'GET', url: '/v1/jobs', headers })

    expect([a.statusCode, b.statusCode]).toEqual([202, 202])
    expect([a.json().executions, b.json().executions]).toEqual([1, 2])
    expect(executions()).toBe(2)
    expect(redis.calls).toBe(0)
    await app.close()
  })

  it('stream=true 不占槽 —— 它压根不走 onSend,占了就是把自己锁到 TTL', async () => {
    const { app, redis, executions } = await buildHarness()
    const a = await postWithKey(app, 'req-0005', OWNER, { stream: true })
    const b = await postWithKey(app, 'req-0005', OWNER, { stream: true })

    expect([a.statusCode, b.statusCode]).toEqual([202, 202])
    expect([executions(), redis.calls]).toEqual([2, 0])
    await app.close()
  })
})

describe('凭据隔离', () => {
  it('两把 apiKeyId 用同一串 Idempotency-Key 互不命中,各跑各的', async () => {
    const { app, executions } = await buildHarness()
    const one = await postWithKey(app, 'shared-0001', 'abc-1')
    const two = await postWithKey(app, 'shared-0001', 'zzz-9')

    expect([one.statusCode, two.statusCode]).toEqual([202, 202])
    // 要是串了,第二把拿到的就是第一把的 executions:1
    expect([one.json().executions, two.json().executions]).toEqual([1, 2])
    expect(executions()).toBe(2)
    await app.close()
  })

  it('键面确实带上凭据维度:A 的槽位落地了,B 的同名槽位压根不存在', async () => {
    const { app, redis } = await buildHarness()
    await postWithKey(app, 'shared-0002', 'abc-1')

    const owned = redis.raw('idem:key:abc-1:agents:call:shared-0002')
    expect(owned).toContain('"status":"completed"')
    expect(owned).toContain('"statusCode":202')
    expect(redis.raw('idem:key:zzz-9:agents:call:shared-0002')).toBeUndefined()
    await app.close()
  })
})

describe('Redis 不可用 = 放人,不拦人', () => {
  it('命令全炸时,带 key 的合法写请求照样跑完 202,并记下 fail-open', async () => {
    const { app, redis, executions } = await buildHarness()
    redis.down = true
    const res = await postWithKey(app, 'req-0006')

    expect([res.statusCode, executions()]).toEqual([202, 1])
    const counters = app.openIdempotency.counters
    expect(counters.failOpen).toBeGreaterThan(0)
    // 没抢到锁就别张口咬人:重放和撞车两条道都该是干净的 0
    expect([counters.replayed, counters.inProgressRejected]).toEqual([0, 0])
    await app.close()
  })

  it('结果已缓存后 Redis 才炸:重放能力没了,但人照样进(handler 再跑一次,不锁死)', async () => {
    const { app, redis, executions } = await buildHarness()
    const first = await postWithKey(app, 'req-0007')
    expect([first.statusCode, executions()]).toEqual([202, 1])
    // 到这儿槽里躺着的是 completed —— 平时第二把该走重放。现在把桌子掀了。
    expect(redis.raw('idem:key:abc-1:agents:call:req-0007')).toContain('"completed"')

    redis.down = true
    const retry = await postWithKey(app, 'req-0007')

    // 抢不到槽 = 不知道外头有没有人干过。这时候把请求判死,等于拿"Redis 抖一下"
    // 去换"所有带 key 的写请求整段不可用" —— 不值。宁可这一把重跑,也不能拦人。
    expect([retry.statusCode, executions()]).toEqual([202, 2])
    expect(app.openIdempotency.counters.failOpen).toBeGreaterThan(0)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
