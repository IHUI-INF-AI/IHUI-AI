import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

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

import { contentExtendedRoutes } from '../src/routes/content-extended'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }
const MOCK_ID = '1'

describe('content-extended routes', () => {
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
    await server.register(contentExtendedRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('401 未授权', () => {
    it('GET /api/content/activities/list 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/content/activities/list' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/content/activities 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/content/activities',
        body: { title: '活动标题', content: '活动内容' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/content/activities/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/content/activities/${MOCK_ID}`,
        body: { title: '更新标题' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/content/activities/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/content/activities/${MOCK_ID}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/content/contacts/list 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/content/contacts/list' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/content/contacts/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/content/contacts/${MOCK_ID}`,
        body: { status: 'resolved' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/content/file-storage/list 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/content/file-storage/list' })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/content/file-storage/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/content/file-storage/${MOCK_ID}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/content/aigc/list 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/content/aigc/list' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/content/aigc 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/content/aigc',
        body: { type: 'text', prompt: '生成图片', resultUrl: 'https://example.com/img.png' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/content/banners/list 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/content/banners/list' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/content/banners/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/content/banners/${MOCK_ID}`,
        body: { title: '更新横幅' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('带认证', () => {
    it('GET /api/content/activities/list 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/content/activities/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/content/activities 返回 201', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/content/activities',
        headers: AUTH_HEADERS,
        body: { title: '活动标题', content: '活动内容', status: 0 },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/content/activities/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/content/activities/${MOCK_ID}`,
        headers: AUTH_HEADERS,
        body: { title: '更新标题', status: 1 },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('DELETE /api/content/activities/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/content/activities/${MOCK_ID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/content/contacts/list 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/content/contacts/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/content/contacts/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/content/contacts/${MOCK_ID}`,
        headers: AUTH_HEADERS,
        body: { status: 1, value: '已处理' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/content/file-storage/list 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/content/file-storage/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('DELETE /api/content/file-storage/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/content/file-storage/${MOCK_ID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/content/aigc/list 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/content/aigc/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/content/aigc 返回 201', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/content/aigc',
        headers: AUTH_HEADERS,
        body: { type: 'image', prompt: '生成风景画', resultUrl: 'https://example.com/result.png' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/content/banners/list 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/content/banners/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/content/banners/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/content/banners/${MOCK_ID}`,
        headers: AUTH_HEADERS,
        body: { title: '更新横幅', isActive: false },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })
  })
})
