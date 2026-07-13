import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'

describe('Settings Full Routes API (security-logs/export/delete-account 真实化)', () => {
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

  describe('Settings 真实化端点 (401 without auth)', () => {
    const endpoints: Array<{
      method: 'GET' | 'POST'
      url: string
    }> = [
      { method: 'GET', url: '/api/settings/security-logs' },
      { method: 'GET', url: '/api/settings/export' },
      { method: 'POST', url: '/api/settings/delete-account' },
    ]

    for (const { method, url } of endpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url })
        expect(res.statusCode).toBe(401)
      })
    }
  })

  describe('401 响应格式校验', () => {
    it('GET /api/settings/security-logs 401 响应体为 { code: 401, message } 无 data', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/settings/security-logs' })
      const body = res.json()
      expect(body.code).toBe(401)
      expect(typeof body.message).toBe('string')
      expect(body).not.toHaveProperty('data')
    })

    it('POST /api/settings/delete-account 401 响应体为 { code: 401, message } 无 data', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/settings/delete-account' })
      const body = res.json()
      expect(body.code).toBe(401)
      expect(typeof body.message).toBe('string')
      expect(body).not.toHaveProperty('data')
    })
  })
})
