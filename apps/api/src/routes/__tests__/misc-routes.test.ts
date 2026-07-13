import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'

describe('Misc Routes API (消息/证书/资源真实化端点)', () => {
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

  describe('零散端点 (401 without auth)', () => {
    const endpoints: Array<{
      method: 'GET' | 'POST'
      url: string
      payload?: Record<string, unknown>
    }> = [
      { method: 'GET', url: '/api/notifications/00000000-0000-0000-0000-000000000000' },
      { method: 'GET', url: '/api/messages/00000000-0000-0000-0000-000000000000' },
      { method: 'GET', url: '/api/resources/00000000-0000-0000-0000-000000000000/download' },
      { method: 'POST', url: '/api/resources/00000000-0000-0000-0000-000000000000/like' },
      {
        method: 'POST',
        url: '/api/certificates/issue',
        payload: {
          userId: '00000000-0000-0000-0000-000000000000',
          templateId: '00000000-0000-0000-0000-000000000000',
          title: 'test',
        },
      },
      { method: 'POST', url: '/api/certificates/00000000-0000-0000-0000-000000000000/revoke' },
    ]

    for (const { method, url, payload } of endpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })
})
