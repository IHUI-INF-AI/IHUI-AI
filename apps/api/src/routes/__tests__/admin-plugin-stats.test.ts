import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ─────────────────────────────────────────────────────────────
// Mock:admin 鉴权层
// ─────────────────────────────────────────────────────────────
const { setAdmin, setAdminUser, getAdmin } = vi.hoisted(() => {
  let isAdmin = true
  let adminUser: { userId: string; roleId: number } | null = {
    userId: 'admin-test-001',
    roleId: 1,
  }
  return {
    setAdmin: (v: boolean) => {
      isAdmin = v
    },
    setAdminUser: (u: { userId: string; roleId: number } | null) => {
      adminUser = u
    },
    getAdmin: () => (isAdmin ? adminUser : null),
  }
})

vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async (request: any, reply: any) => {
    const admin = getAdmin()
    if (!admin) {
      return reply.status(403).send({ code: 403, message: 'Admin required', data: null })
    }
    request.user = admin
  }),
}))

// ─────────────────────────────────────────────────────────────
// Mock:统计查询层
// ─────────────────────────────────────────────────────────────
const mockSummary = vi.fn()
const mockTop = vi.fn()
const mockTrend = vi.fn()

vi.mock('../../db/plugin-events-queries.js', () => ({
  getPluginStatsSummary: vi.fn((...args: unknown[]) => mockSummary(...args)),
  getPluginStatsByPlugin: vi.fn((...args: unknown[]) => mockTop(...args)),
  getPluginStatsTrend: vi.fn((...args: unknown[]) => mockTrend(...args)),
}))

import { adminPluginStatsRoutes } from '../admin-plugin-stats.js'

describe('Admin Plugin Stats API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminPluginStatsRoutes, { prefix: '/api/admin/plugins' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    setAdmin(true)
    setAdminUser({ userId: 'admin-test-001', roleId: 1 })
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────
  // 鉴权
  // ─────────────────────────────────────────────────────────
  it('非 admin → 403', async () => {
    setAdmin(false)
    const res = await app.inject({ method: 'GET', url: '/api/admin/plugins/stats/summary' })
    expect(res.statusCode).toBe(403)
  })

  // ─────────────────────────────────────────────────────────
  // GET /stats/summary
  // ─────────────────────────────────────────────────────────
  it('GET /stats/summary 默认 days=7', async () => {
    mockSummary.mockResolvedValueOnce({
      totalEvents: 100,
      totalInstalls: 50,
      totalUninstalls: 5,
      totalClicks: 200,
      totalPins: 20,
      totalUnpins: 2,
      todayInstalls: 3,
      todayClicks: 15,
    })
    const res = await app.inject({ method: 'GET', url: '/api/admin/plugins/stats/summary' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.totalInstalls).toBe(50)
    expect(body.data.todayClicks).toBe(15)
    expect(mockSummary).toHaveBeenCalledWith(7)
  })

  it('GET /stats/summary?days=30 透传 days', async () => {
    mockSummary.mockResolvedValueOnce({ totalEvents: 0, totalInstalls: 0, totalUninstalls: 0, totalClicks: 0, totalPins: 0, totalUnpins: 0, todayInstalls: 0, todayClicks: 0 })
    const res = await app.inject({ method: 'GET', url: '/api/admin/plugins/stats/summary?days=30' })
    expect(res.statusCode).toBe(200)
    expect(mockSummary).toHaveBeenCalledWith(30)
  })

  it('GET /stats/summary?days=abc 非法 days → 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/plugins/stats/summary?days=abc' })
    expect(res.statusCode).toBe(400)
  })

  it('GET /stats/summary?days=0 越界 → 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/plugins/stats/summary?days=0' })
    expect(res.statusCode).toBe(400)
  })

  it('GET /stats/summary?days=400 超上限 → 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/plugins/stats/summary?days=400' })
    expect(res.statusCode).toBe(400)
  })

  // ─────────────────────────────────────────────────────────
  // GET /stats/top
  // ─────────────────────────────────────────────────────────
  it('GET /stats/top 默认 limit=20', async () => {
    mockTop.mockResolvedValueOnce([
      { pluginId: 'playwright-mcp', installs: 10, uninstalls: 1, clicks: 50, pins: 5, unpins: 0, heat: 250 },
      { pluginId: 'remotion', installs: 8, uninstalls: 0, clicks: 30, pins: 3, unpins: 1, heat: 190 },
    ])
    const res = await app.inject({ method: 'GET', url: '/api/admin/plugins/stats/top' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(2)
    expect(body.data[0].pluginId).toBe('playwright-mcp')
    expect(body.data[0].heat).toBe(250)
    expect(mockTop).toHaveBeenCalledWith(20)
  })

  it('GET /stats/top?limit=50 透传 limit', async () => {
    mockTop.mockResolvedValueOnce([])
    const res = await app.inject({ method: 'GET', url: '/api/admin/plugins/stats/top?limit=50' })
    expect(res.statusCode).toBe(200)
    expect(mockTop).toHaveBeenCalledWith(50)
  })

  it('GET /stats/top?limit=0 越界 → 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/plugins/stats/top?limit=0' })
    expect(res.statusCode).toBe(400)
  })

  it('GET /stats/top?limit=200 超上限 → 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/plugins/stats/top?limit=200' })
    expect(res.statusCode).toBe(400)
  })

  // ─────────────────────────────────────────────────────────
  // GET /stats/trend
  // ─────────────────────────────────────────────────────────
  it('GET /stats/trend 默认 days=7', async () => {
    mockTrend.mockResolvedValueOnce([
      { date: '2026-07-22', installs: 5, clicks: 20, uninstalls: 1 },
      { date: '2026-07-21', installs: 3, clicks: 15, uninstalls: 0 },
    ])
    const res = await app.inject({ method: 'GET', url: '/api/admin/plugins/stats/trend' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(2)
    expect(body.data[0].date).toBe('2026-07-22')
    expect(mockTrend).toHaveBeenCalledWith(7)
  })

  it('GET /stats/trend?days=90 透传 days', async () => {
    mockTrend.mockResolvedValueOnce([])
    const res = await app.inject({ method: 'GET', url: '/api/admin/plugins/stats/trend?days=90' })
    expect(res.statusCode).toBe(200)
    expect(mockTrend).toHaveBeenCalledWith(90)
  })

  // ─────────────────────────────────────────────────────────
  // 查询层异常透传
  // ─────────────────────────────────────────────────────────
  it('查询层抛错 → 500', async () => {
    mockSummary.mockRejectedValueOnce(new Error('DB connection lost'))
    const res = await app.inject({ method: 'GET', url: '/api/admin/plugins/stats/summary' })
    expect(res.statusCode).toBe(500)
  })
})
