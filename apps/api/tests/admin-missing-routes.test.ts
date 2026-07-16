import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'

// Mock config 避免 env 校验触发 process.exit(1)
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

// Mock @ihui/auth：默认返回 admin（roleId=1），具体测试可覆盖
// 同时暴露 db 写操作的 returning/where mock，便于 404 场景用 mockResolvedValueOnce 覆盖
const {
  mockVerifyAccessToken,
  mockInsertReturning,
  mockUpdateReturning,
  mockDeleteWhere,
  mockSelectResult,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockInsertReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
  mockUpdateReturning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
  mockDeleteWhere: vi.fn().mockResolvedValue(undefined),
  mockSelectResult: vi.fn().mockResolvedValue([]),
}))
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000002'),
}))

// Mock db：Proxy-based chainable mock — 任意 db.select().from().where()... 链最终 await 走 mockSelectResult
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
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: mockInsertReturning })) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) })),
    })),
    delete: vi.fn(() => ({ where: mockDeleteWhere })),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {},
  dbClient: {},
}))

import { adminMissingRoutes } from '../src/routes/admin-missing-routes.js'
import { adminContentOpsRoutes } from '../src/routes/admin-content-routes.js'
import { adminAuthEduRoutes } from '../src/routes/admin-auth-edu-routes.js'
import { adminMonitoringRoutes } from '../src/routes/admin-monitoring-routes.js'
import { adminShopRoutes } from '../src/routes/admin-shop-routes.js'

const ADMIN_TOKEN = 'Bearer admin-token'
const USER_TOKEN = 'Bearer user-token'

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

describe('admin-missing-routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(adminMissingRoutes, { prefix: '/api/admin' })
    await server.register(adminContentOpsRoutes, { prefix: '/api/admin' })
    await server.register(adminAuthEduRoutes, { prefix: '/api/admin' })
    await server.register(adminMonitoringRoutes, { prefix: '/api/admin' })
    await server.register(adminShopRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  // ===========================================================================
  // 1. 认证门控：未登录 → 401
  // ===========================================================================
  describe('认证门控', () => {
    it('GET /api/admin/about-us 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/admin/about-us' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/admin/advertise 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/advertise',
        body: { title: 'test' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/admin/auth-role/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/auth-role/123',
        body: { name: 'test' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/admin/courses/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/courses/123',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  // ===========================================================================
  // 2. 授权门控：普通用户（roleId=0）→ 403
  // ===========================================================================
  describe('授权门控', () => {
    it('GET /api/admin/about-us 普通用户返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/about-us',
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.code).toBe(403)
      expect(body.message).toContain('管理员')
    })

    it('POST /api/admin/advertise 普通用户返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/advertise',
        body: { title: 'test' },
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })

    it('DELETE /api/admin/shop/products/:id 普通用户返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/shop/products/123',
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  // ===========================================================================
  // 3. 空桩路由：admin 登录后返回空列表
  // ===========================================================================
  describe('空桩路由（admin）', () => {
    it('GET /api/admin/about-us 返回空列表', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/about-us',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
      expect(body.data).toEqual({ list: [], total: 0, page: 1, pageSize: 20 })
    })

    it('GET /api/admin/auth-role 返回空列表', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/auth-role',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.list).toEqual([])
      expect(body.data.total).toBe(0)
    })

    it('GET /api/admin/system/login-logs 支持分页参数', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/system/login-logs?page=2&pageSize=10',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.page).toBe(2)
      expect(body.data.pageSize).toBe(10)
    })

    it('GET /api/admin/shop/withdrawals 返回空列表', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/shop/withdrawals',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.list).toEqual([])
      expect(body.data.total).toBe(0)
    })

    it('POST /api/admin/courses 创建返回 201', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/courses',
        body: { title: 'test course' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data).toBeTruthy()
    })

    it('PUT /api/admin/edu/classes/:id 更新返回成功', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/edu/classes/123',
        body: { name: 'updated' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
    })

    it('DELETE /api/admin/monitor/alerts/:id 删除返回成功', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/monitor/alerts/456',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.deleted).toBe(true)
      expect(body.data.id).toBe('456')
    })

    it('DELETE /api/admin/auth-veri-codes/:id 删除返回成功', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/auth-veri-codes/1',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
    })
  })

  // ===========================================================================
  // 4. 响应格式统一性验证
  // ===========================================================================
  describe('响应格式统一', () => {
    it('所有成功响应包含 code/message/data 三个字段', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/oss/files',
        headers: { authorization: ADMIN_TOKEN },
      })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body).toHaveProperty('data')
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
    })

    it('错误响应包含 code/message 字段', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/oss/files',
        headers: { authorization: USER_TOKEN },
      })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body.code).toBe(403)
    })
  })

  // ===========================================================================
  // 5. 有表路由（admin 认证 + mock db）
  // ===========================================================================
  describe('有表路由（admin + mock db）', () => {
    it('GET /api/admin/carousel 返回列表', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/carousel?page=1&pageSize=5',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('list')
      expect(body.data).toHaveProperty('total')
      expect(body.data).toHaveProperty('page')
      expect(body.data).toHaveProperty('pageSize')
    })

    it('GET /api/admin/ai-gc 返回列表', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/ai-gc',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toEqual([])
    })

    it('GET /api/admin/comment-logs 返回列表', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/comment-logs',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
    })

    it('GET /api/admin/zhs-activity 返回列表', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/zhs-activity',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
    })

    it('DELETE /api/admin/carousel/:id 删除成功', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/carousel/test-id',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
    })

    it('POST /api/admin/carousel 创建成功', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/carousel',
        body: { position: 'home', imageUrl: 'https://example.com/img.png' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
    })
  })

  // ===========================================================================
  // 6. 覆盖度：抽样验证各模块路由存在性
  // ===========================================================================
  describe('模块覆盖度抽样', () => {
    const moduleSamples = [
      // 内容运营
      { method: 'GET', url: '/api/admin/about-us' },
      { method: 'GET', url: '/api/admin/advertise' },
      { method: 'GET', url: '/api/admin/contact' },
      { method: 'GET', url: '/api/admin/mobile-adapter' },
      { method: 'GET', url: '/api/admin/recommendation-config' },
      { method: 'GET', url: '/api/admin/news/information' },
      // 鉴权
      { method: 'GET', url: '/api/admin/auth-accounts' },
      { method: 'GET', url: '/api/admin/auth-find-info' },
      { method: 'GET', url: '/api/admin/auth-info' },
      { method: 'GET', url: '/api/admin/auth-sms-temp' },
      { method: 'GET', url: '/api/admin/auth-tokens' },
      { method: 'GET', url: '/api/admin/auth-user-margin' },
      { method: 'GET', url: '/api/admin/auth-user-vip' },
      { method: 'GET', url: '/api/admin/auth-veri-codes' },
      { method: 'GET', url: '/api/admin/auth-vip-level' },
      { method: 'GET', url: '/api/admin/member/blacklist' },
      { method: 'GET', url: '/api/admin/member/permissions' },
      { method: 'GET', url: '/api/admin/system/login-logs' },
      { method: 'GET', url: '/api/admin/system/operation-logs' },
      { method: 'GET', url: '/api/admin/user-roles' },
      { method: 'GET', url: '/api/admin/users/course-users' },
      // 教务
      { method: 'GET', url: '/api/admin/courses' },
      { method: 'GET', url: '/api/admin/edu/classes' },
      { method: 'GET', url: '/api/admin/edu/classes/schedules' },
      { method: 'GET', url: '/api/admin/finance/statistics' },
      { method: 'GET', url: '/api/admin/learn/materials' },
      { method: 'GET', url: '/api/admin/learn/plans' },
      { method: 'GET', url: '/api/admin/learn/reminds' },
      // 平台
      { method: 'GET', url: '/api/admin/api-groups' },
      { method: 'GET', url: '/api/admin/api-usage/day' },
      { method: 'GET', url: '/api/admin/api-usage/stats' },
      { method: 'GET', url: '/api/admin/api-usage/top' },
      { method: 'GET', url: '/api/admin/developer/coze' },
      { method: 'GET', url: '/api/admin/oauth/apps' },
      { method: 'GET', url: '/api/admin/oauth-audit/stats' },
      { method: 'GET', url: '/api/admin/oss/files' },
      // 监控
      { method: 'GET', url: '/api/admin/backend-health/events' },
      { method: 'GET', url: '/api/admin/db-opt/tables' },
      { method: 'GET', url: '/api/admin/event-bus/events' },
      { method: 'GET', url: '/api/admin/monitor/services' },
      { method: 'GET', url: '/api/admin/monitoring/services' },
      { method: 'GET', url: '/api/admin/performance-dashboard/stats' },
      { method: 'GET', url: '/api/admin/system/monitor/metrics' },
      // /api/admin/stats 已在 admin.ts 中实现，不在本文件测试范围
      // 商城
      { method: 'GET', url: '/api/admin/shop/funds/accounts' },
      { method: 'GET', url: '/api/admin/shop/products' },
      { method: 'GET', url: '/api/admin/shop/withdrawal-flow' },
      { method: 'GET', url: '/api/admin/shop/withdrawals' },
      // 相对路径
      { method: 'GET', url: '/api/admin/products' },
      { method: 'GET', url: '/api/admin/statistics' },
    ]

    moduleSamples.forEach(({ method, url }) => {
      it(`${method} ${url} admin 可访问返回 200`, async () => {
        mockAdmin()
        const res = await server.inject({
          method,
          url,
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        const body = res.json()
        expect(body.code).toBe(0)
      })
    })
  })

  // ===========================================================================
  // 7. 11 条升级路由的 POST/PUT/DELETE 覆盖
  //    每个写方法至少 1 成功 + 1 失败（POST/DELETE 失败=403 非 admin；PUT 失败=404 资源不存在）
  // ===========================================================================
  describe('升级路由 POST/PUT/DELETE 覆盖', () => {
    // 1. /auth-accounts — DELETE
    describe('/auth-accounts', () => {
      it('should delete account successfully (admin)', async () => {
        mockAdmin()
        mockSelectResult.mockResolvedValueOnce([{ id: 'mock-id' }])
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/auth-accounts/acc-1',
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.deleted).toBe(true)
      })
      it('should return 403 for non-admin user', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/auth-accounts/acc-1',
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
    })

    // 2. /auth-info — PUT
    describe('/auth-info', () => {
      it('should update auth info successfully (admin)', async () => {
        mockAdmin()
        const res = await server.inject({
          method: 'PUT',
          url: '/api/admin/auth-info/user-uuid-1',
          body: { phone: '13900000001', authStatus: 'verified' },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().code).toBe(0)
      })
      it('should return 404 when record not found', async () => {
        mockAdmin()
        mockUpdateReturning.mockResolvedValueOnce([])
        const res = await server.inject({
          method: 'PUT',
          url: '/api/admin/auth-info/missing-uuid',
          body: { phone: '13900000001' },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(404)
        expect(res.json().code).toBe(404)
      })
    })

    // 3. /auth-role — POST + PUT + DELETE
    describe('/auth-role', () => {
      it('should create role successfully (admin)', async () => {
        mockAdmin()
        const res = await server.inject({
          method: 'POST',
          url: '/api/admin/auth-role',
          body: { name: 'editor', displayName: '编辑', scope: 'self' },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(201)
        expect(res.json().code).toBe(0)
      })
      it('should return 403 for non-admin user on POST', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'POST',
          url: '/api/admin/auth-role',
          body: { name: 'editor' },
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
      it('should update role successfully (admin)', async () => {
        mockAdmin()
        const res = await server.inject({
          method: 'PUT',
          url: '/api/admin/auth-role/role-1',
          body: { displayName: '编辑者' },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().code).toBe(0)
      })
      it('should return 404 when role not found on PUT', async () => {
        mockAdmin()
        mockUpdateReturning.mockResolvedValueOnce([])
        const res = await server.inject({
          method: 'PUT',
          url: '/api/admin/auth-role/missing',
          body: { displayName: 'x' },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(404)
      })
      it('should delete role successfully (admin)', async () => {
        mockAdmin()
        mockSelectResult.mockResolvedValueOnce([{ id: 'mock-id' }])
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/auth-role/role-1',
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.deleted).toBe(true)
      })
      it('should return 403 for non-admin user on DELETE', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/auth-role/role-1',
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
    })

    // 4. /auth-tokens — DELETE
    describe('/auth-tokens', () => {
      it('should delete token successfully (admin)', async () => {
        mockAdmin()
        mockSelectResult.mockResolvedValueOnce([{ id: 'mock-id' }])
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/auth-tokens/sk-1',
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.deleted).toBe(true)
      })
      it('should return 403 for non-admin user', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/auth-tokens/sk-1',
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
    })

    // 5. /auth-user-vip — DELETE
    describe('/auth-user-vip', () => {
      it('should delete user vip record successfully (admin)', async () => {
        mockAdmin()
        mockSelectResult.mockResolvedValueOnce([{ id: 'mock-id' }])
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/auth-user-vip/vip-1',
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.deleted).toBe(true)
      })
      it('should return 403 for non-admin user', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/auth-user-vip/vip-1',
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
    })

    // 6. /auth-vip-level — POST + PUT + DELETE
    describe('/auth-vip-level', () => {
      it('should create vip level successfully (admin)', async () => {
        mockAdmin()
        const res = await server.inject({
          method: 'POST',
          url: '/api/admin/auth-vip-level',
          body: { levelName: '黄金', levelValue: 2, price: 30, durationDays: 30 },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(201)
        expect(res.json().code).toBe(0)
      })
      it('should return 403 for non-admin user on POST', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'POST',
          url: '/api/admin/auth-vip-level',
          body: { levelName: '黄金' },
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
      it('should update vip level successfully (admin)', async () => {
        mockAdmin()
        const res = await server.inject({
          method: 'PUT',
          url: '/api/admin/auth-vip-level/lvl-1',
          body: { price: 50, status: 1 },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().code).toBe(0)
      })
      it('should return 404 when vip level not found on PUT', async () => {
        mockAdmin()
        mockUpdateReturning.mockResolvedValueOnce([])
        const res = await server.inject({
          method: 'PUT',
          url: '/api/admin/auth-vip-level/missing',
          body: { price: 50 },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(404)
      })
      it('should delete vip level successfully (admin)', async () => {
        mockAdmin()
        mockSelectResult.mockResolvedValueOnce([{ id: 'mock-id' }])
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/auth-vip-level/lvl-1',
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.deleted).toBe(true)
      })
      it('should return 403 for non-admin user on DELETE', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/auth-vip-level/lvl-1',
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
    })

    // 7. /auth-sms-temp — POST + PUT + DELETE
    describe('/auth-sms-temp', () => {
      it('should create sms template successfully (admin)', async () => {
        mockAdmin()
        const res = await server.inject({
          method: 'POST',
          url: '/api/admin/auth-sms-temp',
          body: { code: 'LOGIN_CODE', title: '登录验证码', content: '您的验证码是 {code}' },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(201)
        expect(res.json().code).toBe(0)
      })
      it('should return 403 for non-admin user on POST', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'POST',
          url: '/api/admin/auth-sms-temp',
          body: { code: 'X' },
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
      it('should update sms template successfully (admin)', async () => {
        mockAdmin()
        const res = await server.inject({
          method: 'PUT',
          url: '/api/admin/auth-sms-temp/tpl-1',
          body: { content: '新内容 {code}', status: 0 },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().code).toBe(0)
      })
      it('should return 404 when sms template not found on PUT', async () => {
        mockAdmin()
        mockUpdateReturning.mockResolvedValueOnce([])
        const res = await server.inject({
          method: 'PUT',
          url: '/api/admin/auth-sms-temp/missing',
          body: { status: 0 },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(404)
      })
      it('should delete sms template successfully (admin)', async () => {
        mockAdmin()
        mockSelectResult.mockResolvedValueOnce([{ id: 'mock-id' }])
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/auth-sms-temp/tpl-1',
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.deleted).toBe(true)
      })
      it('should return 403 for non-admin user on DELETE', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/auth-sms-temp/tpl-1',
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
    })

    // 8. /user-roles — POST + DELETE
    describe('/user-roles', () => {
      it('should create user-role binding successfully (admin)', async () => {
        mockAdmin()
        const res = await server.inject({
          method: 'POST',
          url: '/api/admin/user-roles',
          body: { userId: 'u-1', roleId: 'r-1' },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(201)
        expect(res.json().code).toBe(0)
      })
      it('should return 403 for non-admin user on POST', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'POST',
          url: '/api/admin/user-roles',
          body: { userId: 'u-1', roleId: 'r-1' },
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
      it('should delete user-role binding successfully (admin)', async () => {
        mockAdmin()
        mockSelectResult.mockResolvedValueOnce([{ id: 'mock-id' }])
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/user-roles/ur-1',
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.deleted).toBe(true)
      })
      it('should return 403 for non-admin user on DELETE', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/user-roles/ur-1',
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
    })

    // 9. /member/permissions — POST + PUT + DELETE
    describe('/member/permissions', () => {
      it('should create permission successfully (admin)', async () => {
        mockAdmin()
        const res = await server.inject({
          method: 'POST',
          url: '/api/admin/member/permissions',
          body: {
            name: 'rbac:manage',
            displayName: 'RBAC 管理',
            resource: 'rbac',
            action: 'manage',
          },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(201)
        expect(res.json().code).toBe(0)
      })
      it('should return 403 for non-admin user on POST', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'POST',
          url: '/api/admin/member/permissions',
          body: { name: 'x', displayName: 'x', resource: 'x', action: 'x' },
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
      it('should update permission successfully (admin)', async () => {
        mockAdmin()
        const res = await server.inject({
          method: 'PUT',
          url: '/api/admin/member/permissions/perm-1',
          body: { displayName: '权限管理' },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().code).toBe(0)
      })
      it('should return 404 when permission not found on PUT', async () => {
        mockAdmin()
        mockUpdateReturning.mockResolvedValueOnce([])
        const res = await server.inject({
          method: 'PUT',
          url: '/api/admin/member/permissions/missing',
          body: { displayName: 'x' },
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(404)
      })
      it('should delete permission successfully (admin)', async () => {
        mockAdmin()
        mockSelectResult.mockResolvedValueOnce([{ id: 'mock-id' }])
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/member/permissions/perm-1',
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.deleted).toBe(true)
      })
      it('should return 403 for non-admin user on DELETE', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/member/permissions/perm-1',
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
    })

    // 10. /system/operation-logs — DELETE
    describe('/system/operation-logs', () => {
      it('should delete operation log successfully (admin)', async () => {
        mockAdmin()
        mockSelectResult.mockResolvedValueOnce([{ id: 'mock-id' }])
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/system/operation-logs/log-1',
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.deleted).toBe(true)
      })
      it('should return 403 for non-admin user', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/system/operation-logs/log-1',
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
    })

    // 11. /system/login-logs — DELETE
    describe('/system/login-logs', () => {
      it('should delete login log successfully (admin)', async () => {
        mockAdmin()
        mockSelectResult.mockResolvedValueOnce([{ id: 'mock-id' }])
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/system/login-logs/123',
          headers: { authorization: ADMIN_TOKEN },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().data.deleted).toBe(true)
      })
      it('should return 403 for non-admin user', async () => {
        mockRegularUser()
        const res = await server.inject({
          method: 'DELETE',
          url: '/api/admin/system/login-logs/123',
          headers: { authorization: USER_TOKEN },
        })
        expect(res.statusCode).toBe(403)
      })
    })
  })

  // ===========================================================================
  // 8. Zod body 校验失败测试（POST/PUT 缺少必填字段 → 400）
  // ===========================================================================
  describe('Zod body 校验失败', () => {
    it('POST /auth-role 缺少 name 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/auth-role',
        body: { displayName: '编辑' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    })

    it('POST /auth-role 缺少 displayName 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/auth-role',
        body: { name: 'editor' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('PUT /auth-info body 非法字段返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/auth-info/user-uuid-1',
        body: { phone: 12345 },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('POST /auth-vip-level 缺少 levelName 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/auth-vip-level',
        body: { price: 30 },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('PUT /auth-vip-level levelName 空字符串返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/auth-vip-level/lvl-1',
        body: { levelName: '' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('POST /auth-sms-temp 缺少 code 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/auth-sms-temp',
        body: { title: '验证码', content: '内容' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('POST /auth-sms-temp 缺少 content 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/auth-sms-temp',
        body: { code: 'LOGIN', title: '验证码' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('POST /user-roles 缺少 userId 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/user-roles',
        body: { roleId: 'r-1' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('POST /user-roles 缺少 roleId 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/user-roles',
        body: { userId: 'u-1' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('POST /member/permissions 缺少 name 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/member/permissions',
        body: { displayName: '权限', resource: 'rbac', action: 'manage' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('POST /member/permissions 缺少 resource 返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/member/permissions',
        body: { name: 'rbac:manage', displayName: '权限', action: 'manage' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('PUT /member/permissions name 空字符串返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/member/permissions/perm-1',
        body: { name: '' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })

    it('PUT /auth-role name 类型错误返回 400', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'PUT',
        url: '/api/admin/auth-role/role-1',
        body: { name: 12345 },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ===========================================================================
  // 9. DELETE 404 测试（资源不存在 → 404）
  // ===========================================================================
  describe('DELETE 404 覆盖', () => {
    it('DELETE /auth-accounts/:id 不存在返回 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/auth-accounts/missing-id',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().code).toBe(404)
    })

    it('DELETE /auth-role/:id 不存在返回 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/auth-role/missing-id',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })

    it('DELETE /auth-tokens/:id 不存在返回 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/auth-tokens/missing-id',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })

    it('DELETE /auth-user-vip/:id 不存在返回 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/auth-user-vip/missing-id',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })

    it('DELETE /auth-vip-level/:id 不存在返回 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/auth-vip-level/missing-id',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })

    it('DELETE /auth-sms-temp/:id 不存在返回 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/auth-sms-temp/missing-id',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })

    it('DELETE /user-roles/:id 不存在返回 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/user-roles/missing-id',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })

    it('DELETE /member/permissions/:id 不存在返回 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/member/permissions/missing-id',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })

    it('DELETE /system/operation-logs/:id 不存在返回 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/system/operation-logs/missing-id',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })

    it('DELETE /system/login-logs/:id 不存在返回 404', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([])
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/system/login-logs/999999',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(404)
    })
  })
})
