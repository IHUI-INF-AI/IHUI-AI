import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
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

const { mockVerifyAccessToken, mockSelectResult } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
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
  dbRead: {},
  dbClient: {},
}))

import commentsRoutes from '../src/routes/admin/comments.js'
import { requireAdmin } from '../src/plugins/require-permission.js'

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

describe('admin-comments 路由', () => {
  const server = Fastify({ logger: false })

  server.setErrorHandler((err, _req, reply) => {
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
    reply.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).send({
      code: statusCode,
      message: statusCode >= 500 ? '服务器错误' : err.message,
    })
  })

  beforeAll(async () => {
    server.addHook('preHandler', requireAdmin)
    await server.register(commentsRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('GET /api/admin/comments (列表)', () => {
    it('未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/admin/comments' })
      expect(res.statusCode).toBe(401)
    })

    it('非管理员返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/comments',
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
        url: '/api/admin/comments',
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

    it('支持 topicType 过滤', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/comments?topicType=article',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
    })

    it('支持 keyword 过滤', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/comments?keyword=test',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
    })

    it('支持 status=deleted 过滤', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/comments?status=deleted',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
    })

    it('非法 topicType 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/comments?topicType=invalid_type',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    })

    it('支持分页参数', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/comments?page=2&pageSize=10',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.page).toBe(2)
      expect(body.data.pageSize).toBe(10)
    })
  })

  describe('GET /api/admin/comments/:id (详情)', () => {
    it('管理员获取详情(含 replies)', async () => {
      mockAdmin()
      const comment = {
        id: SAMPLE_UUID,
        content: 'hello',
        isDeleted: false,
        userId: 'u1',
        userNickname: 'A',
        userAvatar: null,
      }
      mockSelectResult.mockResolvedValueOnce([comment])
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: `/api/admin/comments/${SAMPLE_UUID}`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.comment.id).toBe(SAMPLE_UUID)
      expect(body.data.replies).toEqual([])
    })

    it('评论不存在返回 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'GET',
        url: `/api/admin/comments/${SAMPLE_UUID}`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().code).toBe(404)
    })

    it('非 UUID 格式返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/comments/not-a-uuid',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('非管理员返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: `/api/admin/comments/${SAMPLE_UUID}`,
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('DELETE /api/admin/comments/:id (软删)', () => {
    it('管理员软删成功', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([{ id: SAMPLE_UUID, isDeleted: false }])
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/admin/comments/${SAMPLE_UUID}`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.isDeleted).toBe(true)
      expect(body.data.id).toBe(SAMPLE_UUID)
    })

    it('已软删的评论返回幂等成功', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([{ id: SAMPLE_UUID, isDeleted: true }])
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/admin/comments/${SAMPLE_UUID}`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.isDeleted).toBe(true)
    })

    it('评论不存在返回 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/admin/comments/${SAMPLE_UUID}`,
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })

    it('非管理员返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/admin/comments/${SAMPLE_UUID}`,
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })

    it('非 UUID 格式返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/comments/abc',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })
  })
})
