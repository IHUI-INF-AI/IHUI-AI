import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { adminRoutes } from '../admin.js'

describe('Admin Integration Tests (admin 路由鉴权集成)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('无 Bearer token → 401', () => {
    const endpoints: Array<{ method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; url: string }> = [
      { method: 'GET', url: '/api/admin/stats' },
      { method: 'GET', url: '/api/admin/users' },
      { method: 'GET', url: '/api/admin/projects' },
      { method: 'GET', url: '/api/admin/users/00000000-0000-0000-0000-000000000000' },
      { method: 'GET', url: '/api/admin/projects/00000000-0000-0000-0000-000000000000' },
      { method: 'POST', url: '/api/admin/projects' },
      { method: 'PATCH', url: '/api/admin/projects/00000000-0000-0000-0000-000000000000' },
      { method: 'DELETE', url: '/api/admin/projects/00000000-0000-0000-0000-000000000000' },
    ]

    for (const { method, url } of endpoints) {
      it(`${method} ${url} 无 Bearer token 返回 401`, async () => {
        const res = await app.inject({ method, url })
        expect(res.statusCode).toBe(401)
      })
    }
  })

  describe('无效 token → 401', () => {
    it('GET /api/admin/stats 无效 token 返回 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/stats',
        headers: { authorization: 'Bearer invalid-token' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/admin/users 无效 token 返回 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: 'Bearer invalid-token' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('401 响应格式', () => {
    it('响应体为 { code: 401, message }', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/admin/stats' })
      const body = JSON.parse(res.body)
      expect(body.code).toBe(401)
      expect(body.message).toBeTruthy()
    })
  })
})
