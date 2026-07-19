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

  // 注:GET /api/knowledge 列表/详情是公开内容(首页教育概览需展示给所有用户),
  // missing-user-routes.ts 中 isPublicKnowledgeGet 显式跳过鉴权,因此 GET 不返回 401。
  describe('知识库模块 4 端点 (401 without auth, GET 公开访问)', () => {
    const knowledgeEndpoints: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE'
      url: string
      payload?: Record<string, unknown>
    }> = [
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

  describe('GET /api/knowledge 公开访问 (无需 auth)', () => {
    it('GET /api/knowledge 无 auth 返回 200 (公开列表)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/knowledge' })
      expect(res.statusCode).toBe(200)
    })

    it('GET /api/knowledge/:id 无 auth 返回 404 (公开详情,资源不存在)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge/00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('401 响应格式', () => {
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
