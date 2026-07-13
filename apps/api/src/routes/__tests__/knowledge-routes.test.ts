import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'

describe('Knowledge Routes API (知识库模块真实化端点)', () => {
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

  describe('知识库模块 6 端点 (401 without auth)', () => {
    const knowledgeEndpoints: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE'
      url: string
      payload?: Record<string, unknown>
    }> = [
      { method: 'GET', url: '/api/knowledge' },
      { method: 'GET', url: '/api/knowledge/00000000-0000-0000-0000-000000000000' },
      {
        method: 'POST',
        url: '/api/knowledge/00000000-0000-0000-0000-000000000000/like',
      },
      { method: 'POST', url: '/api/knowledge', payload: { title: 'test', content: 'test' } },
      {
        method: 'PUT',
        url: '/api/knowledge/00000000-0000-0000-0000-000000000000',
        payload: { title: 'test' },
      },
      { method: 'DELETE', url: '/api/knowledge/00000000-0000-0000-0000-000000000000' },
    ]

    for (const { method, url, payload } of knowledgeEndpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })

  describe('401 响应格式', () => {
    it('GET /api/knowledge 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/knowledge' })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })

    it('POST /api/knowledge 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge',
        payload: { title: 'test', content: 'test' },
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })
  })
})
