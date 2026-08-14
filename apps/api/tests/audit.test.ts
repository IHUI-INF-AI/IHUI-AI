import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// Mock config 避免导入时 env 校验触发 process.exit(1)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

// ---------- 鉴权 mock ----------
const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
}))

// ---------- 审计查询 mock ----------
const { mockFindAuditLogs, mockGetDetailedStats, mockExportAuditLogs } = vi.hoisted(() => ({
  mockFindAuditLogs: vi.fn(),
  mockGetDetailedStats: vi.fn(),
  mockExportAuditLogs: vi.fn(),
}))

vi.mock('../src/db/search-queries.js', () => ({
  findAuditLogs: mockFindAuditLogs,
  getDetailedStats: mockGetDetailedStats,
  exportAuditLogs: mockExportAuditLogs,
}))

import { auditRoutes } from '../src/routes/audit'

const NOW = new Date('2026-07-26T00:00:00Z')

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-001',
    userId: '11111111-1111-4111-8111-111111111111',
    action: 'create',
    resourceType: 'order',
    resourceId: 'ORD001',
    ip: '127.0.0.1',
    userAgent: 'vitest/1.0',
    createdAt: NOW,
    details: { foo: 'bar' },
    ...overrides,
  }
}

describe('audit routes — 审计日志高风险路由', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    // 统一错误处理:AJV 校验错误(statusCode=400)/ZodError/通用错误都按 statusCode 返回,
    // 否则 Fastify 默认会把 AJV type 校验错误当作 500(参考 admin-resource.test.ts 模式)。
    server.setErrorHandler((err, _req, reply) => {
      const isZodErr =
        err.name === 'ZodError' && Array.isArray((err as { issues?: unknown[] }).issues)
      const statusCode = isZodErr
        ? 400
        : err.statusCode && err.statusCode >= 400 && err.statusCode < 600
          ? err.statusCode
          : 500
      const message = isZodErr
        ? ((err as { issues?: Array<{ message?: string }> }).issues?.[0]?.message ?? '参数错误')
        : statusCode >= 500
          ? '服务器错误'
          : err.message
      reply.status(statusCode).send({ code: statusCode, message })
    })
    await server.register(auditRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // 默认未登录
    mockAuthenticate.mockImplementation(() => {
      const err = new Error('Authentication required')
      ;(err as Error & { statusCode: number }).statusCode = 401
      throw err
    })
  })

  function authAs(userId = 'user-001', roleId = 0) {
    mockAuthenticate.mockImplementation(
      (request: { userId?: string; jwtPayload?: { userId: string; roleId: number } }) => {
        request.userId = userId
        request.jwtPayload = { userId, roleId }
        return Promise.resolve(request.jwtPayload)
      },
    )
  }

  function authAsAdmin(userId = 'admin-001') {
    authAs(userId, 1)
  }

  // ===================== 鉴权 =====================

  describe('GET /api/admin/audit-logs 鉴权', () => {
    it('未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/admin/audit-logs' })
      expect(res.statusCode).toBe(401)
    })

    it('普通用户(roleId=0)返回 403', async () => {
      authAs('user-001', 0)
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('管理员')
    })

    it('管理员(roleId=1)返回 200', async () => {
      authAsAdmin()
      mockFindAuditLogs.mockResolvedValueOnce({ list: [makeLog()], total: 1 })
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockFindAuditLogs).toHaveBeenCalled()
    })
  })

  describe('GET /api/admin/stats/detailed 鉴权', () => {
    it('未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/admin/stats/detailed' })
      expect(res.statusCode).toBe(401)
    })

    it('普通用户返回 403', async () => {
      authAs('user-001', 0)
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/detailed',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('管理员返回 200 + 统计数据', async () => {
      authAsAdmin()
      mockGetDetailedStats.mockResolvedValueOnce({ userGrowth: [], totalOrders: 100 })
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/stats/detailed',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.totalOrders).toBe(100)
      expect(mockGetDetailedStats).toHaveBeenCalled()
    })
  })

  // ===================== 分页 + 过滤 =====================

  describe('GET /api/admin/audit-logs 分页与过滤', () => {
    beforeEach(() => {
      authAsAdmin()
    })

    it('默认分页 page=1 pageSize=20', async () => {
      mockFindAuditLogs.mockResolvedValueOnce({ list: [], total: 0 })
      await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs',
        headers: { authorization: 'Bearer t' },
      })
      expect(mockFindAuditLogs).toHaveBeenCalledWith(1, 20, expect.objectContaining({}))
    })

    it('自定义 page=2 pageSize=50 透传', async () => {
      mockFindAuditLogs.mockResolvedValueOnce({ list: [], total: 100 })
      await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs?page=2&pageSize=50',
        headers: { authorization: 'Bearer t' },
      })
      expect(mockFindAuditLogs).toHaveBeenCalledWith(2, 50, expect.objectContaining({}))
    })

    it('pageSize 超过 100 返回 400(参数校验)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs?pageSize=200',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('page=0 返回 400(参数校验)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs?page=0',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('按 action 过滤透传到查询', async () => {
      mockFindAuditLogs.mockResolvedValueOnce({ list: [], total: 0 })
      await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs?action=delete',
        headers: { authorization: 'Bearer t' },
      })
      expect(mockFindAuditLogs).toHaveBeenCalledWith(
        1,
        20,
        expect.objectContaining({ action: 'delete' }),
      )
    })

    it('按 resourceType 过滤透传', async () => {
      mockFindAuditLogs.mockResolvedValueOnce({ list: [], total: 0 })
      await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs?resourceType=user',
        headers: { authorization: 'Bearer t' },
      })
      expect(mockFindAuditLogs).toHaveBeenCalledWith(
        1,
        20,
        expect.objectContaining({ resourceType: 'user' }),
      )
    })

    it('按时间范围 startDate/endDate 过滤透传', async () => {
      mockFindAuditLogs.mockResolvedValueOnce({ list: [], total: 0 })
      await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs?startDate=2026-07-01&endDate=2026-07-31',
        headers: { authorization: 'Bearer t' },
      })
      expect(mockFindAuditLogs).toHaveBeenCalledWith(
        1,
        20,
        expect.objectContaining({ startDate: '2026-07-01', endDate: '2026-07-31' }),
      )
    })

    it('按 userId(UUID) 过滤透传', async () => {
      mockFindAuditLogs.mockResolvedValueOnce({ list: [], total: 0 })
      const uuid = '11111111-1111-4111-8111-111111111111'
      await server.inject({
        method: 'GET',
        url: `/api/admin/audit-logs?userId=${uuid}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(mockFindAuditLogs).toHaveBeenCalledWith(
        1,
        20,
        expect.objectContaining({ userId: uuid }),
      )
    })

    it('userId 非 UUID 格式返回 400', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs?userId=not-a-uuid',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('返回体包含分页元数据 list/total/page/pageSize', async () => {
      mockFindAuditLogs.mockResolvedValueOnce({ list: [makeLog()], total: 42 })
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs?page=3&pageSize=10',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const data = res.json().data
      expect(data.list).toHaveLength(1)
      expect(data.total).toBe(42)
      expect(data.page).toBe(3)
      expect(data.pageSize).toBe(10)
    })
  })

  // ===================== 导出 =====================

  describe('GET /api/admin/audit-logs/export 导出', () => {
    beforeEach(() => {
      authAsAdmin()
    })

    it('默认 CSV 格式,Content-Type 为 text/csv', async () => {
      mockExportAuditLogs.mockResolvedValueOnce([makeLog()])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/export',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('text/csv')
      expect(res.headers['content-disposition']).toContain('audit-logs-')
      // BOM 前缀
      expect(res.body.startsWith('\uFEFF')).toBe(true)
      // 表头
      expect(res.body).toContain('id,userId,action,resourceType')
    })

    it('format=json 返回 JSON 格式', async () => {
      mockExportAuditLogs.mockResolvedValueOnce([makeLog({ action: 'update' })])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/export?format=json',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('application/json')
      const body = JSON.parse(res.body)
      expect(body.count).toBe(1)
      expect(body.items[0].action).toBe('update')
      expect(body.exportedAt).toBeTruthy()
    })

    it('limit 透传到 exportAuditLogs', async () => {
      mockExportAuditLogs.mockResolvedValueOnce([])
      await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/export?limit=100',
        headers: { authorization: 'Bearer t' },
      })
      expect(mockExportAuditLogs).toHaveBeenCalledWith(expect.any(Object), 100)
    })

    it('limit 超过 10000 返回 400', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/export?limit=99999',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('CSV 中包含逗号/换行的字段被正确转义', async () => {
      mockExportAuditLogs.mockResolvedValueOnce([
        makeLog({ details: { note: 'hello, world\nnew line' } }),
      ])
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/export',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      // 含特殊字符的字段被双引号包裹
      expect(res.body).toContain('"')
    })

    it('普通用户(roleId=0)导出返回 403', async () => {
      authAs('user-001', 0)
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/export',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
      expect(mockExportAuditLogs).not.toHaveBeenCalled()
    })
  })
})
