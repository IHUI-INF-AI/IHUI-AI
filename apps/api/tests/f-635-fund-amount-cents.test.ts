// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-635 回归锁(2026-11-13)。
 *
 * 病灶:/fund/ali/pay/create 与 /fund/ali/pay/create2 本地订单用 Math.round(amount*100) 取分,
 * 支付宝网关却用 amount.toFixed(2) 取字符串 ⇒ 0.015 本地 2 分、网关 "0.01" 1 分,
 * 实收与本地订单/回调校验不一致。
 *
 * 本文件锁:
 *   ① 0.015:两渠道本地订单 2 分、网关 "0.02"、风控 2 分,三处同源;
 *   ② 100.50:本地 10050 分、网关 "100.50";
 *   ③ 0.001:归一到 0 分时直接 400,不落 0 分订单、不调网关;
 *   ④ 两渠道对同一金额给出相同分值与相同网关字符串;
 *   ⑤ 源锁:不再出现 body.amount.toFixed(2),两处网关均用 (amountCents/100).toFixed(2)。
 *
 * 只 mock 支付网关/订单库/鉴权,不触达 PG、Redis、支付宝。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const USER_ID = '00000000-0000-4000-8000-000000000635'

const h = vi.hoisted(() => ({
  createOrder: vi.fn(),
  buildSignedUrl: vi.fn(),
  evaluateRisk: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({ authenticate: vi.fn() }))
vi.mock('../src/db/payment-queries.js', () => ({ createOrder: h.createOrder }))
vi.mock('../src/db/fund-queries.js', () => ({
  findFunds: vi.fn(),
  findFundByCode: vi.fn(),
  findFundNetValues: vi.fn(),
}))
vi.mock('../src/db/order-queries.js', () => ({ findOrderByOrderNo: vi.fn() }))
vi.mock('../src/services/alipay.js', () => ({
  isAlipayConfigured: () => true,
  buildSignedUrl: h.buildSignedUrl,
}))

import fundRoutes from '../src/routes/user/fund-routes.js'

const CHANNELS = ['/api/fund/ali/pay/create', '/api/fund/ali/pay/create2'] as const

let app: FastifyInstance

async function createPay(url: string, amount: number) {
  return app.inject({ method: 'POST', url, payload: { amount, description: 'test' } })
}

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.decorateRequest('userId', '')
  app.addHook('onRequest', async (request) => {
    request.userId = USER_ID
  })
  app.decorate('riskEngine', { evaluateRisk: h.evaluateRisk })
  await app.register(fundRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  h.createOrder.mockReset()
  h.createOrder.mockResolvedValue({ id: 'order-635', orderNo: 'F635-0001' })
  h.buildSignedUrl.mockReset()
  h.buildSignedUrl.mockReturnValue('https://example.test/pay')
  h.evaluateRisk.mockReset()
  h.evaluateRisk.mockReturnValue({ action: 'ALLOW', hits: [] })
})

describe('F-635 入口归一到分,本地订单/网关/风控同源', () => {
  it('0.015 两渠道:本地 2 分、网关 "0.02"、风控 2 分(修前网关为 "0.01")', async () => {
    // 钉住缺陷成因:裸 toFixed(2) 与 Math.round(*100) 在半美分上分叉
    expect((0.015).toFixed(2)).toBe('0.01')
    expect(Math.round(0.015 * 100)).toBe(2)

    for (const url of CHANNELS) {
      h.createOrder.mockClear()
      h.buildSignedUrl.mockClear()
      h.evaluateRisk.mockClear()

      const res = await createPay(url, 0.015)

      expect(res.statusCode).toBe(200)
      expect(h.createOrder).toHaveBeenCalledTimes(1)
      expect(h.createOrder.mock.calls[0][0].amount).toBe(2)
      expect(h.evaluateRisk.mock.calls[0][0].amount).toBe(2)
      expect(h.buildSignedUrl.mock.calls[0][0].total_amount).toBe('0.02')
    }
  })

  it('100.50 两渠道:本地 10050 分、网关 "100.50"', async () => {
    for (const url of CHANNELS) {
      h.createOrder.mockClear()
      h.buildSignedUrl.mockClear()

      const res = await createPay(url, 100.5)

      expect(res.statusCode).toBe(200)
      expect(h.createOrder.mock.calls[0][0].amount).toBe(10050)
      expect(h.buildSignedUrl.mock.calls[0][0].total_amount).toBe('100.50')
    }
  })

  it('0.001 归一到 0 分时被拒:400 且不建 0 分订单、不调网关', async () => {
    for (const url of CHANNELS) {
      h.createOrder.mockClear()
      h.buildSignedUrl.mockClear()

      const res = await createPay(url, 0.001)

      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('至少为 0.01 元')
      expect(h.createOrder).not.toHaveBeenCalled()
      expect(h.buildSignedUrl).not.toHaveBeenCalled()
    }
  })

  it('两渠道金额同源:同一 amount 的分值与网关字符串完全一致', async () => {
    const amounts = [0.015, 19.99, 0.07, 100.5, 0.01]
    for (const amount of amounts) {
      const seen: Array<{ cents: number; gateway: string }> = []
      for (const url of CHANNELS) {
        h.createOrder.mockClear()
        h.buildSignedUrl.mockClear()

        const res = await createPay(url, amount)
        expect(res.statusCode).toBe(200)

        seen.push({
          cents: h.createOrder.mock.calls[0][0].amount,
          gateway: h.buildSignedUrl.mock.calls[0][0].total_amount,
        })
      }
      expect(seen[1]).toEqual(seen[0])
      expect(seen[0].gateway).toBe((seen[0].cents / 100).toFixed(2))
    }
  })

  it('源锁:网关不再用 body.amount.toFixed(2),两处均用 amountCents 派生', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../src/routes/user/fund-routes.ts', import.meta.url)),
      'utf8',
    )
    expect(source).not.toContain('body.amount.toFixed(2)')
    expect(source.match(/const amountCents = Math\.round\(body\.amount \* 100\)/g)).toHaveLength(2)
    expect(source.match(/total_amount: \(amountCents \/ 100\)\.toFixed\(2\)/g)).toHaveLength(2)
    expect(source.match(/amount: amountCents,/g)).toHaveLength(4)
  })
})
