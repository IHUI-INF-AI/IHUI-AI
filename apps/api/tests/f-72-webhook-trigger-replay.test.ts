// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/**
 * F-72 回归锁:`POST /api/webhooks/trigger/:id` 必须能挡住签名报文重放。
 *
 * 判据(对应票面「建议修法」):
 *  1. 时间戳头必填且落在 ±5 分钟窗口内 —— 缺头/过期一律 401,不进入 agent 执行;
 *  2. 签名串必须包含时间戳(`${timestamp}.${rawPayload}`)—— 只签正文的旧报文被拒;
 *  3. 同 trigger 同事件 id(eventId/id/deliveryId)第二次投递返回既有成功形状,
 *     但**不得**再次执行 agent;
 *  4. Redis 不可用时降级到进程内 Set + TTL,同样拦住重复投递(不 silent allow)。
 *
 * 测试不连真实 Redis:用仓内唯一内存替身 `src/testing/fake-redis.ts` 直接挂到
 * fastify 实例的 `redis` 属性上(handler 在请求期读取,与生产装饰点同形)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'
import { createFakeRedisState, makeFakeRedisClass } from '../src/testing/fake-redis.js'

vi.mock('../src/config/index.js', () => ({ config: { AI_SERVICE_URL: 'http://127.0.0.1:1' } }))
// 本文件只测 /trigger/:id 的防重放,创建触发器时不需要真管理员态
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => {
    /* no-op */
  },
}))

import webhookTriggerRoutes from '../src/routes/webhooks-trigger.js'

const SECRET = 'f72-webhook-secret-0123456789'
const TS_HEADER = 'x-ihui-timestamp'

interface FakeRedisClient {
  set(key: string, value: string, ...rest: unknown[]): Promise<'OK' | null>
  get(key: string): Promise<string | null>
}

const fakeRedisState = createFakeRedisState()
const FakeRedisClass = makeFakeRedisClass(fakeRedisState)
const fakeRedis = new FakeRedisClass() as unknown as FakeRedisClient

const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }) as Response)

let app: FastifyInstance

function sign(secret: string, timestamp: string, payload: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
}

function post(triggerId: string, payload: string, headers: Record<string, string>) {
  return app.inject({
    method: 'POST',
    url: `/api/webhooks/trigger/${triggerId}`,
    payload,
    headers: { 'content-type': 'text/plain', ...headers },
  })
}

/** 等 `void executeAgentAsync()` 跑到 fetch 之后 */
const flushAsyncWork = () => new Promise((resolve) => setTimeout(resolve, 10))

async function createTrigger(name: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/webhooks/webhooks/triggers',
    payload: { name, url: 'https://example.com/hook', agentId: 'f72-agent', secret: SECRET },
  })
  expect(res.statusCode).toBe(201)
  return (res.json() as { data: { trigger: { id: string } } }).data.trigger.id
}

type TriggerEnvelope = {
  code: number
  data: { accepted: boolean; duplicate?: boolean; eventId: string; asyncExecution: boolean }
}

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock)
  app = Fastify({ logger: false })
  await app.register(webhookTriggerRoutes, { prefix: '/api/webhooks' })
  // handler 在请求期读 server.redis;此处注入内存替身(生产由 redis 插件 decorate)
  ;(app as unknown as { redis?: unknown }).redis = fakeRedis
  await app.ready()
})

afterAll(async () => {
  await app.close()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  fetchMock.mockClear()
})

describe('F-72 webhook trigger 防重放', () => {
  it('缺少时间戳头直接 401,不执行 agent', async () => {
    const triggerId = await createTrigger('missing-ts')
    const payload = JSON.stringify({ eventId: 'evt-missing-ts' })

    const res = await post(triggerId, payload, { 'x-webhook-signature': sign(SECRET, '', payload) })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ code: 401 })
    await flushAsyncWork()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('时间戳超出 ±5 分钟窗口直接 401,不执行 agent', async () => {
    const triggerId = await createTrigger('expired-ts')
    const payload = JSON.stringify({ eventId: 'evt-expired' })
    const staleTs = String(Date.now() - 6 * 60 * 1000)

    const res = await post(triggerId, payload, {
      [TS_HEADER]: staleTs,
      'x-webhook-signature': sign(SECRET, staleTs, payload),
    })

    expect(res.statusCode).toBe(401)
    await flushAsyncWork()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('签名串只含正文(旧格式)被拒:时间戳必须纳入签名', async () => {
    const triggerId = await createTrigger('legacy-signature')
    const payload = JSON.stringify({ eventId: 'evt-legacy' })
    const ts = String(Date.now())
    const legacySignature = createHmac('sha256', SECRET).update(payload).digest('hex')

    const res = await post(triggerId, payload, {
      [TS_HEADER]: ts,
      'x-webhook-signature': legacySignature,
    })

    expect(res.statusCode).toBe(401)
    await flushAsyncWork()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('正常首投通过(202),agent 执行一次', async () => {
    const triggerId = await createTrigger('first-delivery')
    const payload = JSON.stringify({ eventId: 'evt-first-ok', amount: 100 })
    const ts = String(Date.now())

    const res = await post(triggerId, payload, {
      [TS_HEADER]: ts,
      'x-webhook-signature': sign(SECRET, ts, payload),
    })

    expect(res.statusCode).toBe(202)
    const body = res.json() as TriggerEnvelope
    expect(body.code).toBe(0)
    expect(body.data.accepted).toBe(true)
    expect(body.data.asyncExecution).toBe(true)
    expect(body.data.duplicate).toBeUndefined()

    await flushAsyncWork()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('同 eventId 第二次投递:返回既有成功形状但不重复执行 agent', async () => {
    const triggerId = await createTrigger('dedup-same-event')
    const payload = JSON.stringify({ eventId: 'evt-replay-1', amount: 100 })

    const firstTs = String(Date.now())
    const first = await post(triggerId, payload, {
      [TS_HEADER]: firstTs,
      'x-webhook-signature': sign(SECRET, firstTs, payload),
    })
    expect(first.statusCode).toBe(202)
    const firstBody = first.json() as TriggerEnvelope
    await flushAsyncWork()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // 重放者换一个新鲜时间戳并重新签名:时间戳窗口不再是防线,只有幂等键能挡
    const secondTs = String(Date.now() + 1000)
    const second = await post(triggerId, payload, {
      [TS_HEADER]: secondTs,
      'x-webhook-signature': sign(SECRET, secondTs, payload),
    })
    expect(second.statusCode).toBe(202)
    const secondBody = second.json() as TriggerEnvelope
    expect(secondBody.code).toBe(0)
    expect(secondBody.data.accepted).toBe(true)
    expect(secondBody.data.duplicate).toBe(true)
    expect(secondBody.data.asyncExecution).toBe(false)
    expect(secondBody.data.eventId).toBe(firstBody.data.eventId)

    await flushAsyncWork()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('Redis 不可用时内存 Set + TTL 兜底仍拦住同 eventId 重放', async () => {
    const triggerId = await createTrigger('redis-down-fallback')
    const payload = JSON.stringify({ deliveryId: 'delivery-fallback-1' })
    const holder = app as unknown as { redis?: unknown }

    holder.redis = undefined
    try {
      const firstTs = String(Date.now())
      const first = await post(triggerId, payload, {
        [TS_HEADER]: firstTs,
        'x-webhook-signature': sign(SECRET, firstTs, payload),
      })
      expect(first.statusCode).toBe(202)
      expect((first.json() as TriggerEnvelope).data.asyncExecution).toBe(true)

      const secondTs = String(Date.now() + 1000)
      const second = await post(triggerId, payload, {
        [TS_HEADER]: secondTs,
        'x-webhook-signature': sign(SECRET, secondTs, payload),
      })
      expect(second.statusCode).toBe(202)
      expect((second.json() as TriggerEnvelope).data.duplicate).toBe(true)

      await flushAsyncWork()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      holder.redis = fakeRedis
    }
  })
})
