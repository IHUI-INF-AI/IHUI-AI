import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// Ensure required env vars exist before route module imports are evaluated.
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

import { notificationExtendedRoutes } from '../notification-extended.js'

describe('Notification Extended API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(notificationExtendedRoutes, { prefix: '/api' })
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
    it('GET /api/notifications/channels', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/notifications/channels' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/notifications/channels', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/notifications/channels' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/notifications/channels/:id', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/notifications/channels/00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/notifications/channels/:id', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/notifications/channels/00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/notifications/preferences', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/notifications/preferences' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/notifications/preferences', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/notifications/preferences' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/notifications/logs', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/notifications/logs' })
      expect(res.statusCode).toBe(401)
    })
  })
})
