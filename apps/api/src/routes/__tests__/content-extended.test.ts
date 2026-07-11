import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// Ensure required env vars exist before route module imports are evaluated.
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

import { contentExtendedRoutes } from '../content-extended.js'

describe('Content Extended API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(contentExtendedRoutes, { prefix: '/api' })
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
    it('GET /api/content/activities/list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/content/activities/list' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/content/activities', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/content/activities' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/content/activities/:id', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/content/activities/test-id',
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/content/activities/:id', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/content/activities/test-id',
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/content/contacts/list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/content/contacts/list' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/content/contacts/:id', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/content/contacts/test-id' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/content/file-storage/list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/content/file-storage/list' })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/content/file-storage/:id', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/content/file-storage/test-id',
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/content/aigc/list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/content/aigc/list' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/content/aigc', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/content/aigc' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/content/banners/list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/content/banners/list' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/content/banners/:id', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/content/banners/test-id' })
      expect(res.statusCode).toBe(401)
    })
  })
})
