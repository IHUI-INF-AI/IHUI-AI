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

import { organizationRoutes } from '../src/routes/organization'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }
const MOCK_ORG_ID = 'org-001'
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000002'

describe('organization routes', () => {
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
    await server.register(organizationRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('401 未授权', () => {
    it('GET /api/organizations/list 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/organizations/list' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/organizations 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/organizations',
        body: { name: '测试组织' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/organizations/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/organizations/${MOCK_ORG_ID}`,
        body: { name: '更新组织' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/organizations/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/organizations/${MOCK_ORG_ID}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/organizations/:id/members 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/organizations/${MOCK_ORG_ID}/members`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/organizations/:id/members 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/organizations/${MOCK_ORG_ID}/members`,
        body: { userId: MOCK_USER_ID, role: 'member' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/organizations/:id/members/:userId 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/organizations/${MOCK_ORG_ID}/members/${MOCK_USER_ID}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/organizations/:id/tree 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/organizations/${MOCK_ORG_ID}/tree`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/organizations/:id/members/:userId/role 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/organizations/${MOCK_ORG_ID}/members/${MOCK_USER_ID}/role`,
        body: { role: 'admin' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('带认证', () => {
    it('GET /api/organizations/list 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/organizations/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/organizations 返回 201', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/organizations',
        headers: AUTH_HEADERS,
        body: { name: '测试组织', description: '用于测试' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/organizations/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/organizations/${MOCK_ORG_ID}`,
        headers: AUTH_HEADERS,
        body: { name: '更新组织名' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('DELETE /api/organizations/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/organizations/${MOCK_ORG_ID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/organizations/:id/members 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/organizations/${MOCK_ORG_ID}/members`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/organizations/:id/members 带认证返回非 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/organizations/${MOCK_ORG_ID}/members`,
        headers: AUTH_HEADERS,
        body: { userId: MOCK_USER_ID, role: 'member' },
      })
      expect(res.statusCode).not.toBe(401)
    })

    it('DELETE /api/organizations/:id/members/:userId 带认证返回非 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/organizations/${MOCK_ORG_ID}/members/${MOCK_USER_ID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).not.toBe(401)
    })

    it('GET /api/organizations/:id/tree 带认证返回非 401', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/organizations/${MOCK_ORG_ID}/tree`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).not.toBe(401)
    })

    it('PUT /api/organizations/:id/members/:userId/role 带认证返回非 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/organizations/${MOCK_ORG_ID}/members/${MOCK_USER_ID}/role`,
        headers: AUTH_HEADERS,
        body: { role: 'admin' },
      })
      expect(res.statusCode).not.toBe(401)
    })
  })
})
