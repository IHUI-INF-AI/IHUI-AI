import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyPluginAsync } from 'fastify'

// Mock jose(避免 JWT 真实解码)
vi.mock('jose', () => ({ decodeJwt: () => ({}) }))

// Mock config(避免 env 校验触发 process.exit)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

// Hoisted mock 函数:供 vi.mock 工厂 + 测试用例共用
const { mockVerifyAccessToken, mockUpdateReturning, mockSelectResult, mockUpdateSensitiveWord } =
  vi.hoisted(() => ({
    mockVerifyAccessToken: vi.fn(),
    mockUpdateReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
    mockSelectResult: vi.fn().mockResolvedValue([]),
    mockUpdateSensitiveWord: vi.fn().mockResolvedValue({ id: 'mock-id', status: 1 }),
  }))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

// 2026-08-06 修复:auth.ts P2-14 安全加固新增 getUserStatus 查询,
// mock 返回 status=1(active),避免 401 '用户不存在'
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

// Chainable db mock:任意 db.select().from().where()... 链最终 await 走 mockSelectResult
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
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]) })),
    })),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {},
  dbClient: {},
}))

vi.mock('../src/db/sensitive-words-queries.js', () => ({
  findSensitiveWords: vi.fn(),
  findSensitiveWordById: vi.fn(),
  createSensitiveWord: vi.fn(),
  updateSensitiveWord: mockUpdateSensitiveWord,
  deleteSensitiveWord: vi.fn(),
  filterSensitiveContent: vi.fn(),
}))

vi.mock('../src/db/promotion-queries.js', () => ({
  createInvitationCode: vi.fn(),
  findInvitationCodesByUser: vi.fn(),
  findInvitationByCode: vi.fn(),
  findInviteesByUser: vi.fn(),
  findActivities: vi.fn().mockResolvedValue([]),
  findActivityBySlug: vi.fn(),
  findActivityById: vi.fn(),
  joinActivity: vi.fn(),
  leaveActivity: vi.fn(),
  findActivityParticipants: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  deleteActivity: vi.fn(),
  createCoupon: vi.fn(),
  findCoupons: vi.fn(),
  verifyCoupon: vi.fn(),
}))

import { adminSensitiveWordsRoutes } from '../src/routes/admin-sensitive-words.js'
import { adminPromotionRoutes } from '../src/routes/promotions.js'
import adminSupportTicketsRoutes from '../src/routes/admin-support-tickets.js'
import { requireAdmin } from '../src/plugins/require-permission.js'

const ADMIN_TOKEN = 'Bearer admin-token'
const USER_TOKEN = 'Bearer user-token'
const UUID = '00000000-0000-4000-8000-000000000001'

function mockAdmin() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 1,
  })
}

function mockRegularUser() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000002',
    phone: '13800000002',
    familyId: '00000000-0000-4000-8000-000000000003',
    roleId: 0,
  })
}

// admin-support-tickets 自身无 preHandler,通过 admin-missing-routes 注册时统一加 requireAdmin。
// 测试中用 wrapper 复现该注册语义。
const supportTicketsWithAuth: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  await server.register(adminSupportTicketsRoutes)
}

describe('admin-ops routes — 5 个 admin 运营管理后端路由', () => {
  const server = Fastify({ logger: false, pluginTimeout: 60000 })

  beforeAll(async () => {
    await server.register(adminSensitiveWordsRoutes, { prefix: '/api/admin' })
    await server.register(adminPromotionRoutes, { prefix: '/api/admin' })
    await server.register(supportTicketsWithAuth, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  // ==========================================================================
  // 1. PUT /api/admin/security/sensitive-words/:id/audit
  //    实现:apps/api/src/routes/admin-sensitive-words.ts L129
  //    前端:apps/web/app/(main)/admin/sensitive-word/page.tsx L53
  // ==========================================================================
  describe('PUT /api/admin/security/sensitive-words/:id/audit', () => {
    it('未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/security/sensitive-words/${UUID}/audit`,
        body: { status: 'published' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('普通用户(roleId=0)返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/security/sensitive-words/${UUID}/audit`,
        body: { status: 'published' },
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('管理员')
    })

    it('admin 审核 published 成功(status=1 启用)', async () => {
      mockAdmin()
      mockUpdateSensitiveWord.mockResolvedValueOnce({ id: UUID, status: 1 })
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/security/sensitive-words/${UUID}/audit`,
        body: { status: 'published' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
      expect(mockUpdateSensitiveWord).toHaveBeenCalledWith(UUID, { status: 1 })
    })

    it('admin 审核 rejected 成功(status=0 禁用)', async () => {
      mockAdmin()
      mockUpdateSensitiveWord.mockResolvedValueOnce({ id: UUID, status: 0 })
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/security/sensitive-words/${UUID}/audit`,
        body: { status: 'rejected' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(mockUpdateSensitiveWord).toHaveBeenCalledWith(UUID, { status: 0 })
    })

    it('非法 status 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/security/sensitive-words/${UUID}/audit`,
        body: { status: 'invalid' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    })

    it('非 UUID id 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/security/sensitive-words/not-a-uuid/audit',
        body: { status: 'published' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('敏感词不存在返回 404', async () => {
      mockAdmin()
      mockUpdateSensitiveWord.mockResolvedValueOnce(null)
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/security/sensitive-words/${UUID}/audit`,
        body: { status: 'published' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('不存在')
    })
  })

  // ==========================================================================
  // 2. PUT /api/admin/promotions/signin-rules/:id
  //    实现:apps/api/src/routes/promotions.ts L595
  //    前端:apps/web/app/(main)/admin/signin-rule/page.tsx L53
  // ==========================================================================
  describe('PUT /api/admin/promotions/signin-rules/:id', () => {
    it('未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/promotions/signin-rules/${UUID}`,
        body: { status: 'published' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('普通用户(roleId=0)返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/promotions/signin-rules/${UUID}`,
        body: { status: 'published' },
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })

    it('admin 切换为 published 成功(DB status=1)', async () => {
      mockAdmin()
      mockUpdateReturning.mockResolvedValueOnce([{ id: UUID, status: 1 }])
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/promotions/signin-rules/${UUID}`,
        body: { status: 'published' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('admin 切换为 draft 成功(DB status=0)', async () => {
      mockAdmin()
      mockUpdateReturning.mockResolvedValueOnce([{ id: UUID, status: 0 }])
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/promotions/signin-rules/${UUID}`,
        body: { status: 'draft' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
    })

    it('admin 切换为 pending/rejected 成功(均映射 DB status=0)', async () => {
      mockAdmin()
      mockUpdateReturning.mockResolvedValueOnce([{ id: UUID, status: 0 }])
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/promotions/signin-rules/${UUID}`,
        body: { status: 'rejected' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
    })

    it('非法 status 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/promotions/signin-rules/${UUID}`,
        body: { status: 'invalid' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('非 UUID id 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/promotions/signin-rules/not-a-uuid',
        body: { status: 'published' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('签到规则不存在返回 404', async () => {
      mockAdmin()
      mockUpdateReturning.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/promotions/signin-rules/${UUID}`,
        body: { status: 'published' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('不存在')
    })
  })

  // ==========================================================================
  // 3. PUT /api/admin/support/tickets/:id/status
  //    实现:apps/api/src/routes/admin-support-tickets.ts L31(空桩,无 support_tickets 表)
  //    前端:apps/web/app/(main)/admin/ticket/page.tsx L54
  // ==========================================================================
  describe('PUT /api/admin/support/tickets/:id/status', () => {
    it('未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/support/tickets/t-1/status',
        body: { status: 'processing' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('普通用户(roleId=0)返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/support/tickets/t-1/status',
        body: { status: 'processing' },
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('管理员')
    })

    it('admin 更新状态为 processing 成功', async () => {
      mockAdmin()
      mockUpdateReturning.mockResolvedValueOnce([{ id: 't-1', status: 'open' }])
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/support/tickets/t-1/status',
        body: { status: 'processing' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toEqual({ id: 't-1', status: 'processing' })
    })

    it('admin 更新状态为 resolved 成功', async () => {
      mockAdmin()
      mockUpdateReturning.mockResolvedValueOnce([{ id: 't-1', status: 'resolved' }])
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/support/tickets/t-1/status',
        body: { status: 'resolved' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.status).toBe('resolved')
    })

    it('admin 更新状态为 closed 成功', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/support/tickets/t-1/status',
        body: { status: 'closed' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
    })

    it('非法 status 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/support/tickets/t-1/status',
        body: { status: 'invalid' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    })

    it('status 字段缺失返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/support/tickets/t-1/status',
        body: {},
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ==========================================================================
  // 4. POST /api/admin/support/tickets/:id/reply
  //    实现:apps/api/src/routes/admin-support-tickets.ts L45(空桩)
  //    前端:apps/web/app/(main)/admin/ticket/page.tsx L60
  // ==========================================================================
  describe('POST /api/admin/support/tickets/:id/reply', () => {
    it('未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/support/tickets/t-1/reply',
        body: { content: '回复内容' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('普通用户(roleId=0)返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/support/tickets/t-1/reply',
        body: { content: '回复内容' },
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })

    it('admin 回复成功返回 201', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([{ id: 't-1' }])
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/support/tickets/t-1/reply',
        body: { content: '客服回复', isAdmin: true },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toEqual({ ticketId: 't-1', replied: true, isAdmin: true, commentId: 'mock-id' })
    })

    it('isAdmin 默认为 true(body 未传)', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([{ id: 't-1' }])
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/support/tickets/t-1/reply',
        body: { content: '回复' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.isAdmin).toBe(true)
    })

    it('空 content 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/support/tickets/t-1/reply',
        body: { content: '' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('content 超长(>5000)返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/support/tickets/t-1/reply',
        body: { content: 'x'.repeat(5001) },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('content 缺失返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/support/tickets/t-1/reply',
        body: { isAdmin: true },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ==========================================================================
  // 5. GET /api/admin/support/tickets/:id/replies
  //    实现:apps/api/src/routes/admin-support-tickets.ts L63(空桩,返回空列表)
  //    前端:apps/web/app/(main)/admin/ticket-reply/PageClient.tsx L19
  // ==========================================================================
  describe('GET /api/admin/support/tickets/:id/replies', () => {
    it('未登录返回 401', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/support/tickets/t-1/replies',
      })
      expect(res.statusCode).toBe(401)
    })

    it('普通用户(roleId=0)返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/support/tickets/t-1/replies',
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })

    it('admin 获取回复列表成功(空桩返回空列表)', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([{ id: 't-1' }])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/support/tickets/t-1/replies',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
      expect(body.data).toEqual({ list: [], total: 0 })
    })

    it('支持分页参数 page/pageSize', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([{ id: 't-1' }])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/support/tickets/t-1/replies?page=2&pageSize=5',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
    })

    it('非法 pageSize=0 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/support/tickets/t-1/replies?pageSize=0',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('非法 page=0 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/support/tickets/t-1/replies?page=0',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ==========================================================================
  // 响应格式统一性验证(AGENTS.md §5:{ code, message, data })
  // ==========================================================================
  describe('响应格式统一 { code, message, data }', () => {
    it('audit 成功响应含三字段', async () => {
      mockAdmin()
      mockUpdateSensitiveWord.mockResolvedValueOnce({ id: UUID, status: 1 })
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/security/sensitive-words/${UUID}/audit`,
        body: { status: 'published' },
        headers: { authorization: ADMIN_TOKEN },
      })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body).toHaveProperty('data')
    })

    it('signin-rules 成功响应含三字段', async () => {
      mockAdmin()
      mockUpdateReturning.mockResolvedValueOnce([{ id: UUID, status: 1 }])
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/promotions/signin-rules/${UUID}`,
        body: { status: 'published' },
        headers: { authorization: ADMIN_TOKEN },
      })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body).toHaveProperty('data')
    })

    it('ticket status 成功响应含三字段', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/support/tickets/t-1/status',
        body: { status: 'open' },
        headers: { authorization: ADMIN_TOKEN },
      })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body).toHaveProperty('data')
    })

    it('ticket reply 成功响应含三字段', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([{ id: 't-1' }])
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/support/tickets/t-1/reply',
        body: { content: 'hi' },
        headers: { authorization: ADMIN_TOKEN },
      })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body).toHaveProperty('data')
    })

    it('ticket replies 成功响应含三字段', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([{ id: 't-1' }])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/support/tickets/t-1/replies',
        headers: { authorization: ADMIN_TOKEN },
      })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body).toHaveProperty('data')
    })
  })
})
