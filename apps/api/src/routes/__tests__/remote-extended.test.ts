import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// Ensure required env vars exist before route module imports are evaluated.
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

import { remoteExtendedRoutes } from '../remote-extended.js'

describe('Remote Extended API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(remoteExtendedRoutes, { prefix: '/api' })
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

  describe('Endpoints (401 without auth)', () => {
    it('GET /api/remote/user/info', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/remote/user/info' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/remote/business-card/upload', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/remote/business-card/upload' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/remote/agent/favorites', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/remote/agent/favorites' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/remote/agent/favorite', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/remote/agent/favorite' })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/remote/agent/favorite/:agentId', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/remote/agent/favorite/test-agent-id',
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/remote/tencent/asr', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/remote/tencent/asr' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/remote/withdrawal/switch', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/remote/withdrawal/switch' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/remote/withdrawal/switch', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/remote/withdrawal/switch' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/remote/user/stats', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/remote/user/stats' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/remote/agent/hot', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/remote/agent/hot' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/remote/feedback', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/remote/feedback' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/remote/config', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/remote/config' })
      expect(res.statusCode).toBe(401)
    })
  })
})
