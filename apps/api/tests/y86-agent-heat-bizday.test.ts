// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y-86 时区错位回归(2026-11-18)。
 *
 * GET /api/statistics/agent-heat 旧用 toISOString().slice(0,10)(UTC 日)作默认 end,
 * 而写入侧刷新用 bizDayKey()(Asia/Shanghai)。北京 00–08 点 UTC 日仍是昨天 ⇒ 查不到当天热度。
 * 本用例把时钟钉在 UTC 16:30(= 北京次日 00:30),断言默认 endDate 取北京日(次日)而非 UTC 日。
 * 响应自带 dateRange,直接读它即可,无需解析 drizzle SQL。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test', PORT: 8802, HOST: '0.0.0.0', LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801', DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379', JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d', AI_SERVICE_URL: 'http://localhost:8803',
  },
  isProductionGuard: () => false,
}))

const { dbSelectMock } = vi.hoisted(() => {
  // select 链:from/where/groupBy/orderBy/limit 全返回自身,await 得 []（空结果 ⇒ 不查 agentInfos）
  const chain = () => {
    const self: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'groupBy', 'orderBy', 'limit']) self[m] = () => self
    self.then = (resolve: (v: unknown) => void) => resolve([])
    return self
  }
  return { dbSelectMock: vi.fn(() => chain()) }
})

vi.mock('../src/db/index.js', () => ({
  registerPoolTrackerCleanup: vi.fn(),
  db: { select: dbSelectMock, insert: vi.fn(), delete: vi.fn() },
  dbRead: { select: vi.fn() },
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: async (request: Record<string, unknown>) => {
    request.userId = '00000000-0000-4000-8000-000000000001'
    request.jwtPayload = { userId: request.userId, roleId: 0 }
    return true
  },
  authenticate: async (request: Record<string, unknown>) => request,
  requireActiveUser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: Record<string, unknown>) => {
    request.jwtPayload = { userId: '00000000-0000-4000-8000-000000000001', roleId: 0 }
  },
}))

vi.mock('../src/db/statistics-queries.js', () => ({
  getLearnStatistics: vi.fn(), getExamStatistics: vi.fn(), getContentStatistics: vi.fn(),
  getOverviewStatistics: vi.fn(), findStatisticsSnapshots: vi.fn(),
  findStatisticsSnapshotById: vi.fn(), createStatisticsSnapshot: vi.fn(),
  deleteStatisticsSnapshot: vi.fn(), getUserCenterStats: vi.fn(),
  findVisitLogList: vi.fn(), getMessageStatistics: vi.fn(), getLiveStatistics: vi.fn(),
  getPointStatistics: vi.fn(), getResourceStatistics: vi.fn(),
}))
vi.mock('../src/db/social-queries.js', () => ({
  countFavorites: vi.fn(), countFollowers: vi.fn(), countFollowing: vi.fn(),
}))
vi.mock('../src/db/gamification-queries.js', () => ({ findUserPoints: vi.fn() }))

import { statisticsRoutes } from '../src/routes/statistics'

describe('Y-86 GET agent-heat 默认日期 bizDayKey 口径', () => {
  const server = Fastify({ logger: false })
  beforeAll(async () => {
    await server.register(statisticsRoutes, { prefix: '/api' })
    await server.ready()
  })
  afterAll(async () => { await server.close() })
  beforeEach(() => { vi.clearAllMocks() })

  it('UTC 16:30(北京次日00:30)默认 endDate 取北京日,不是 UTC 日', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T16:30:00Z')) // UTC 11-18,北京 11-19
    const res = await server.inject({ method: 'GET', url: '/api/statistics/agent-heat' })
    vi.useRealTimers()
    expect(res.statusCode).toBe(200)
    const { dateRange } = res.json().data
    expect(dateRange.endDate).toBe('2026-11-19') // 上海日(次日),非 UTC 日 11-18
    expect(dateRange.startDate).toBe('2026-11-12') // 次日往前 7 天
  })

  it('客户端显式 endDate 时尊重原值(不被 bizDayKey 覆盖)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T16:30:00Z'))
    const res = await server.inject({
      method: 'GET', url: '/api/statistics/agent-heat?endDate=2026-11-01&startDate=2026-10-25',
    })
    vi.useRealTimers()
    expect(res.statusCode).toBe(200)
    const { dateRange } = res.json().data
    expect(dateRange.endDate).toBe('2026-11-01')
    expect(dateRange.startDate).toBe('2026-10-25')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
