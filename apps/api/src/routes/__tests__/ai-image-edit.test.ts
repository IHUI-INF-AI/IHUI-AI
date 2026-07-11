import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// Ensure required env vars exist before route module imports are evaluated.
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

import { aiImageEditRoutes } from '../ai-image-edit.js'

describe('AI Image Edit API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(aiImageEditRoutes, { prefix: '/api' })
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
    it('POST /api/ai-image/doubao/edit', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/ai-image/doubao/edit' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/ai-image/doubao/inpaint', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/ai-image/doubao/inpaint' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/ai-image/tongyi/edit', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/ai-image/tongyi/edit' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/ai-image/tongyi/text-to-image', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/text-to-image',
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/ai-image/tongyi/image-to-image', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/image-to-image',
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/ai-image/history', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/ai-image/history' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/ai-image/history/:id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/ai-image/history/test-id',
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/ai-image/history/:id', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/ai-image/history/test-id',
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
