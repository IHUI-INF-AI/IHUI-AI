import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-0000-0000-000000000002',
    roleId: 0,
  }),
  verifyRefreshToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-0000-0000-000000000002',
    roleId: 0,
  }),
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000002'),
}))

vi.mock('../src/db/index.js', () => {
  function createChain(result: unknown[] = [{ id: 'mock-id' }]) {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => Promise.resolve(result).then(resolve),
    }
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'values', 'set', 'returning']) {
      chain[m] = () => chain
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([{ id: 'mock-id', count: 0 }]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
  }
})

import { notificationExtendedRoutes } from '../src/routes/notification-extended'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }
const MOCK_UUID = '00000000-0000-0000-0000-000000000001'

describe('notification-extended routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((error, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : error.message,
      })
    })
    await server.register(notificationExtendedRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('401 未授权', () => {
    it('GET /api/notifications/channels 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/notifications/channels' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/notifications/channels 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/notifications/channels',
        body: { name: '邮件渠道', type: 'email' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/notifications/channels/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/notifications/channels/${MOCK_UUID}`,
        body: { name: '更新渠道' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/notifications/channels/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/notifications/channels/${MOCK_UUID}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/notifications/preferences 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/notifications/preferences' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/notifications/preferences 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/api/notifications/preferences',
        body: { emailEnabled: false },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/notifications/logs 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/notifications/logs' })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('带认证', () => {
    it('GET /api/notifications/channels 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/notifications/channels',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/notifications/channels 返回 201', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/notifications/channels',
        headers: AUTH_HEADERS,
        body: { name: '邮件渠道', type: 'email', isActive: true },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/notifications/channels/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/notifications/channels/${MOCK_UUID}`,
        headers: AUTH_HEADERS,
        body: { name: '更新渠道名', isActive: false },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('DELETE /api/notifications/channels/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/notifications/channels/${MOCK_UUID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/notifications/preferences 返回 200（无记录时返回默认偏好）', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/notifications/preferences',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/notifications/preferences 返回 200', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/api/notifications/preferences',
        headers: AUTH_HEADERS,
        body: { emailEnabled: false, pushEnabled: true, types: ['system', 'order'] },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/notifications/logs 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/notifications/logs',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })
  })
})
