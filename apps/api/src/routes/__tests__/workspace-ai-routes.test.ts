import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { missingUserRoutes } from '../missing-user-routes.js'

describe('Workspace-AI Routes API (Workspace-AI 模块真实化端点)', () => {
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

  describe('Workspace-AI 模块 2 端点 (401 without auth)', () => {
    const workspaceAiEndpoints: Array<{
      method: 'GET' | 'POST'
      url: string
      payload?: Record<string, unknown>
    }> = [
      {
        method: 'POST',
        url: '/api/workspace-ai/generate-component',
        payload: { input: 'button', prompt: 'create a button' },
      },
      {
        method: 'POST',
        url: '/api/workspace-ai/agentic',
        payload: { input: 'task', type: 'agentic' },
      },
    ]

    for (const { method, url, payload } of workspaceAiEndpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })

  describe('401 响应格式', () => {
    it('POST /api/workspace-ai/generate-component 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/workspace-ai/generate-component',
        payload: { input: 'button' },
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })

    it('POST /api/workspace-ai/agentic 返回标准 { code, message } 格式', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/workspace-ai/agentic',
        payload: { input: 'task', type: 'agentic' },
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toHaveProperty('code', 401)
      expect(body).toHaveProperty('message')
    })
  })
})
