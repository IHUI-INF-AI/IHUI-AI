import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'

describe('Course Routes API (course 模块 4 端点真实化)', () => {
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
    it('app 注册成功', () => {
      expect(app).toBeTruthy()
    })
  })

  describe('course 端点 (401 without auth)', () => {
    const endpoints: Array<{
      method: 'GET' | 'POST'
      url: string
      payload?: Record<string, unknown>
    }> = [
      { method: 'POST', url: '/api/course/00000000-0000-0000-0000-000000000000/enroll' },
      { method: 'GET', url: '/api/course/00000000-0000-0000-0000-000000000000/progress' },
      {
        method: 'POST',
        url: '/api/course/lesson-complete',
        payload: { lessonId: '00000000-0000-0000-0000-000000000000' },
      },
      { method: 'GET', url: '/api/course/my' },
    ]

    for (const { method, url, payload } of endpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }

    it('401 响应体为 { code: 401, message }', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/course/my' })
      const body = JSON.parse(res.body)
      expect(body.code).toBe(401)
      expect(body.message).toBeTruthy()
    })

    it('401 响应包含认证错误信息', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/course/00000000-0000-0000-0000-000000000000/enroll',
      })
      const body = JSON.parse(res.body)
      expect(body.message).toBeTruthy()
    })
  })
})
