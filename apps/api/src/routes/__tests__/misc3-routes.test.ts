import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'

describe('Misc3 Routes API (站点分类/埋点真实化端点)', () => {
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

  describe('站点分类/埋点端点 (401 without auth)', () => {
    const endpoints: Array<{
      method: 'GET' | 'POST'
      url: string
      payload?: Record<string, unknown>
    }> = [
      { method: 'GET', url: '/api/categories' },
      { method: 'GET', url: '/api/categories?type=article' },
      {
        method: 'POST',
        url: '/api/analytics/track',
        payload: { event: 'page_view', properties: { page: '/home' } },
      },
    ]

    for (const { method, url, payload } of endpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })
})
