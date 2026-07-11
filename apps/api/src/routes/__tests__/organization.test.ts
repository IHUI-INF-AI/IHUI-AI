import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// Ensure required env vars exist before route module imports are evaluated.
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

import { organizationRoutes } from '../organization.js'

describe('Organization API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(organizationRoutes, { prefix: '/api' })
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
    it('GET /api/organizations/list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/organizations/list' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/organizations', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/organizations' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/organizations/:id', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/organizations/test-id' })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/organizations/:id', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/organizations/test-id' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/organizations/:id/members', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/organizations/test-id/members',
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/organizations/:id/members', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/organizations/test-id/members',
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/organizations/:id/members/:userId', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/organizations/test-id/members/test-user-id',
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/organizations/:id/tree', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/organizations/test-id/tree',
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/organizations/:id/members/:userId/role', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/organizations/test-id/members/test-user-id/role',
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
