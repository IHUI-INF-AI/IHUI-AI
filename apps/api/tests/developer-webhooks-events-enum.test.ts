// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-201 第三族:developer Relay Webhook 订阅 events 轴 = 服务端封闭枚举上限形态。
 *
 * 身份模型同口径:events 由服务端 ALLOWED_EVENTS 封闭集钉死上限,调用方只能在
 * 集内自选**子集(收窄)**,集外值入口即 400 —— 与 ws-broadcast/public-socket 的
 * "自报只许收窄不许放宽"是同一判定形态(枚举即 ceiling)。
 *
 * 两族断言:
 *   ① 枚举外事件 ⇒ 400(自选放宽被拒),零落库;
 *   ② 枚举内子集 ⇒ 201,且 insert 落库 events = 子集(服务端上限生效、原样收窄)。
 *
 * 零真实连接:db/dbScoped、requireAuth、ssrf-guard、webhook secret 全 mock。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const USER_ID = '99999999-1111-4111-8111-111111111111'

const { insertValues } = vi.hoisted(() => ({
  insertValues: [] as Array<Record<string, unknown>>,
}))

vi.mock('../src/db/index.js', () => {
  /** 链式记录器:insert().values(v).returning() 捕获 v 并回一行;select 链 await 出空表。 */
  const makeChain = (rows: unknown[]): Record<string, unknown> => ({
    from: () => makeChain(rows),
    where: () => makeChain(rows),
    orderBy: () => makeChain(rows),
    limit: () => makeChain(rows),
    offset: () => makeChain(rows),
    values: (v: Record<string, unknown>) => {
      insertValues.push(v)
      return {
        returning: () => Promise.resolve([{ id: '77777777-1111-4111-8111-111111111111', ...v }]),
      }
    },
    set: () => makeChain(rows),
    then: (res: (v: unknown) => void) => Promise.resolve(rows).then(res),
  })
  return {
    db: {
      select: () => makeChain([]),
      insert: () => makeChain([]),
      update: () => makeChain([]),
      delete: () => makeChain([]),
    },
    dbScoped: {
      select: () => makeChain([]),
      insert: () => makeChain([]),
      update: () => makeChain([]),
      delete: () => makeChain([]),
    },
    dbRead: { select: () => makeChain([]) },
    dbClient: {},
  }
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: async (request: { userId?: string }): Promise<void> => {
    request.userId = USER_ID
  },
}))

vi.mock('../src/utils/ssrf-guard.js', () => ({
  ensureSafeFetchUrl: vi.fn(async (url: string) => url),
}))

vi.mock('../src/services/webhook-relay-notifier.js', () => ({
  generateWebhookSecret: () => 'whsec_test_not_a_real_secret',
}))

import developerWebhooksRoutes from '../src/routes/developer/webhooks.js'

let app: FastifyInstance

beforeEach(async () => {
  insertValues.length = 0
  app = Fastify()
  await app.register(developerWebhooksRoutes)
  await app.ready()
})

describe('G-201 developer webhooks events 封闭枚举 = 服务端上限(自报只许收窄)', () => {
  const basePayload = {
    url: 'https://hooks.example.com/ihui-relay',
    balanceThresholdCents: 500,
  }

  it('① 枚举外事件混入 ⇒ 400 拒(自选放宽被挡),零落库', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/subscriptions',
      payload: { ...basePayload, events: ['relay.call.completed', 'relay.everything.please'] },
    })
    expect(res.statusCode).toBe(400)
    expect(insertValues).toHaveLength(0)
    await app.close()
  })

  it('①b 纯枚举外单事件同样 400;空数组(min 1)也入口即拒', async () => {
    const rogue = await app.inject({
      method: 'POST',
      url: '/webhooks/subscriptions',
      payload: { ...basePayload, events: ['relay.call.completed.self_service'] },
    })
    expect(rogue.statusCode).toBe(400)
    const empty = await app.inject({
      method: 'POST',
      url: '/webhooks/subscriptions',
      payload: { ...basePayload, events: [] },
    })
    expect(empty.statusCode).toBe(400)
    expect(insertValues).toHaveLength(0)
    await app.close()
  })

  it('② 枚举内子集 ⇒ 201,落库 events = 子集(服务端上限生效、收窄原样入账)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/subscriptions',
      payload: { ...basePayload, events: ['relay.balance.low'] },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.subscription.events).toEqual(['relay.balance.low'])
    expect(insertValues).toHaveLength(1)
    expect(insertValues[0]).toMatchObject({
      userId: USER_ID,
      events: ['relay.balance.low'],
    })
    await app.close()
  })

  it('②b 全枚举子集(3 个合法事件)⇒ 201 原样落库', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/subscriptions',
      payload: {
        ...basePayload,
        events: ['relay.call.completed', 'relay.call.failed', 'relay.balance.low'],
      },
    })
    expect(res.statusCode).toBe(201)
    expect(insertValues[0]?.events).toEqual([
      'relay.call.completed',
      'relay.call.failed',
      'relay.balance.low',
    ])
    await app.close()
  })
})
