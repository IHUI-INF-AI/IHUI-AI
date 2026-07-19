import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'

describe('AI Modules Routes API (ai/ai-ext 真实化端点)', () => {
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

  describe('AI 模块端点 (401 without auth)', () => {
    // 注:POST /api/ai-ext/capabilities/:id/toggle 已在 ai-extended.ts 注册,
    // missing-user-routes.ts 不重复注册(避免 Fastify 重复路由错误),
    // 本测试只挂载 missingUserRoutes,故该端点不在此列表中断言 401。
    const endpoints: Array<{
      method: 'GET' | 'POST' | 'DELETE'
      url: string
      payload?: Record<string, unknown>
    }> = [
      { method: 'GET', url: '/api/ai/index' },
      { method: 'GET', url: '/api/ai/team' },
      { method: 'GET', url: '/api/ai/team/00000000-0000-0000-0000-000000000000' },
      {
        method: 'POST',
        url: '/api/ai/chat/conversations',
        payload: { title: 'test', modelId: 'gpt-4' },
      },
      { method: 'GET', url: '/api/ai/chat/conversations' },
      { method: 'DELETE', url: '/api/ai/chat/conversations/00000000-0000-0000-0000-000000000000' },
      { method: 'POST', url: '/api/ai/aigc/tasks/task-1/cancel' },
      { method: 'GET', url: '/api/ai-ext/reports' },
      {
        method: 'POST',
        url: '/api/ai-ext/reports/generate',
        payload: { type: 'usage', content: 'monthly' },
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
