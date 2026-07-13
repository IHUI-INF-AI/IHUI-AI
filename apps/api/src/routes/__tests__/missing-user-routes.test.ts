import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'

describe('Missing User Routes API (支付/提现真实化端点)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(missingUserRoutes, { prefix: '/api' })
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

  describe('支付模块 11 端点 (401 without auth)', () => {
    const paymentEndpoints: Array<{
      method: 'GET' | 'POST'
      url: string
      payload?: Record<string, unknown>
    }> = [
      { method: 'POST', url: '/api/payment/order/ORD123/close' },
      { method: 'POST', url: '/api/payment/order/ORD123/sync' },
      { method: 'POST', url: '/api/payment/callback/verify', payload: {} },
      { method: 'GET', url: '/api/payment/orders/ORD123' },
      { method: 'GET', url: '/api/payment/refund/RF123' },
      { method: 'POST', url: '/api/payment/refund/RF123/cancel' },
      { method: 'GET', url: '/api/payment/refund/RF123/status' },
      { method: 'POST', url: '/api/payment/refund/RF123/audit', payload: { action: 'approved' } },
      {
        method: 'POST',
        url: '/api/payment/refund/RF123/process',
        payload: { status: 'processing' },
      },
      {
        method: 'POST',
        url: '/api/refunds/apply',
        payload: { orderId: '00000000-0000-0000-0000-000000000000' },
      },
      { method: 'GET', url: '/api/top-up/status/00000000-0000-0000-0000-000000000000' },
    ]

    for (const { method, url, payload } of paymentEndpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })

  describe('提现模块 7 端点 (401 without auth)', () => {
    const withdrawalEndpoints: Array<{
      method: 'GET' | 'POST'
      url: string
      payload?: Record<string, unknown>
    }> = [
      {
        method: 'POST',
        url: '/api/finance/withdrawal/withdrawal',
        payload: { amount: 100, method: 'alipay' },
      },
      { method: 'GET', url: '/api/finance/withdrawal/getWithdrawal' },
      { method: 'GET', url: '/api/finance/withdrawal/my-records' },
      { method: 'GET', url: '/api/finance/withdrawal/flows/list' },
      { method: 'GET', url: '/api/finance/withdrawal/flows/00000000-0000-0000-0000-000000000000' },
      {
        method: 'POST',
        url: '/api/finance/withdrawal/flows/00000000-0000-0000-0000-000000000000/approve',
      },
      {
        method: 'POST',
        url: '/api/finance/withdrawal/flows/00000000-0000-0000-0000-000000000000/reject',
        payload: { reason: 'test' },
      },
    ]

    for (const { method, url, payload } of withdrawalEndpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })

  describe('401 响应格式', () => {
    it('POST /api/refunds/apply 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/refunds/apply',
        payload: { orderId: '00000000-0000-0000-0000-000000000000' },
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })

    it('POST /api/finance/withdrawal/withdrawal 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/finance/withdrawal/withdrawal',
        payload: { amount: 100, method: 'alipay' },
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })
  })
})
