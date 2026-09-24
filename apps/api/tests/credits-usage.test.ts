// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

const { dbQueue, captured, mockAuthenticate } = vi.hoisted(() => ({
  dbQueue: { items: [] as unknown[][] },
  captured: {
    selectFields: undefined as unknown,
    whereArgs: [] as unknown[][],
    groupByArgs: [] as unknown[][],
  },
  mockAuthenticate: vi.fn(),
}))

// Mock config 避免导入 env 校验触发 process.exit(1)
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

// 鉴权替身:无 authorization 头即抛错(路由 preHandler 映射 401);带头则注入 userId
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// 只读查询链替身:select().from().where().groupBy() 逐步返回 chain,await 时吐队列行
vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: {
      then: (resolve: (v: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of ['select', 'from', 'where', 'groupBy', 'orderBy', 'limit', 'offset']) {
      chain[m] = vi.fn((...args: unknown[]) => {
        if (m === 'where') captured.whereArgs.push(args)
        if (m === 'groupBy') captured.groupByArgs.push(args)
        return chain
      })
    }
    return chain
  }
  return {
    db: {
      select: vi.fn((fields: unknown) => {
        captured.selectFields = fields
        return createChain()
      }),
    },
  }
})

import { creditsUsageRoutes } from '../src/routes/credits-usage'
import { utcDateKey, buildBuckets } from '../src/services/credits-usage-service'

interface UsageResponse {
  code: number
  message: string
  data?: {
    days: number
    startDate: string
    endDate: string
    timezone: string
    buckets: { date: string; count: number; points: number; sessions: number }[]
  }
}

/** 递归收集 drizzle SQL 模板里的字面量 chunk(验证 AT TIME ZONE 'UTC' 口径) */
function flattenSqlChunks(node: unknown, out: string[]): string[] {
  if (typeof node === 'string') out.push(node)
  else if (Array.isArray(node)) for (const item of node) flattenSqlChunks(item, out)
  else if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>
    if ('queryChunks' in rec) flattenSqlChunks(rec['queryChunks'], out)
    if ('value' in rec) flattenSqlChunks(rec['value'], out)
  }
  return out
}

describe('credits-usage routes(按日积分消耗聚合,只读)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(creditsUsageRoutes, { prefix: '/api/credits' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    dbQueue.items = []
    captured.selectFields = undefined
    captured.whereArgs = []
    captured.groupByArgs = []
    mockAuthenticate.mockReset()
    mockAuthenticate.mockImplementation(async (req: unknown) => {
      const r = req as { headers: { authorization?: string }; userId?: string }
      if (!r.headers.authorization) throw new Error('未登录')
      r.userId = 'user-1'
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('GET /api/credits/usage/daily 未登录 → 401(鉴权面前置,不落到参数校验)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/credits/usage/daily?days=400' })
    expect(res.statusCode).toBe(401)
    expect(mockAuthenticate).toHaveBeenCalled()
  })

  it('days 越界/非法(0 / 400 / abc)→ 400,任意值不进 SQL', async () => {
    for (const bad of ['0', '400', 'abc']) {
      const res = await server.inject({
        method: 'GET',
        url: `/api/credits/usage/daily?days=${bad}`,
        headers: { authorization: 'Bearer test' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json() as { code: number }
      expect(body.code).toBe(400)
    }
    // 参数被拒时不得触达查询层
    expect(dbQueue.items).toHaveLength(0)
    expect(captured.whereArgs).toHaveLength(0)
  })

  it('days 缺省 → 90', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T10:00:00Z'))
    dbQueue.items = [[]]
    const res = await server.inject({
      method: 'GET',
      url: '/api/credits/usage/daily',
      headers: { authorization: 'Bearer test' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as UsageResponse
    expect(body.data?.days).toBe(90)
    expect(body.data?.timezone).toBe('UTC')
  })

  it('跨月 + 无消耗日补零:2026-09-02T00:30Z 取 4 天 → 08-30..09-02,原始行只有 08-31 也补齐 4 桶', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T00:30:00Z'))
    // pg 驱动聚合列可能回传字符串,buildBuckets 必须归一为 number
    // 第 2 组队列 = 当日新建会话数(chat_conversations 分桶)
    dbQueue.items = [
      [{ date: '2026-08-31', count: '2', points: '30' }],
      [{ date: '2026-08-31', sessions: '3' }],
    ]
    const res = await server.inject({
      method: 'GET',
      url: '/api/credits/usage/daily?days=4',
      headers: { authorization: 'Bearer test' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as UsageResponse
    expect(body.code).toBe(0)
    expect(body.data?.startDate).toBe('2026-08-30')
    expect(body.data?.endDate).toBe('2026-09-02')
    expect(body.data?.buckets).toEqual([
      { date: '2026-08-30', count: 0, points: 0, sessions: 0 },
      { date: '2026-08-31', count: 2, points: 30, sessions: 3 },
      { date: '2026-09-01', count: 0, points: 0, sessions: 0 },
      { date: '2026-09-02', count: 0, points: 0, sessions: 0 },
    ])
  })

  it('会话序列缺日补零且与消耗互不换算:当日有消耗无会话 → sessions=0(不得拿 points 顶替)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T00:30:00Z'))
    dbQueue.items = [
      [{ date: '2026-09-02', count: '5', points: '77' }],
      [], // 会话表当日无行
    ]
    const res = await server.inject({
      method: 'GET',
      url: '/api/credits/usage/daily?days=2',
      headers: { authorization: 'Bearer test' },
    })
    const body = res.json() as UsageResponse
    expect(body.data?.buckets).toEqual([
      { date: '2026-09-01', count: 0, points: 0, sessions: 0 },
      { date: '2026-09-02', count: 5, points: 77, sessions: 0 },
    ])
  })

  it("GROUP BY 表达式必须是 UTC 时区口径(to_char … AT TIME ZONE 'UTC')", async () => {
    dbQueue.items = [[]]
    const res = await server.inject({
      method: 'GET',
      url: '/api/credits/usage/daily?days=7',
      headers: { authorization: 'Bearer test' },
    })
    expect(res.statusCode).toBe(200)
    const groupByArg = captured.groupByArgs[0]?.[0]
    expect(groupByArg).toBeDefined()
    const literals = flattenSqlChunks(groupByArg, []).join('')
    expect(literals).toContain(`AT TIME ZONE 'UTC'`)
    expect(literals).toContain('YYYY-MM-DD')
    // 会话序列必须与消耗序列同一时区口径,否则两张视图的日期键会错一天
    const convGroupByArg = captured.groupByArgs[1]?.[0]
    expect(convGroupByArg).toBeDefined()
    const convLiterals = flattenSqlChunks(convGroupByArg, []).join('')
    expect(convLiterals).toContain(`AT TIME ZONE 'UTC'`)
    expect(convLiterals).toContain('YYYY-MM-DD')
  })

  it('utcDateKey 日期边界:23:59:59.999Z 属当日,00:00:00Z 属次日', () => {
    expect(utcDateKey(new Date('2026-08-31T23:59:59.999Z'))).toBe('2026-08-31')
    expect(utcDateKey(new Date('2026-09-01T00:00:00.000Z'))).toBe('2026-09-01')
  })

  it('buildBuckets:乱序原始行归正、区间外日期丢弃、同日多行累加、会话表缺省补零', () => {
    const buckets = buildBuckets(
      [
        { date: '2026-03-02', count: 1, points: 5 },
        { date: '2026-03-01', count: 2, points: 10 },
        { date: '2026-03-01', count: 3, points: 7 },
        { date: '2026-04-10', count: 9, points: 9 }, // 区间外(未来)→ 丢弃
        { date: null, count: 4, points: 4 }, // 脏行 → 丢弃
      ],
      '2026-03-01',
      '2026-03-03',
    )
    expect(buckets).toEqual([
      { date: '2026-03-01', count: 5, points: 17, sessions: 0 },
      { date: '2026-03-02', count: 1, points: 5, sessions: 0 },
      { date: '2026-03-03', count: 0, points: 0, sessions: 0 },
    ])
  })

  it('buildBuckets 传入会话映射:命中的日期填 sessions,未命中仍为 0', () => {
    const buckets = buildBuckets(
      [{ date: '2026-03-01', count: 2, points: 10 }],
      '2026-03-01',
      '2026-03-02',
      new Map([
        ['2026-03-02', 4],
        ['2026-01-01', 99], // 区间外键 → 不参与
      ]),
    )
    expect(buckets).toEqual([
      { date: '2026-03-01', count: 2, points: 10, sessions: 0 },
      { date: '2026-03-02', count: 0, points: 0, sessions: 4 },
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
