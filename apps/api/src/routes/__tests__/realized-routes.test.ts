import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'

describe('Realized Routes API (8 端点真实化 - 401 without auth)', () => {
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

  describe('真实化端点 (401 without auth)', () => {
    const endpoints: Array<{
      method: 'GET' | 'POST' | 'PUT'
      url: string
      payload?: Record<string, unknown>
    }> = [
      // 1. POST /study/records
      {
        method: 'POST',
        url: '/api/study/records',
        payload: { lessonId: '00000000-0000-0000-0000-000000000000', progress: 50 },
      },
      // 2. PUT /study/records/:id
      {
        method: 'PUT',
        url: '/api/study/records/00000000-0000-0000-0000-000000000000',
        payload: { progress: 80 },
      },
      // 3. GET /members/me
      { method: 'GET', url: '/api/members/me' },
      // 4. GET /coze/chat/history/:botId/:conversationId
      { method: 'GET', url: '/api/coze/chat/history/bot-001/conv-001' },
      // 6. GET /ai/careers
      { method: 'GET', url: '/api/ai/careers' },
      // 7. GET /ai/chat-types
      { method: 'GET', url: '/api/ai/chat-types' },
      // 8. GET /ai/community
      { method: 'GET', url: '/api/ai/community' },
    ]

    for (const { method, url, payload } of endpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })

  describe('401 响应格式校验', () => {
    it('GET /api/members/me 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/members/me' })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })

    it('GET /api/ai/careers 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/ai/careers' })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })

    it('GET /api/coze/chat/history/... 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/coze/chat/history/bot-001/conv-001',
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })
  })
})
