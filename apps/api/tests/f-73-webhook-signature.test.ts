// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-73 回归:出站 webhook 存了 secret 却从不签名,接收方无法验证来源。
 *
 * 口径钉死(与 routes/developer/webhooks.ts 的 deliverOnce 同尺):
 *  - 签名 = HMAC-SHA256(secret, 实际发送的 body 原文) 的 hex,头 `X-IHUI-Signature: sha256=<hex>`;
 *  - 同时带 `X-IHUI-Timestamp`(unix 秒);
 *  - 无 secret 时不伪造签名头,也不报错;
 *  - 失败响应体按上限截断读取,不被恶意接收端的超大响应拖爆内存。
 *
 * 零真实连接:db、requireAuth、ssrf-guard(含 safeFetch)全 mock,不真发请求。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'

const USER_ID = '99999999-1111-4111-8111-111111111111'
const WEBHOOK_ID = '77777777-1111-4111-8111-111111111111'
const EVENT_ID = '66666666-1111-4111-8111-111111111111'
const SECRET = 'whsec_f73_regression_secret'
const TARGET_URL = 'https://hooks.example.com/ihui'

const state = vi.hoisted(() => ({
  selectRows: [] as unknown[][],
  inserted: [] as Array<Record<string, unknown>>,
  updated: [] as Array<Record<string, unknown>>,
}))

const safeFetchMock = vi.hoisted(() => vi.fn())

vi.mock('../src/db/index.js', () => {
  /** select 链:`from/where/orderBy` 原样返回,`limit` 与直接 await 都出队里的行。 */
  const selectChain = (rows: unknown[]): Record<string, unknown> => {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = () => chain
    chain.orderBy = () => chain
    chain.limit = () => Promise.resolve(rows)
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject)
    return chain
  }
  const db = {
    select: () => selectChain(state.selectRows.shift() ?? []),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        state.inserted.push(v)
        return Promise.resolve([])
      },
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        state.updated.push(v)
        return { where: () => Promise.resolve([]) }
      },
    }),
    delete: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }),
  }
  return { db, dbScoped: db, dbRead: db, dbClient: {} }
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: async (request: { userId?: string }): Promise<void> => {
    request.userId = USER_ID
  },
}))

vi.mock('../src/utils/ssrf-guard.js', () => ({
  safeFetch: safeFetchMock,
  ensureSafeFetchUrl: vi.fn(async (url: string) => url),
}))

import webhooksRoutes from '../src/routes/webhooks.js'

let app: FastifyInstance

beforeEach(async () => {
  state.selectRows.length = 0
  state.inserted.length = 0
  state.updated.length = 0
  safeFetchMock.mockReset()
  safeFetchMock.mockResolvedValue(new Response('ok', { status: 200 }))
  app = Fastify()
  await app.register(webhooksRoutes)
  await app.ready()
})

/** 取出唯一一次出站调用的 URL / headers / body。 */
function lastCall(): { url: string; headers: Record<string, string>; body: string } {
  const call = safeFetchMock.mock.calls[0] as [string, RequestInit] | undefined
  if (!call) throw new Error('safeFetch 未被调用')
  return {
    url: call[0],
    headers: (call[1].headers ?? {}) as Record<string, string>,
    body: String(call[1].body ?? ''),
  }
}

describe('F-73 出站 webhook HMAC 签名', () => {
  it('① /test 有 secret ⇒ 对实际发送的 body 做 HMAC-SHA256,签名头与 developer/webhooks 同口径', async () => {
    state.selectRows.push([{ id: WEBHOOK_ID, userId: USER_ID, url: TARGET_URL, secret: SECRET }])

    const res = await app.inject({
      method: 'POST',
      url: `/${WEBHOOK_ID}/test`,
      payload: { eventType: 'test.event', payload: { hello: 'world' } },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.result.ok).toBe(true)

    const { url, headers, body } = lastCall()
    expect(url).toBe(TARGET_URL)
    expect(headers['Content-Type']).toBe('application/json')

    // 接收端验签方式:拿收到的 body 原文重算一遍,与头逐字节相等。
    const expected = `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`
    expect(headers['X-IHUI-Signature']).toBe(expected)
    expect(headers['X-IHUI-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/)
    expect(headers['X-IHUI-Timestamp']).toMatch(/^\d{10}$/)

    // 签名覆盖的就是线上那份字节(解析出来仍是原 payload)。
    const sent = JSON.parse(body) as { event: string; data: unknown }
    expect(sent.event).toBe('test.event')
    expect(sent.data).toEqual({ hello: 'world' })

    await app.close()
  })

  it('② /test 无 secret ⇒ 不带签名/时间戳头,投递照常成功', async () => {
    state.selectRows.push([{ id: WEBHOOK_ID, userId: USER_ID, url: TARGET_URL, secret: null }])

    const res = await app.inject({
      method: 'POST',
      url: `/${WEBHOOK_ID}/test`,
      payload: { eventType: 'test.event' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.result.ok).toBe(true)

    const { headers, body } = lastCall()
    expect(headers['X-IHUI-Signature']).toBeUndefined()
    expect(headers['X-IHUI-Timestamp']).toBeUndefined()
    expect(JSON.parse(body)).toMatchObject({ event: 'test.event' })

    await app.close()
  })

  it('③ /retry 重投也签名:覆盖重发事件的序列化 body,响应形状不变', async () => {
    state.selectRows.push(
      [{ id: WEBHOOK_ID, userId: USER_ID, url: TARGET_URL, secret: SECRET }],
      [{ id: EVENT_ID, payload: { event: 'test.event', data: { retry: true } }, status: 'failed' }],
    )

    const res = await app.inject({ method: 'POST', url: `/${WEBHOOK_ID}/retry` })

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ eventId: EVENT_ID, result: { ok: true, code: 200 } })

    const { headers, body } = lastCall()
    const expected = `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`
    expect(headers['X-IHUI-Signature']).toBe(expected)
    expect(JSON.parse(body)).toMatchObject({ data: { retry: true } })

    await app.close()
  })

  it('④ 接收端回超大失败响应 ⇒ 响应体读取有上限,日志里被截断', async () => {
    const huge = 'x'.repeat(200_000)
    safeFetchMock.mockResolvedValue(new Response(huge, { status: 500 }))
    state.selectRows.push([{ id: WEBHOOK_ID, userId: USER_ID, url: TARGET_URL, secret: SECRET }])

    const res = await app.inject({
      method: 'POST',
      url: `/${WEBHOOK_ID}/test`,
      payload: { eventType: 'test.event' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.result.ok).toBe(false)

    const stored = state.inserted[0]?.responseBody
    expect(typeof stored).toBe('string')
    const message = stored as string
    expect(message.startsWith('HTTP 500: ')).toBe(true)
    expect(message).toContain('...[truncated]')
    // 2048 上限 + 前缀/后缀,远小于对方吐出的 200KB。
    expect(message.length).toBeLessThan(4096)

    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
