import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'

describe('Fund Routes API (基金模块真实化端点)', () => {
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

  describe('基金模块 6 端点 (401 without auth)', () => {
    const fundEndpoints: Array<{
      method: 'GET' | 'POST'
      url: string
      payload?: Record<string, unknown>
    }> = [
      { method: 'POST', url: '/api/fund/ali/pay/create' },
      { method: 'POST', url: '/api/fund/ali/pay/create2' },
      { method: 'GET', url: '/api/fund/ali/pay/alipay/return' },
      { method: 'GET', url: '/api/fund' },
      { method: 'GET', url: '/api/fund/000001' },
      { method: 'GET', url: '/api/fund/000001/net-values' },
    ]

    for (const { method, url, payload } of fundEndpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })

  describe('401 响应格式', () => {
    it('GET /api/fund 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/fund' })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })

    it('GET /api/fund/:code 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/fund/000001' })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })

    it('GET /api/fund/:code/net-values 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/fund/000001/net-values' })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })
  })
})
