import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { paymentExtendedRoutes } from '../payment-extended.js'

describe('Payment Extended API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(paymentExtendedRoutes, { prefix: '/api' })
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

  describe('POST /api/payments/withdrawal/notify (公开端点)', () => {
    it('无 out_bill_no 时返回 SUCCESS（幂等）', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/withdrawal/notify',
        payload: {},
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe('SUCCESS')
      expect(body.message).toBe('OK')
    })

    it('无 body 时被 catch 接住返回 SUCCESS', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/withdrawal/notify',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe('SUCCESS')
    })
  })

  describe('GET /api/payments/sync-return (公开端点)', () => {
    it('无 out_trade_no 时 302 重定向到 fail 页', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/payments/sync-return',
      })
      expect(res.statusCode).toBe(302)
      const location = res.headers['location']
      expect(location).toContain('/payment/fail')
    })

    it('trade_status 非 TRADE_SUCCESS 时 302 重定向到 fail 页', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/payments/sync-return?out_trade_no=ORD123&trade_status=WAIT_BUYER_PAY',
      })
      expect(res.statusCode).toBe(302)
      const location = res.headers['location']
      expect(location).toContain('/payment/fail')
    })
  })

  describe('Endpoints (401 without auth)', () => {
    it('POST /api/payments/subscription/renew', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/payments/subscription/renew',
        payload: { planId: '00000000-0000-0000-0000-000000000000', paymentMethod: 'wechat' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/payments/subscription/status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/payments/subscription/status',
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
