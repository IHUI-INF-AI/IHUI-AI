import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8000',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

const { mockVerifyAccessToken, mockSelectResult, mockFindPostById } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
  mockFindPostById: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000002'),
}))

function createChainableMock() {
  const thenFn = (resolve: (v: unknown) => void) => mockSelectResult().then(resolve)
  const make = (): Record<string, unknown> => {
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
    return proxy
  }
  return make()
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => createChainableMock()),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {
    select: vi.fn(() => createChainableMock()),
  },
  dbClient: {},
}))

vi.mock('../src/db/community-queries.js', () => ({
  acceptAnswer: vi.fn(),
  createAnswer: vi.fn(),
  createAsk: vi.fn(),
  deleteAsk: vi.fn(),
  deleteCircle: vi.fn(),
  findAskAnswers: vi.fn().mockResolvedValue({ list: [], total: 0 }),
  findAskById: vi.fn().mockResolvedValue(undefined),
  findAsks: vi.fn().mockResolvedValue({ list: [], total: 0 }),
  findCircleById: vi.fn().mockResolvedValue(undefined),
  findPostById: mockFindPostById,
  updateAsk: vi.fn(),
  updateCircleShowStatus: vi.fn(),
}))

import asksRoutes from '../src/routes/community/asks.js'

const ADMIN_TOKEN = 'Bearer admin-token'
const USER_TOKEN = 'Bearer user-token'
const SAMPLE_UUID = '00000000-0000-0000-0000-000000000001'

function mockAdmin() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-0000-0000-000000000002',
    roleId: 1,
  })
}

function mockRegularUser() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000002',
    phone: '13800000002',
    familyId: '00000000-0000-0000-0000-000000000003',
    roleId: 0,
  })
}

describe('admin circle posts 路由', () => {
  const server = Fastify({ logger: false })

  server.setErrorHandler((err, _req, reply) => {
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
    reply.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).send({
      code: statusCode,
      message: statusCode >= 500 ? '服务器错误' : err.message,
    })
  })

  beforeAll(async () => {
    await server.register(asksRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('GET /api/admin/circles/posts (列表)', () => {
    it('未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/admin/circles/posts' })
      expect(res.statusCode).toBe(401)
    })

    it('非管理员返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/circles/posts',
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().code).toBe(403)
    })

    it('管理员返回列表(空)', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/circles/posts',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toEqual([])
      expect(body.data.total).toBe(0)
      expect(body.data.page).toBe(1)
      expect(body.data.pageSize).toBe(20)
    })

    it('支持 keyword 过滤', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/circles/posts?keyword=test',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
    })

    it('支持 status=published 过滤', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/circles/posts?status=published',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
    })

    it('支持 status=deleted 过滤', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/circles/posts?status=deleted',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
    })

    it('支持 circleId 过滤', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: `/api/admin/circles/posts?circleId=${SAMPLE_UUID}`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
    })

    it('支持分页参数', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/circles/posts?page=2&pageSize=10',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.page).toBe(2)
      expect(body.data.pageSize).toBe(10)
    })

    it('非法 status 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/circles/posts?status=invalid',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('DELETE /api/admin/circles/posts/:id (软删)', () => {
    it('管理员软删成功(status=-1)', async () => {
      mockAdmin()
      mockFindPostById.mockResolvedValueOnce({ id: SAMPLE_UUID, status: 1 })
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/admin/circles/posts/${SAMPLE_UUID}`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toBeNull()
    })

    it('帖子不存在返回 404', async () => {
      mockAdmin()
      mockFindPostById.mockResolvedValueOnce(undefined)
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/admin/circles/posts/${SAMPLE_UUID}`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().code).toBe(404)
    })

    it('非管理员返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/admin/circles/posts/${SAMPLE_UUID}`,
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })

    it('未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/admin/circles/posts/${SAMPLE_UUID}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('非 UUID 格式返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/circles/posts/abc',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })
  })
})
