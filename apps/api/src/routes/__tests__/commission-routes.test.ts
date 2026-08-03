import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'
import { distributionRoutes } from '../distribution.js'

describe('Commission Routes API (分销模块真实化端点)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(missingUserRoutes, { prefix: '/api' })
    // distributionRoutes 是 commission-routes 的官方迁移(路径 /commission/* → /distribution/*,
    // 见 distribution.ts 第 355 行注释)。注册后无 auth 访问应返回 401(preHandler 拦截)。
    await app.register(distributionRoutes, { prefix: '/api' })
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

  // commission 路由已迁移至 distribution.ts(路径 /commission/* → /distribution/*)。
  // 测试 setup 注册 distributionRoutes,无 auth 访问应返回 401(preHandler 拦截)。
  describe('分销模块 4 端点 (401 without auth)', () => {
    const commissionEndpoints: Array<{ method: 'GET' | 'POST'; url: string }> = [
      { method: 'GET', url: '/api/distribution/overview' },
      { method: 'GET', url: '/api/distribution/invite-info' },
      { method: 'GET', url: '/api/distribution/invited-users' },
      { method: 'GET', url: '/api/distribution/list' },
    ]

    for (const { method, url } of commissionEndpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url })
        expect(res.statusCode).toBe(401)
      })
    }
  })

  describe('401 响应格式', () => {
    it('GET /api/distribution/overview 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/distribution/overview' })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })

    it('GET /api/distribution/list 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/distribution/list' })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })
  })
})
