// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y-86 回归锁:P2 时区错位 —— agent-heat 两个 GET 端点的默认日期窗口必须用 bizDayKey(Asia/Shanghai)。
 *
 * 原缺陷:GET /statistics/agent-heat 与 GET /statistics/agent-heat/:agentId 用
 * `new Date().toISOString().slice(0,10)` 取默认 end,UTC 取日;而写入侧 refreshAgentHeat
 * (同文件)用 bizDayKey()。上海 00:00–08:00 之间读默认窗口会整体错开一天
 * (上界落到 UTC 的"昨天"),与写入口径分叉。
 *
 * 本文件锁:冻结上海已跨日但 UTC 未跨日的时刻(2026-11-07T16:30:00Z = 上海 2026-11-08 00:30),
 * 不传 startDate/endDate 时两个端点的 dateRange 上界必须 = 上海日 2026-11-08,而不是 UTC 的 2026-11-07。
 *
 * 只 mock auth / db / 查询层,不触达真实 PG。
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    AI_CALLBACK_SECRET: '',
    ADMIN_TOTP_MODE: 'off',
  },
  isProductionGuard: () => false,
}))

const H = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: async (request: Record<string, unknown>) => {
    request.userId = '00000000-0000-4000-8000-000000000001'
    request.jwtPayload = { userId: request.userId, roleId: 0 }
    return true
  },
  authenticate: async (request: Record<string, unknown>) => {
    request.userId = '00000000-0000-4000-8000-000000000001'
    request.jwtPayload = { userId: request.userId, roleId: 0 }
    return request.jwtPayload
  },
  requireActiveUser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requirePermission: () => async () => {},
  requireAnyPermission: () => async () => {},
  requireAdmin: async () => {},
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => {
      const rows = H.selectQueue.shift() ?? []
      const step: Record<string, unknown> = {}
      for (const m of ['from', 'where', 'groupBy', 'orderBy', 'limit', 'offset']) {
        step[m] = vi.fn(() => step)
      }
      step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(rows).then(resolve, reject)
      return step
    }),
    insert: vi.fn(),
    delete: vi.fn(),
  },
  dbRead: { select: vi.fn() },
}))

vi.mock('../src/db/statistics-queries.js', () => ({
  getLearnStatistics: vi.fn(),
  getExamStatistics: vi.fn(),
  getContentStatistics: vi.fn(),
  getOverviewStatistics: vi.fn(),
  findStatisticsSnapshots: vi.fn(),
  findStatisticsSnapshotById: vi.fn(),
  createStatisticsSnapshot: vi.fn(),
  deleteStatisticsSnapshot: vi.fn(),
  getMessageStatistics: vi.fn(),
  getLiveStatistics: vi.fn(),
  getPointStatistics: vi.fn(),
  getResourceStatistics: vi.fn(),
  getUserCenterStats: vi.fn(),
  findVisitLogList: vi.fn(),
}))

import { statisticsRoutes } from '../src/routes/statistics'
import { bizDayKey } from '../src/utils/biz-day.js'

const AGENT_ID = 'aaaaaaaa-0000-4000-8000-000000000001'

/** 让聚合与 agent 基本信息两次 select 各有内容,避免 404。 */
function stageRows(): void {
  H.selectQueue.push([{ agentId: AGENT_ID, totalHits: 5, days: 1 }])
  H.selectQueue.push([])
  H.selectQueue.push([
    {
      agentId: AGENT_ID,
      name: '测试 Agent',
      avatar: null,
      usageCount: 5,
      likeCount: 0,
      shareCount: 0,
    },
  ])
}

/** 详情端点只做两次 select:dailyRows + agentRows,顺序与列表不同。 */
function stageDetailRows(): void {
  H.selectQueue.push([
    { dateStr: '2026-11-08', hitCount: 5 },
  ])
  H.selectQueue.push([
    {
      agentId: AGENT_ID,
      name: '测试 Agent',
      avatar: null,
      usageCount: 5,
      likeCount: 0,
      shareCount: 0,
    },
  ])
}

describe('Y-86 agent-heat 默认窗口用上海业务日', () => {
  const server = Fastify({ logger: false })

  beforeEach(() => {
    // 只伪造 Date,不伪造定时器 —— inject 的流式调度依赖真实定时器
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-07T16:30:00.000Z'))
    H.selectQueue.length = 0
  })

  beforeAll(async () => {
    await server.register(statisticsRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('上海 2026-11-08 00:30(UTC 仍 11-07)时 bizDayKey = 2026-11-08', () => {
    expect(bizDayKey()).toBe('2026-11-08')
  })

  it('GET /statistics/agent-heat 不传日期 ⇒ dateRange 上界 = 2026-11-08(不是 UTC 的 11-07)', async () => {
    stageRows()
    const res = await server.inject({ method: 'GET', url: '/api/statistics/agent-heat' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: { dateRange: { startDate: string; endDate: string } }
    }
    expect(body.data.dateRange.endDate).toBe('2026-11-08')
    expect(body.data.dateRange.startDate).toBe('2026-11-01')
  })

  it('GET /statistics/agent-heat/:agentId 不传日期 ⇒ dateRange 上界 = 2026-11-08', async () => {
    stageDetailRows()
    const res = await server.inject({
      method: 'GET',
      url: `/api/statistics/agent-heat/${AGENT_ID}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: { dateRange: { startDate: string; endDate: string } }
    }
    expect(body.data.dateRange.endDate).toBe('2026-11-08')
    expect(body.data.dateRange.startDate).toBe('2026-11-01')
  })
})
