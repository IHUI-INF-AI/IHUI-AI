import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'

// Mock config 避免 env 校验触发 process.exit(1)
vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
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

// Mock @ihui/auth:默认返回 admin(roleId=1),具体测试可覆盖
const { mockVerifyAccessToken, mockSelectResult } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
}))
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

// Mock db:Proxy-based chainable mock — 任意 db.select().from().where()... 链最终 await 走 mockSelectResult
// thenFn 必须同时处理 resolve 和 reject,否则 mockRejectedValueOnce 会触发 Unhandled Rejection
function createChainableMock() {
  const thenFn = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    mockSelectResult().then(resolve, reject)
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
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]),
        })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {},
  dbClient: {},
}))

// tokenBalanceService 插件直接注册 full path /api/admin/token-balance/metrics(不用 prefix)
import { tokenBalanceService } from '../src/plugins/token-balance-service.js'
import statsRoutes from '../src/routes/admin/stats.js'

const ADMIN_TOKEN = 'Bearer admin-token'
const USER_TOKEN = 'Bearer user-token'

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

describe('admin-stats routes', () => {
  const server = Fastify({ logger: false, pluginTimeout: 60000 })

  beforeAll(async () => {
    // tokenBalanceService 插件直接注册 full path /api/admin/token-balance/metrics(不用 prefix)
    await server.register(tokenBalanceService)
    // statsRoutes 内部注册 /stats/*,挂载到 /api/admin
    // 最终暴露为 GET /api/admin/stats/dashboard 和 /api/admin/stats/revenue
    await server.register(statsRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  // ===========================================================================
  // 1. GET /api/admin/token-balance/metrics
  // ===========================================================================
  describe('GET /api/admin/token-balance/metrics', () => {
    it('未登录返回 401', async () => {
      mockVerifyAccessToken.mockRejectedValueOnce(new Error('Unauthorized'))
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/token-balance/metrics',
      })
      expect(res.statusCode).toBe(401)
    })

    it('普通用户(roleId=0)返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/token-balance/metrics',
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.code).toBe(403)
      expect(body.message).toContain('管理员')
    })

    it('admin 返回 200 + VipMetrics 结构', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([{ c: 5 }]) // appliesRow (tokenFlows count)
      mockSelectResult.mockResolvedValueOnce([
        { levelValue: 1, c: 3 },
        { levelValue: 2, c: 2 },
      ]) // byLevelRows (userVips groupBy)

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/token-balance/metrics',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
      expect(body.data).toHaveProperty('applies')
      expect(body.data).toHaveProperty('totalDiscounted')
      expect(body.data).toHaveProperty('byLevel')
      expect(typeof body.data.applies).toBe('number')
      expect(typeof body.data.totalDiscounted).toBe('number')
      expect(typeof body.data.byLevel).toBe('object')
    })

    it('DB 异常时返回 200 + 零值兜底', async () => {
      mockAdmin()
      mockSelectResult.mockRejectedValueOnce(new Error('DB connection failed'))

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/token-balance/metrics',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.applies).toBe(0)
      expect(body.data.totalDiscounted).toBe(0)
      expect(body.data.byLevel).toEqual({})
    })
  })

  // ===========================================================================
  // 2. GET /api/admin/stats/dashboard
  // ===========================================================================
  describe('GET /api/admin/stats/dashboard', () => {
    it('未登录返回 401', async () => {
      mockVerifyAccessToken.mockRejectedValueOnce(new Error('Unauthorized'))
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/dashboard',
      })
      expect(res.statusCode).toBe(401)
    })

    it('普通用户(roleId=0)返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/dashboard',
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })

    it('admin 返回 200 + dashboard 结构', async () => {
      mockAdmin()
      // 4 个 Promise.all 并发查询,每个走 mockSelectResult
      mockSelectResult.mockResolvedValueOnce([{ c: 100 }]) // pv
      mockSelectResult.mockResolvedValueOnce([{ c: 42 }]) // uv
      mockSelectResult.mockResolvedValueOnce([{ c: 18 }]) // orders
      mockSelectResult.mockResolvedValueOnce([{ total: 5600 }]) // revenue (cents)

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/dashboard',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
      expect(body.data).toHaveProperty('overview')
      expect(body.data).toHaveProperty('trend')
      expect(body.data).toHaveProperty('metrics')
      expect(body.data.overview).toHaveProperty('pv')
      expect(body.data.overview).toHaveProperty('uv')
      expect(body.data.overview).toHaveProperty('orders')
      expect(body.data.overview).toHaveProperty('revenue')
      expect(Array.isArray(body.data.trend)).toBe(true)
      expect(Array.isArray(body.data.metrics)).toBe(true)
    })

    it('DB 异常时返回 200 + 零值兜底', async () => {
      mockAdmin()
      mockSelectResult.mockRejectedValueOnce(new Error('DB connection failed'))

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/dashboard',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.overview.pv).toBe(0)
      expect(body.data.overview.uv).toBe(0)
      expect(body.data.overview.orders).toBe(0)
      expect(body.data.overview.revenue).toBe(0)
    })
  })

  // ===========================================================================
  // 3. GET /api/admin/stats/revenue
  // ===========================================================================
  describe('GET /api/admin/stats/revenue', () => {
    it('未登录返回 401', async () => {
      mockVerifyAccessToken.mockRejectedValueOnce(new Error('Unauthorized'))
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/revenue',
      })
      expect(res.statusCode).toBe(401)
    })

    it('普通用户(roleId=0)返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/revenue',
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })

    it('admin 返回 200 + revenue 结构', async () => {
      mockAdmin()
      // 6 个 Promise.all 并发查询
      mockSelectResult.mockResolvedValueOnce([{ total: 100000 }]) // totalRevenue (cents)
      mockSelectResult.mockResolvedValueOnce([{ total: 30000 }]) // monthRevenue
      mockSelectResult.mockResolvedValueOnce([{ total: 5000 }]) // todayRevenue
      mockSelectResult.mockResolvedValueOnce([{ c: 50 }]) // totalOrders
      mockSelectResult.mockResolvedValueOnce([{ c: 35 }]) // paidOrders
      mockSelectResult.mockResolvedValueOnce([{ amount: 1200.5, count: 3 }]) // refund

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/revenue',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
      expect(body.data).toHaveProperty('overview')
      expect(body.data).toHaveProperty('trend')
      expect(body.data).toHaveProperty('byChannel')
      expect(body.data).toHaveProperty('byProduct')
      const o = body.data.overview
      expect(o).toHaveProperty('totalRevenue')
      expect(o).toHaveProperty('monthRevenue')
      expect(o).toHaveProperty('todayRevenue')
      expect(o).toHaveProperty('totalOrders')
      expect(o).toHaveProperty('paidOrders')
      expect(o).toHaveProperty('refundAmount')
      expect(o).toHaveProperty('refundCount')
      expect(o).toHaveProperty('netRevenue')
      expect(o).toHaveProperty('arpu')
      expect(typeof o.totalRevenue).toBe('number')
      expect(typeof o.arpu).toBe('number')
    })

    it('DB 异常时返回 200 + 零值兜底', async () => {
      mockAdmin()
      mockSelectResult.mockRejectedValueOnce(new Error('DB connection failed'))

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/revenue',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.overview.totalRevenue).toBe(0)
      expect(body.data.overview.totalOrders).toBe(0)
      expect(body.data.overview.netRevenue).toBe(0)
      expect(body.data.overview.arpu).toBe(0)
    })
  })

  // ===========================================================================
  // 4. GET /api/admin/stats/users
  // Promise.all 8 路:totalRow / todayRow / weekRow / monthRow
  //   / dauRow / mauRow / byRoleRows / growthRows
  // ===========================================================================
  describe('GET /api/admin/stats/users', () => {
    it('未登录返回 401', async () => {
      mockVerifyAccessToken.mockRejectedValueOnce(new Error('Unauthorized'))
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/users',
      })
      expect(res.statusCode).toBe(401)
    })

    it('普通用户(roleId=0)返回 403', async () => {
      mockRegularUser()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/users',
        headers: { authorization: USER_TOKEN },
      })
      expect(res.statusCode).toBe(403)
    })

    it('admin 返回 200 + users 统计结构', async () => {
      mockAdmin()
      // 8 个 Promise.all 并发查询
      mockSelectResult.mockResolvedValueOnce([{ c: 150 }]) // totalUsers
      mockSelectResult.mockResolvedValueOnce([{ c: 5 }]) // todayNew
      mockSelectResult.mockResolvedValueOnce([{ c: 25 }]) // weekNew
      mockSelectResult.mockResolvedValueOnce([{ c: 80 }]) // monthNew
      mockSelectResult.mockResolvedValueOnce([{ c: 42 }]) // dau
      mockSelectResult.mockResolvedValueOnce([{ c: 120 }]) // mau
      mockSelectResult.mockResolvedValueOnce([
        // byRole
        { roleId: 0, count: 100 },
        { roleId: 1, count: 50 },
      ])
      mockSelectResult.mockResolvedValueOnce([
        // growth(最近 30 天按天分组)
        { day: '2026-07-25', count: 3 },
        { day: '2026-07-26', count: 5 },
      ])

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/users',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
      expect(body.data).toHaveProperty('overview')
      expect(body.data).toHaveProperty('growth')
      expect(body.data).toHaveProperty('byRole')
      expect(body.data).toHaveProperty('byRegion')
      const o = body.data.overview
      expect(o).toHaveProperty('totalUsers')
      expect(o).toHaveProperty('todayNew')
      expect(o).toHaveProperty('weekNew')
      expect(o).toHaveProperty('monthNew')
      expect(o).toHaveProperty('dau')
      expect(o).toHaveProperty('mau')
      expect(o).toHaveProperty('retention7d')
      expect(o).toHaveProperty('retention30d')
      expect(o.totalUsers).toBe(150)
      expect(o.todayNew).toBe(5)
      expect(o.weekNew).toBe(25)
      expect(o.monthNew).toBe(80)
      expect(o.dau).toBe(42)
      expect(o.mau).toBe(120)
      expect(o.retention7d).toBe(0) // 简化版保留 0
      expect(o.retention30d).toBe(0)
      expect(body.data.growth).toHaveLength(2)
      expect(body.data.growth[0]).toEqual({ day: '2026-07-25', count: 3 })
      expect(body.data.byRole).toEqual([
        { roleId: 0, count: 100 },
        { roleId: 1, count: 50 },
      ])
      expect(body.data.byRegion).toEqual([])
    })

    it('空表 — 全部归零', async () => {
      mockAdmin()
      // 8 个查询全部返回空数组 → ?? 0 兜底
      mockSelectResult.mockResolvedValueOnce([]) // totalRow
      mockSelectResult.mockResolvedValueOnce([]) // todayRow
      mockSelectResult.mockResolvedValueOnce([]) // weekRow
      mockSelectResult.mockResolvedValueOnce([]) // monthRow
      mockSelectResult.mockResolvedValueOnce([]) // dauRow
      mockSelectResult.mockResolvedValueOnce([]) // mauRow
      mockSelectResult.mockResolvedValueOnce([]) // byRoleRows
      mockSelectResult.mockResolvedValueOnce([]) // growthRows

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/users',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.overview.totalUsers).toBe(0)
      expect(body.data.overview.todayNew).toBe(0)
      expect(body.data.overview.weekNew).toBe(0)
      expect(body.data.overview.monthNew).toBe(0)
      expect(body.data.overview.dau).toBe(0)
      expect(body.data.overview.mau).toBe(0)
      expect(body.data.growth).toEqual([])
      expect(body.data.byRole).toEqual([])
      expect(body.data.byRegion).toEqual([])
    })

    it('DB 异常时返回 200 + 零值兜底', async () => {
      mockAdmin()
      mockSelectResult.mockRejectedValueOnce(new Error('DB connection failed'))

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/users',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.overview.totalUsers).toBe(0)
      expect(body.data.overview.dau).toBe(0)
      expect(body.data.overview.mau).toBe(0)
      expect(body.data.growth).toEqual([])
      expect(body.data.byRole).toEqual([])
      expect(body.data.byRegion).toEqual([])
    })

    it('byRole 多角色分组 — 透传 roleId + count', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([{ c: 200 }]) // totalUsers
      mockSelectResult.mockResolvedValueOnce([{ c: 0 }]) // todayNew
      mockSelectResult.mockResolvedValueOnce([{ c: 0 }]) // weekNew
      mockSelectResult.mockResolvedValueOnce([{ c: 0 }]) // monthNew
      mockSelectResult.mockResolvedValueOnce([{ c: 0 }]) // dau
      mockSelectResult.mockResolvedValueOnce([{ c: 0 }]) // mau
      mockSelectResult.mockResolvedValueOnce([
        { roleId: 0, count: 150 }, // 普通用户
        { roleId: 1, count: 30 }, // 管理员
        { roleId: 2, count: 20 }, // 运营
      ])
      mockSelectResult.mockResolvedValueOnce([]) // growth

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/users',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.overview.totalUsers).toBe(200)
      expect(body.data.byRole).toHaveLength(3)
      expect(body.data.byRole[0]).toEqual({ roleId: 0, count: 150 })
      expect(body.data.byRole[2]).toEqual({ roleId: 2, count: 20 })
    })

    it('growth 趋势 — 多天数据按 day 排序', async () => {
      mockAdmin()
      mockSelectResult.mockResolvedValueOnce([{ c: 100 }]) // totalUsers
      mockSelectResult.mockResolvedValueOnce([{ c: 0 }]) // todayNew
      mockSelectResult.mockResolvedValueOnce([{ c: 0 }]) // weekNew
      mockSelectResult.mockResolvedValueOnce([{ c: 0 }]) // monthNew
      mockSelectResult.mockResolvedValueOnce([{ c: 0 }]) // dau
      mockSelectResult.mockResolvedValueOnce([{ c: 0 }]) // mau
      mockSelectResult.mockResolvedValueOnce([]) // byRole
      mockSelectResult.mockResolvedValueOnce([
        { day: '2026-07-20', count: 2 },
        { day: '2026-07-21', count: 5 },
        { day: '2026-07-22', count: 8 },
        { day: '2026-07-23', count: 3 },
      ])

      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/users',
        headers: { authorization: ADMIN_TOKEN },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.growth).toHaveLength(4)
      expect(body.data.growth.map((g: { day: string }) => g.day)).toEqual([
        '2026-07-20',
        '2026-07-21',
        '2026-07-22',
        '2026-07-23',
      ])
      expect(
        body.data.growth.every((g: { day: string; count: number }) => 'day' in g && 'count' in g),
      ).toBe(true)
    })
  })

  // ===========================================================================
  // 5. 响应格式统一性验证
  // ===========================================================================
  describe('响应格式统一', () => {
    it('所有成功响应包含 code/message/data 三个字段', async () => {
      mockAdmin()
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/token-balance/metrics',
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
        url: '/api/admin/stats/revenue',
        headers: { authorization: USER_TOKEN },
      })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body.code).toBe(403)
    })
  })
})
