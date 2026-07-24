import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

// Mock alipay verifyNotify:测试 alipay/notify 公开回调时跳过真实验签。
vi.mock('../../services/alipay.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/alipay.js')>()
  return {
    ...actual,
    verifyNotify: vi.fn(() => true),
  }
})

import { paymentGatewayRoutes, adminPaymentGatewayRoutes } from '../payment-gateway.js'

describe('Payment Gateway API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(paymentGatewayRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Route registration', () => {
    it('should register the route plugin without throwing', () => {
      expect(app).toBeDefined()
    })
  })

  describe('公开端点', () => {
    it('GET /api/payments/success 返回 200 与订单号', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/payments/success?orderNo=ORD123',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.orderNo).toBe('ORD123')
      expect(body.data.msg).toBe('Payment success')
    })

    it('GET /api/payments/success 无 orderNo 时仍返回 200', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/payments/success',
      })
      expect(res.statusCode).toBe(200)
    })

    it('GET /api/payments/fail 返回 500 与错误信息', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/payments/fail',
      })
      expect(res.statusCode).toBe(500)
      const body = res.json()
      expect(body.code).toBe(500)
      expect(body.message).toBe('Payment failed, please retry')
    })

    it('POST /api/payments/wechat/notify 无 resource 时返回 SUCCESS', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/notify',
        payload: {},
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe('SUCCESS')
      expect(body.message).toBe('No resource')
    })

    it('POST /api/payments/wechat/notify/refund 无 resource 时返回 SUCCESS', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/wechat/notify/refund',
        payload: {},
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe('SUCCESS')
    })

    it('POST /api/payments/alipay/notify 无 trade_status 时返回 success 文本', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/alipay/notify',
        payload: { sign: 'test-sign' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('text/plain')
      expect(res.body).toBe('success')
    })
  })

  describe('Endpoints (401 without auth)', () => {
    const protectedEndpoints: Array<{ method: 'GET' | 'POST'; url: string; payload?: Record<string, unknown> }> = [
      { method: 'POST', url: '/api/payments/wechat/create', payload: {} },
      { method: 'POST', url: '/api/payments/wechat/android/create', payload: {} },
      { method: 'POST', url: '/api/payments/wechat/course/create', payload: {} },
      { method: 'POST', url: '/api/payments/wechat/query' },
      { method: 'POST', url: '/api/payments/wechat/close' },
      { method: 'POST', url: '/api/payments/wechat/refund', payload: {} },
      { method: 'GET', url: '/api/payments/wechat/status/ORD123' },
      { method: 'POST', url: '/api/payments/alipay/create', payload: {} },
      { method: 'POST', url: '/api/payments/alipay/app/create', payload: {} },
      { method: 'POST', url: '/api/payments/alipay/query' },
      { method: 'POST', url: '/api/payments/alipay/refund', payload: {} },
      { method: 'POST', url: '/api/payments/createOrder', payload: {} },
      { method: 'POST', url: '/api/payments/wechatPay', payload: {} },
      { method: 'POST', url: '/api/payments/transfer', payload: {} },
      { method: 'POST', url: '/api/payments/withdrawal', payload: {} },
      { method: 'GET', url: '/api/payments/reconciliation/pending' },
      { method: 'POST', url: '/api/payments/reconciliation/close_expired' },
    ]

    for (const { method, url, payload } of protectedEndpoints) {
      it(`${method} ${url}`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })
})

describe('Payment Gateway Admin API (401 without auth)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminPaymentGatewayRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('should register admin route plugin without throwing', () => {
    expect(app).toBeDefined()
  })

  it('GET /api/payments/reconciliation/alipay (无 auth 返回 401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/payments/reconciliation/alipay',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/payments/reconciliation/wechat (无 auth 返回 401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/payments/reconciliation/wechat',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/payments/reconciliation/all (无 auth 返回 401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/payments/reconciliation/all',
    })
    expect(res.statusCode).toBe(401)
  })
})
