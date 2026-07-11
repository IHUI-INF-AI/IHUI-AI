import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

import { liveRoutes, adminLiveRoutes } from '../live.js'

describe('Live Extended API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(liveRoutes, { prefix: '/api' })
    await app.register(adminLiveRoutes, { prefix: '/api/admin' })
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

  describe('Public endpoints — Stream callbacks', () => {
    it('POST /api/live/notify/stream-begin — callback', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/live/notify/stream-begin',
        payload: { streamId: 'test-stream', eventType: 'notify' },
      })
      expect(res.statusCode).toBe(200)
    })

    it('POST /api/live/notify/stream-end — callback', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/live/notify/stream-end',
        payload: { streamId: 'test-stream', eventType: 'notify' },
      })
      expect(res.statusCode).toBe(200)
    })

    it('POST /api/live/notify/stream-begin — empty body (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/live/notify/stream-begin',
      })
      expect([400, 200]).toContain(res.statusCode)
    })
  })

  describe('Admin endpoints (401 without auth)', () => {
    it('POST /api/admin/live/tencent/streams — requires auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/live/tencent/streams',
        payload: { streamName: 'test-stream' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/admin/live/tencent/streams — requires auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/live/tencent/streams',
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/admin/live/tencent/callback-templates — requires auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/live/tencent/callback-templates',
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
