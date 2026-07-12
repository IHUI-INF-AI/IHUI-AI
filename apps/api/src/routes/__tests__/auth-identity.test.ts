import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi
    .fn()
    .mockResolvedValue({
      userId: 'mock-user-id',
      phone: '13800000000',
      familyId: '11111111-1111-1111-1111-111111111111',
      roleId: 1,
    }),
}))

vi.mock('../../db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    orderBy: () => DbChain
    limit: () => DbChain
    offset: () => DbChain
    values: () => DbChain
    set: () => DbChain
    returning: () => DbChain
    onConflictDoUpdate: () => DbChain
    onConflictDoNothing: () => DbChain
  }
  function createChain(result: unknown[] = []): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: () => chain,
      set: () => chain,
      returning: () => chain,
      onConflictDoUpdate: () => chain,
      onConflictDoNothing: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
  }
})

import { authIdentityRoutes } from '../auth-identity.js'
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }
const MOCK_USER_UUID = '00000000-0000-0000-0000-000000000001'

describe('Auth Identity API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(authIdentityRoutes, { prefix: '/api' })
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

  describe('401 未授权', () => {
    it('POST /api/auth/realname/submit 未登录返回 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/realname/submit',
        body: { realName: '张三', idCard: '110101199001011234' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/auth/realname/my 未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/auth/realname/my' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/auth/realname/list 未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/auth/realname/list' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/auth/realname/:userUuid/audit 未登录返回 401', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/auth/realname/${MOCK_USER_UUID}/audit`,
        body: { action: 'approve' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('Zod 校验', () => {
    beforeEach(() => {
      vi.mocked(verifyAccessToken).mockResolvedValue({
        userId: 'mock-user-id',
        phone: '13800000000',
        familyId: '11111111-1111-1111-1111-111111111111',
        roleId: 0,
      })
    })

    it('POST /api/auth/realname/submit realName 为空返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/realname/submit',
        headers: AUTH_HEADERS,
        body: { realName: '', idCard: '110101199001011234' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('真实姓名')
    })

    it('POST /api/auth/realname/submit idCard 为空返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/realname/submit',
        headers: AUTH_HEADERS,
        body: { realName: '张三', idCard: '' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('身份证号')
    })

    it('PUT /api/auth/realname/:userUuid/audit 无效 action 返回 400', async () => {
      vi.mocked(verifyAccessToken).mockResolvedValue({
        userId: 'mock-admin-id',
        phone: '13800000000',
        familyId: '11111111-1111-1111-1111-111111111111',
        roleId: 1,
      })
      const res = await app.inject({
        method: 'PUT',
        url: `/api/auth/realname/${MOCK_USER_UUID}/audit`,
        headers: AUTH_HEADERS,
        body: { action: 'invalid' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('PUT /api/auth/realname/:userUuid/audit 无效 userUuid 返回 400', async () => {
      vi.mocked(verifyAccessToken).mockResolvedValue({
        userId: 'mock-admin-id',
        phone: '13800000000',
        familyId: '11111111-1111-1111-1111-111111111111',
        roleId: 1,
      })
      const res = await app.inject({
        method: 'PUT',
        url: '/api/auth/realname/not-a-uuid/audit',
        headers: AUTH_HEADERS,
        body: { action: 'approve' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('业务逻辑', () => {
    beforeEach(() => {
      vi.mocked(verifyAccessToken).mockResolvedValue({
        userId: 'mock-user-id',
        phone: '13800000000',
        familyId: '11111111-1111-1111-1111-111111111111',
        roleId: 0,
      })
    })

    it('POST /api/auth/realname/submit 首次提交返回 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/realname/submit',
        headers: AUTH_HEADERS,
        body: { realName: '张三', idCard: '110101199001011234' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.authStatus).toBe('pending')
      expect(body.data.realName).toBe('张三')
    })

    it('GET /api/auth/realname/my 无记录时返回 unverified', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/realname/my',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.authStatus).toBe('unverified')
    })
  })

  describe('管理员鉴权', () => {
    it('GET /api/auth/realname/list 普通用户返回 403', async () => {
      vi.mocked(verifyAccessToken).mockResolvedValue({
        userId: 'mock-user-id',
        phone: '13800000000',
        familyId: '11111111-1111-1111-1111-111111111111',
        roleId: 0,
      })
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/realname/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(403)
    })

    it('GET /api/auth/realname/list 管理员返回 200', async () => {
      vi.mocked(verifyAccessToken).mockResolvedValue({
        userId: 'mock-admin-id',
        phone: '13800000000',
        familyId: '11111111-1111-1111-1111-111111111111',
        roleId: 1,
      })
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/realname/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/auth/realname/:userUuid/audit 普通用户返回 403', async () => {
      vi.mocked(verifyAccessToken).mockResolvedValue({
        userId: 'mock-user-id',
        phone: '13800000000',
        familyId: '11111111-1111-1111-1111-111111111111',
        roleId: 0,
      })
      const res = await app.inject({
        method: 'PUT',
        url: `/api/auth/realname/${MOCK_USER_UUID}/audit`,
        headers: AUTH_HEADERS,
        body: { action: 'approve' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('PUT /api/auth/realname/:userUuid/audit 管理员审核不存在记录返回 404', async () => {
      vi.mocked(verifyAccessToken).mockResolvedValue({
        userId: 'mock-admin-id',
        phone: '13800000000',
        familyId: '11111111-1111-1111-1111-111111111111',
        roleId: 1,
      })
      const res = await app.inject({
        method: 'PUT',
        url: `/api/auth/realname/${MOCK_USER_UUID}/audit`,
        headers: AUTH_HEADERS,
        body: { action: 'approve' },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('不存在')
    })
  })
})
