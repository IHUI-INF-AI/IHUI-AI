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
const { mockVerifyAccessToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
}))
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000002'),
}))

// Mock db：有表路由的 CRUD 查询链式调用
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  }),
})
const mockCountSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([{ c: 0 }]),
  }),
})
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn((args) =>
      args && typeof args === 'object' && 'c' in (args as any) ? mockCountSelect() : mockSelect(),
    ),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  },
  dbRead: {},
  dbClient: {},
}))

import { adminMissingRoutes } from '../src/routes/admin-missing-routes.js'

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
      expect(body.data.created).toBe(true)
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
      expect(body.data.updated).toBe(true)
      expect(body.data.id).toBe('123')
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

    it('DELETE /api/admin/auth-veri-codes 批量删除', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/admin/auth-veri-codes',
        body: { ids: '1,2,3' },
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.deleted).toBe(3)
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
      { method: 'GET', url: '/api/admin/learn/homework' },
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
})
