import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'

const UUID_ZERO = '00000000-0000-0000-0000-000000000000'

describe('Likes & Notification Routes API (真实化端点)', () => {
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

  describe('Like/Favorite/Notification 端点 (401 without auth)', () => {
    const endpoints: Array<{
      method: 'GET' | 'POST'
      url: string
      payload?: Record<string, unknown>
    }> = [
      { method: 'POST', url: '/api/article/like', payload: { id: UUID_ZERO } },
      { method: 'POST', url: '/api/article/favorite', payload: { id: UUID_ZERO } },
      { method: 'POST', url: `/api/resources/${UUID_ZERO}/like` },
      { method: 'POST', url: `/api/knowledge/${UUID_ZERO}/like` },
      { method: 'GET', url: `/api/notifications/${UUID_ZERO}` },
    ]

    for (const { method, url, payload } of endpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })

  describe('响应格式校验', () => {
    it('POST /article/like 401 响应包含 code 与 message 字段', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/article/like',
        payload: { id: UUID_ZERO },
      })
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
      expect(typeof body.message).toBe('string')
    })

    it('GET /notifications/:id 401 响应包含 code 与 message 字段', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/notifications/${UUID_ZERO}`,
      })
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
      expect(typeof body.message).toBe('string')
    })
  })
})
