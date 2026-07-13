import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'

describe('AI Feed/World Routes API (资讯/世界模块真实化端点)', () => {
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

  describe('AI Feed/World 模块 4 端点 (401 without auth)', () => {
    const aiFeedWorldEndpoints: Array<{
      method: 'GET' | 'POST'
      url: string
      payload?: Record<string, unknown>
    }> = [
      { method: 'GET', url: '/api/ai-feed' },
      { method: 'GET', url: '/api/ai-feed/00000000-0000-0000-0000-000000000000' },
      { method: 'GET', url: '/api/ai-world/categories' },
      { method: 'GET', url: '/api/ai-world/00000000-0000-0000-0000-000000000000' },
    ]

    for (const { method, url, payload } of aiFeedWorldEndpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })

  describe('401 响应格式', () => {
    it('GET /api/ai-feed 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/ai-feed' })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })

    it('GET /api/ai-feed/:id 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/ai-feed/00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })

    it('GET /api/ai-world/categories 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/ai-world/categories' })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })

    it('GET /api/ai-world/:id 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/ai-world/00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })
  })
})
