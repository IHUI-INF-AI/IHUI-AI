// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-578 回归锁(2026-11-13)。
 *
 * 病灶:/admin/stats/visit-trend 用 `toISOString().slice(0,10)`(UTC 日)切窗口,而 visit_date
 * 由写入端 `bizDayKey()` 按上海日(+08)落库 ⇒ 上海 00:00–08:00 窗口整体偏移一天;
 * 且 start = now - spanDays 使「30 天窗口」实际带 31 个自然日。回退列 `to_char(created_at, …)`
 * 又跟随 DB 会话时区,与 visit_date 不同源。
 *
 * 本文件锁四条:
 *  ① 固定 2026-11-12T18:30:00Z(上海 11-13 02:30)⇒ range 取上海日 11-13,start 为 10-15;
 *  ② 上海 11-12 23:30(UTC 仍是 11-12)→ end 必须是 11-12,不得提前跳日;
 *  ③ 窗口天数与参数一致(day=30 / week=84 / month=365,含当日);
 *  ④ 回退列 SQL 必须含 `AT TIME ZONE 'Asia/Shanghai'`,且查询下界绑定的是上海日键。
 *
 * 只 mock config / requireAdmin / db,不依赖真实 PG 与鉴权。
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'

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
    AI_CALLBACK_SECRET: '',
    ADMIN_TOTP_MODE: 'off',
  },
  isProductionGuard: () => false,
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
}))

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }))

vi.mock('../src/db/index.js', () => ({
  db: {
    execute: executeMock,
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dbRead: { execute: vi.fn(), select: vi.fn() },
  dbClient: {},
}))

import statsRoutes from '../src/routes/admin/stats.js'

const dialect = new PgDialect()

interface TrendRange {
  start: string
  end: string
}

interface TrendResponse {
  code: number
  data: { range: TrendRange }
}

function compiled(stmt: unknown): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(stmt as Parameters<PgDialect['sqlToQuery']>[0])
}

function daySpan(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1
}

describe('F-578 /admin/stats/visit-trend 必须按上海日切窗口', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(statsRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    executeMock.mockReset()
    executeMock.mockResolvedValue([])
    // 只替换 Date,保留真实定时器,避免干扰 Fastify inject 内部等待。
    vi.useFakeTimers({ toFake: ['Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const fetchTrend = async (granularity: string): Promise<TrendResponse> => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/stats/visit-trend?granularity=${granularity}`,
    })
    expect(res.statusCode).toBe(200)
    return res.json() as TrendResponse
  }

  it('固定 UTC 2026-11-12T18:30:00Z(上海 11-13 02:30)⇒ 窗口端点是上海日', async () => {
    vi.setSystemTime(new Date('2026-11-12T18:30:00.000Z'))
    const body = await fetchTrend('day')
    expect(body.data.range.end).toBe('2026-11-13')
    expect(body.data.range.start).toBe('2026-10-15')
  })

  it('上海 11-12 23:30(UTC 仍为 11-12)⇒ end 不提前跳日', async () => {
    vi.setSystemTime(new Date('2026-11-12T15:30:00.000Z'))
    const body = await fetchTrend('day')
    expect(body.data.range.end).toBe('2026-11-12')
    expect(body.data.range.start).toBe('2026-10-14')
  })

  it('窗口天数与参数一致且含当日(day=30 / week=84 / month=365)', async () => {
    vi.setSystemTime(new Date('2026-11-12T18:30:00.000Z'))
    const expected: Array<[string, number, string]> = [
      ['day', 30, '2026-10-15'],
      ['week', 84, '2026-08-22'],
      ['month', 365, '2025-11-14'],
    ]
    for (const [granularity, spanDays, expectedStart] of expected) {
      executeMock.mockClear()
      const body = await fetchTrend(granularity)
      const { start, end } = body.data.range
      expect(end).toBe('2026-11-13')
      expect(start).toBe(expectedStart)
      expect(daySpan(start, end)).toBe(spanDays)
    }
  })

  it('回退列 SQL 折成上海日,查询下界绑定上海日键', async () => {
    vi.setSystemTime(new Date('2026-11-12T18:30:00.000Z'))
    await fetchTrend('day')
    expect(executeMock).toHaveBeenCalledTimes(5)
    for (const call of executeMock.mock.calls) {
      const { sql, params } = compiled(call[0])
      expect(sql).toContain('to_char(created_at AT TIME ZONE \'Asia/Shanghai\', \'YYYY-MM-DD\')')
      expect(params[0]).toBe('2026-10-15')
    }
  })
})
