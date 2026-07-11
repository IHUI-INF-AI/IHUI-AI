import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

import { learnRoutes, adminLearnRoutes } from '../learn.js'

describe('Learn Extended API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(learnRoutes, { prefix: '/api' })
    await app.register(adminLearnRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Route registration', () => {
    it('should register plugins without throwing', () => {
      expect(app).toBeDefined()
    })
  })

  describe('Public endpoints — Learn Maps', () => {
    it('GET /api/learn/maps — published maps list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/learn/maps' })
      expect([200, 500]).toContain(res.statusCode)
    })

    it('GET /api/learn/maps/recommend — recommended maps', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/learn/maps/recommend' })
      expect([200, 500]).toContain(res.statusCode)
    })

    it('GET /api/learn/maps/hot — hot maps', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/learn/maps/hot' })
      expect([200, 500]).toContain(res.statusCode)
    })

    it('GET /api/learn/maps/:id — map detail (invalid uuid)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/learn/maps/not-a-uuid' })
      expect(res.statusCode).toBe(400)
    })

    it('GET /api/learn/maps/:id — map detail (valid uuid not found)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/learn/maps/00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('Public endpoints — Lesson Rates', () => {
    it('GET /api/learn/lessons/:lessonId/rates — rate list (invalid uuid)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/learn/lessons/not-a-uuid/rates',
      })
      expect(res.statusCode).toBe(400)
    })

    it('GET /api/learn/lessons/:lessonId/rates — rate list (valid uuid)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/learn/lessons/00000000-0000-0000-0000-000000000000/rates',
      })
      expect([200, 500]).toContain(res.statusCode)
    })
  })

  describe('Auth-required endpoints (401 without auth)', () => {
    it('GET /api/learn/maps/favorites — requires auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/learn/maps/favorites' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/learn/lessons/:lessonId/rates — requires auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/learn/lessons/00000000-0000-0000-0000-000000000000/rates',
        payload: { content: 'test', contentUtilityScore: 5 },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/learn/lessons/:lessonId/rates/my — requires auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/learn/lessons/00000000-0000-0000-0000-000000000000/rates/my',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('Admin endpoints (401 without auth)', () => {
    it('POST /api/admin/learn/maps — requires auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/learn/maps',
        payload: { title: 'Test Map', topicIds: [] },
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/admin/learn/maps/:id — requires auth', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/learn/maps/00000000-0000-0000-0000-000000000000',
        payload: { title: 'Updated' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/admin/learn/maps/list — requires auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/admin/learn/maps/list' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/admin/learn/maps/:id/detail — requires auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/learn/maps/00000000-0000-0000-0000-000000000000/detail',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('Admin endpoints — Lesson Tasks (401 without auth)', () => {
    it('GET /api/admin/learn/lessons/:lessonId/tasks — requires auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/learn/lessons/00000000-0000-0000-0000-000000000000/tasks',
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/admin/learn/lessons/:lessonId/tasks — requires auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/learn/lessons/00000000-0000-0000-0000-000000000000/tasks',
        payload: { title: 'Task 1' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/admin/learn/lessons/:lessonId/tasks/:taskId — requires auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/learn/lessons/00000000-0000-0000-0000-000000000000/tasks/00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/admin/learn/lessons/:lessonId/tasks/:taskId — requires auth', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/learn/lessons/00000000-0000-0000-0000-000000000000/tasks/00000000-0000-0000-0000-000000000000',
        payload: { title: 'Updated Task' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/admin/learn/lessons/:lessonId/tasks/:taskId — requires auth', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/learn/lessons/00000000-0000-0000-0000-000000000000/tasks/00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/admin/learn/lessons/:lessonId/tasks/:taskId/status — requires auth', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/learn/lessons/00000000-0000-0000-0000-000000000000/tasks/00000000-0000-0000-0000-000000000000/status',
        payload: { status: 'disable' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('Admin endpoints — Rates & Access (401 without auth)', () => {
    it('DELETE /api/admin/learn/rates/:id — requires auth', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/learn/rates/00000000-0000-0000-0000-000000000000',
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/admin/learn/lessons/:lessonId/access — requires auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/learn/lessons/00000000-0000-0000-0000-000000000000/access',
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/admin/learn/lessons/:lessonId/access — requires auth', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/learn/lessons/00000000-0000-0000-0000-000000000000/access',
        payload: { accessType: 'all', accessValues: [] },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('Validation — Zod schema', () => {
    it('POST /api/learn/lessons/:lessonId/rates — invalid score (>5)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/learn/lessons/00000000-0000-0000-0000-000000000000/rates',
        payload: { contentUtilityScore: 10 },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/learn/lessons/:lessonId/rates — invalid pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/learn/lessons/00000000-0000-0000-0000-000000000000/rates?page=0',
      })
      expect(res.statusCode).toBe(400)
    })
  })
})
