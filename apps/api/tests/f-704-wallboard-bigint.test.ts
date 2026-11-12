// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-704 回归锁(2026-11-11):运营大屏当日聚合 int32 收窄溢出。
 *
 * 病灶:`llm_call_logs.total_tokens` 当日 SUM 已是 int8,却又被 `::bigint::int` 收窄回
 *       int32;当日 token 超 2^31 时 Postgres 抛 "integer out of range" ⇒ buildBusiness
 *       整块 catch 成 null ⇒ 调用/token/成本/错误率一起「不可用」。
 * 判据:① 本文件 SQL 聚合不再出现 `::bigint::int` 或任何 `::int` 收窄,统一 `::bigint`;
 *       ② 取值处把 int8/numeric 字符串收口成 number(响应契约不变);
 *       ③ 模拟超 2^31 的聚合行仍返回 number 且非 NaN,null/缺行 → 0。
 * 不连 DB/Redis,不出网(fetch 桩直接拒绝,各数据源按设计降级 null)。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  return {
    /** 行集:按 select 的列名指纹分派,避免依赖查询调用顺序。 */
    rows: {} as Record<string, Array<Record<string, unknown>>>,
  }
})

vi.mock('../src/db/index.js', () => {
  function keyOf(cols: Record<string, unknown>): string {
    const k = Object.keys(cols)
    if (k.includes('todayNew')) return 'users'
    if (k.includes('amountCents')) return 'ordersToday'
    if (k.includes('maxStreak')) return 'signToday'
    if (k.includes('tokens')) return 'llmToday'
    if (k.includes('avgLatency')) return 'apiToday'
    if (k.includes('path')) return 'topEndpoints'
    if (k.includes('model')) return 'llmModels'
    if (k.includes('names')) return 'firingNames'
    if (k.includes('firedAt')) return 'alertsRecent'
    if (k.includes('hour')) return 'trendHours'
    if (k.includes('date') && k.includes('count')) return 'userGrowth'
    if (k.includes('date') && k.includes('users')) return 'signWeek'
    if (k.includes('type')) return 'events'
    if (k.length === 1 && k[0] === 'n') return 'firingTotal'
    if (k.length === 1 && k[0] === 'paid') return 'ordersYesterday'
    if (k.length === 1 && k[0] === 'users') return 'activeUsers7d'
    return 'default'
  }

  interface QueryChain {
    from(): QueryChain
    where(): QueryChain
    groupBy(): QueryChain
    orderBy(): QueryChain
    limit(): Promise<Array<Record<string, unknown>>>
    catch(fn: (e: unknown) => unknown): Promise<unknown>
    then(
      onFulfilled?: (v: Array<Record<string, unknown>>) => unknown,
      onRejected?: (e: unknown) => unknown,
    ): Promise<unknown>
    finally(fn: () => void): Promise<Array<Record<string, unknown>>>
  }

  function chainFor(rows: Array<Record<string, unknown>>): QueryChain {
    const p = Promise.resolve(rows)
    const chain: QueryChain = {
      from: () => chain,
      where: () => chain,
      groupBy: () => chain,
      orderBy: () => chain,
      limit: () => p,
      catch: (fn) => p.catch(fn),
      then: (onFulfilled, onRejected) => p.then(onFulfilled, onRejected),
      finally: (fn) => p.finally(fn),
    }
    return chain
  }

  const root = {
    select: (cols: Record<string, unknown>) => chainFor(h.rows[keyOf(cols)] ?? []),
  }
  return { db: root, dbRead: root, dbClient: {} }
})

// 管理员闸门与本票机制无关,放行为 no-op(不加载 auth/rbac 链)
vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: async () => {} }))

// 其它数据腿一律降级 null:本票只看业务库聚合的 int8 收口。
vi.mock('../src/services/edge-access.js', () => ({
  latestEdgeSnapshot: () => null,
  edgeSeries: () => [],
}))
vi.mock('../src/services/traffic-stats-service.js', () => ({ getTrafficLiveSnapshot: async () => null }))
vi.mock('../src/db/visit-tracking-queries.js', () => ({
  getPageUsageLiveSnapshot: async () => null,
}))
vi.mock('../src/services/engagement-stats-service.js', () => ({
  getEngagementLiveSnapshot: async () => null,
}))
vi.mock('../src/services/audience-stats-service.js', () => ({
  getAudienceLiveSnapshot: async () => null,
}))
vi.mock('../src/services/session-quality-stats-service.js', () => ({
  getSessionQualityLiveSnapshot: async () => null,
}))
vi.mock('../src/services/visit-source-stats-service.js', () => ({
  getVisitSourceLiveSnapshot: async () => null,
}))
vi.mock('../src/services/visit-transition-stats-service.js', () => ({
  getVisitTransitionLiveSnapshot: async () => null,
}))
vi.mock('../src/services/relay-pool-stats-service.js', () => ({
  getRelayPoolLiveSnapshot: async () => null,
}))
vi.mock('../src/services/relay-account-pool-scheduler.js', () => ({
  keepaliveIdleDays: () => 7,
}))
vi.mock('../src/services/page-dwell-stats-service.js', () => ({
  getPageDwellLiveSnapshot: async () => ({ rows: [] }),
}))

import adminOpsWallboardRoutes from '../src/routes/admin-ops-wallboard.js'

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

/** 剥注释:修账注释允许引用旧写法说明历史,不参与判据。 */
const stripComments = (s: string): string =>
  s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

interface OverviewBody {
  code: number
  data: {
    business: {
      usersTotal: number
      ordersTodayAmountCents: number
      apiCallsToday: number
      llmCallsToday: number
      llmTokensToday: number
      llmCostCentsToday: number
      llmP95LatencyMs: number | null
      activeUsers7d: number | null
      signIn: { todayUsers: number; todayRewardPoints: number; maxStreakDays: number } | null
      topEndpoints: Array<{ calls: number }>
    } | null
    alerts: { firingTotal: number } | null
  }
}

function installRows(): void {
  h.rows = {
    users: [
      {
        total: '11',
        todayNew: '2',
        active: '9',
        vip: '1',
        trader: '1',
        invited: '3',
        invited7d: '1',
        level0: '8',
        level1: '1',
        level2: '1',
        level3: '1',
      },
    ],
    // 金额超 2^31:旧写法 `::bigint::int` 会在此抛 integer out of range
    ordersToday: [{ paid: '4', amountCents: '9000000000' }],
    ordersYesterday: [{ paid: '3' }],
    apiToday: [{ calls: '3000000000', errRate: 1.25, avgLatency: '45' }],
    topEndpoints: [{ path: '/api/x', method: 'GET', calls: '3000000000' }],
    // token 超 2^31:本票主症
    llmToday: [
      { calls: '900', tokens: '2500000000', costCents: '123', errRate: 2.5, p95Latency: '1200' },
    ],
    llmModels: [{ model: 'gpt-test', calls: '900' }],
    signToday: [{ users: '7', points: '35', maxStreak: '2' }],
    signWeek: [],
    userGrowth: [],
    activeUsers7d: [{ users: '8' }],
    alertsRecent: [],
    firingTotal: [{ n: '2' }],
    firingNames: [{ names: ['A'] }],
    events: [],
    trendHours: [{ hour: '09', calls: '4' }],
  }
}

async function injectOverview(): Promise<OverviewBody> {
  const app = Fastify()
  await app.register(adminOpsWallboardRoutes)
  const res = await app.inject({ method: 'GET', url: '/ops-wallboard/overview' })
  await app.close()
  expect(res.statusCode).toBe(200)
  return res.json() as OverviewBody
}

beforeAll(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline-in-test')
    }),
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  installRows()
})

describe('源码形状:聚合列不再收窄 int32', () => {
  const src = stripComments(read('../src/routes/admin-ops-wallboard.ts'))

  it('不再出现 ::bigint::int 双重收窄', () => {
    expect(src).not.toContain('::bigint::int')
  })

  it('不再出现任何 ::int 聚合收窄', () => {
    expect(src).not.toMatch(/::int\b/)
  })

  it('聚合列统一 ::bigint,且取值处 number 收口', () => {
    expect(src).toContain('::bigint')
    expect(src).toContain('Number(')
    expect(src).toMatch(/tokens:\s*sql<number>`coalesce\(sum\([\s\S]*?\)::bigint`/)
    expect(src).toMatch(/amountCents:\s*sql<number>`coalesce\(sum\([\s\S]*?\)::bigint`/)
  })
})

describe('归一行:超 2^31 的 int8/numeric 字符串 → number', () => {
  it('token/金额/调用数均落 number 且非 NaN', async () => {
    const body = await injectOverview()
    const biz = body.data.business
    expect(biz).not.toBeNull()
    if (!biz) return

    expect(typeof biz.llmTokensToday).toBe('number')
    expect(Number.isNaN(biz.llmTokensToday)).toBe(false)
    expect(biz.llmTokensToday).toBe(2_500_000_000)
    expect(biz.apiCallsToday).toBe(3_000_000_000)
    expect(biz.ordersTodayAmountCents).toBe(9_000_000_000)
    expect(biz.llmCostCentsToday).toBe(123)
    expect(biz.llmCallsToday).toBe(900)
    expect(biz.usersTotal).toBe(11)
    expect(biz.activeUsers7d).toBe(8)
    expect(biz.signIn?.todayUsers).toBe(7)
    expect(biz.signIn?.todayRewardPoints).toBe(35)
    expect(biz.signIn?.maxStreakDays).toBe(2)
    expect(biz.topEndpoints[0]?.calls).toBe(3_000_000_000)
    expect(body.data.alerts?.firingTotal).toBe(2)
  })
})

describe('空值兜底:null / 缺行 → 0(可空语义保持 null)', () => {
  it('聚合字段为 null 时落 0,可空延迟字段仍是 null', async () => {
    h.rows.llmToday = [
      { calls: null, tokens: null, costCents: null, errRate: null, p95Latency: null },
    ]
    h.rows.ordersToday = []
    h.rows.activeUsers7d = []

    const body = await injectOverview()
    const biz = body.data.business
    expect(biz).not.toBeNull()
    if (!biz) return

    expect(biz.llmCallsToday).toBe(0)
    expect(biz.llmTokensToday).toBe(0)
    expect(biz.llmCostCentsToday).toBe(0)
    expect(biz.ordersTodayAmountCents).toBe(0)
    expect(biz.activeUsers7d).toBeNull()
    expect(biz.llmP95LatencyMs).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
