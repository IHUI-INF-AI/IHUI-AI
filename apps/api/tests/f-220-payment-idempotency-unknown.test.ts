// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-220 夹具:Redis 故障必须返回 unknown(而不是 processing),且 complete 写失败必须上抛。

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

import { paymentIdempotency } from '../src/plugins/payment-idempotency.js'

const redisDown = {
  set: vi.fn().mockRejectedValue(new Error('redis down')),
  get: vi.fn(),
  del: vi.fn(),
}

const redisOk = {
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn(),
  del: vi.fn().mockResolvedValue(1),
}

async function buildApp(redis: typeof redisDown): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  app.decorate('redis', redis as unknown as FastifyInstance['redis'])
  await app.register(paymentIdempotency)
  await app.ready()
  return app
}

describe('F-220 支付回调幂等三态', () => {
  let appDown: FastifyInstance
  let appOk: FastifyInstance

  beforeAll(async () => {
    appDown = await buildApp(redisDown)
    appOk = await buildApp(redisOk)
  })

  afterAll(async () => {
    await appDown.close()
    await appOk.close()
  })

  it('Redis 异常 → acquire 返回 unknown,不得压成 processing', async () => {
    const result = await appDown.paymentIdempotency.acquire('ORDER-1', 'TX-1')
    expect(result.status).toBe('unknown')
    // 变异自证:catch 里改回 { status: 'processing' } 本断言翻红 ——
    // 回调侧会据此 ACK SUCCESS,平台停止重投。
  })

  it('complete 写失败必须抛出,让调用方回 FAIL 并释放锁', async () => {
    await expect(appOk.paymentIdempotency.complete('ORDER-1', 'TX-1', {})).resolves.toBeUndefined()
    await expect(appDown.paymentIdempotency.complete('ORDER-1', 'TX-1', {})).rejects.toThrow(
      'redis down',
    )
    // 变异自证:把 catch 改回只 log.warn 不抛,本断言翻红。
  })

  it('preHandler 对 unknown 返回 503,不放行也不当已完成', async () => {
    const handler = appDown.paymentIdempotency.preHandler(() => ({
      paymentId: 'ORDER-1',
      idemKey: 'TX-1',
    }))
    const reply = {
      statusCode: 200,
      code(c: number) {
        this.statusCode = c
        return this
      },
      send() {
        return this
      },
    }
    await handler(
      { headers: {}, query: {} } as never,
      reply as unknown as Parameters<typeof handler>[1],
    )
    expect(reply.statusCode).toBe(503)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
