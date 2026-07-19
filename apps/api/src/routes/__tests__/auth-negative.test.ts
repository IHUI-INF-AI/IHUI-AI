import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'

describe('Auth Negative Tests (无 Bearer token → 401)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(missingUserRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  // 注:GET /api/knowledge 列表/详情是公开访问(见 missing-user-routes.ts isPublicKnowledgeGet),
  // 不在此处断言 401。
  const endpoints: Array<{ method: 'GET' | 'POST'; url: string }> = [
    { method: 'GET', url: '/api/article/list' },
    { method: 'GET', url: '/api/commission/overview' },
    { method: 'GET', url: '/api/course/my' },
    { method: 'GET', url: '/api/settings/notifications' },
    { method: 'GET', url: '/api/mcp' },
    { method: 'GET', url: '/api/fund' },
    { method: 'GET', url: '/api/ai/index' },
    { method: 'GET', url: '/api/developer/info' },
    { method: 'POST', url: '/api/analytics/track' },
  ]

  for (const { method, url } of endpoints) {
    it(`${method} ${url} 无 Bearer token 返回 401`, async () => {
      const res = await app.inject({ method, url })
      expect(res.statusCode).toBe(401)
    })
  }

  it('GET /api/article/list 无效 token 返回 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/article/list',
      headers: { authorization: 'Bearer invalid-token' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('401 响应体为 { code: 401, message }', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/article/list' })
    const body = JSON.parse(res.body)
    expect(body.code).toBe(401)
    expect(body.message).toBeTruthy()
  })
})
