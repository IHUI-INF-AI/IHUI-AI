// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-379 回归锁(2026-11-13)。
 *
 * 病灶:R002(高频退款)/R005(大额提现)读取的上下文字段
 * (recentRefundCount / recentRefundWindowSec / withdrawalAmountFen / avgWithdrawalFen)
 * 在登录入口从未赋值,规则按 `?? 0` 静默当作「未命中」⇒ 两条规则空转。
 *
 * 本文件锁三件事:
 *   ① 源锁:buildLoginRiskContext 必须把上述字段写进上下文(查得无记录也是显式 0);
 *   ② 行为锁:给定会触发 R002/R005 的上下文,真实引擎必须命中(REVIEW);
 *   ③ 未判定锁:字段缺失时规则返回 undetermined 并计数(不是 pass);
 *      DB 查询失败同样落进「未判定」,不得静默当 0 放行。
 *
 * Mock 策略:db 为按表名分流的无副作用桩,orders/withdrawal_flows 各自给夹具行;
 * ip-reputation 固定为低风险(不干扰 R002/R005 判据);其余重依赖仅做最小桩。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { dbState } = vi.hoisted(() => ({
  dbState: {
    refundRows: [{ c: 0 }] as Array<{ c: number }>,
    withdrawalRows: [] as Array<{ amount: number; status: number }>,
    failRefund: false,
    failWithdrawal: false,
  },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    isProductionGuard: false,
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://127.0.0.1:1/0',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: (e: unknown) => (e instanceof Error ? e.message : String(e ?? '')),
}))

vi.mock('@ihui/auth', () => ({
  verifyRefreshToken: vi.fn(),
  createFamilyId: vi.fn(() => 'fam-test'),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_SECONDS: 2592000,
}))

// F-379:登录入口的 IP 信誉固定为低风险,避免 R003 干扰 R002/R005 的判据
vi.mock('../src/services/ip-reputation.js', () => ({
  getIpReputationService: () => ({
    getIpReputation: async () => ({ score: 10, reasons: [], source: 'live' }),
  }),
  isPrivateIp: () => false,
}))

vi.mock('../src/db/index.js', () => {
  function makeChain() {
    let table = ''
    const chain: Record<string, unknown> = {}
    chain.from = (t: Record<symbol, unknown>) => {
      table = String(t?.[Symbol.for('drizzle:Name')] ?? '')
      return chain
    }
    chain.where = () => chain
    chain.orderBy = () => chain
    chain.limit = (n: number) => {
      if (table === 'withdrawal_flows') {
        if (dbState.failWithdrawal) return Promise.reject(new Error('db down'))
        return Promise.resolve(dbState.withdrawalRows.slice(0, n))
      }
      return Promise.resolve([])
    }
    // refund 查询以 `await select().from().where()` 收口
    chain.then = (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) => {
      if (table === 'orders') {
        if (dbState.failRefund) return Promise.reject(new Error('db down')).then(resolve, reject)
        return Promise.resolve(dbState.refundRows).then(resolve, reject)
      }
      return Promise.resolve([]).then(resolve, reject)
    }
    return chain
  }

  const chainStub = () => {
    const c: Record<string, unknown> = {}
    for (const m of ['values', 'set', 'returning', 'leftJoin', 'orderBy', 'limit', 'offset']) {
      c[m] = () => c
    }
    c.then = (resolve: (v: unknown[]) => unknown) => Promise.resolve([]).then(resolve)
    return c
  }

  return {
    db: {
      select: vi.fn(() => makeChain()),
      insert: vi.fn(() => chainStub()),
      update: vi.fn(() => chainStub()),
      delete: vi.fn(() => chainStub()),
      execute: vi.fn().mockResolvedValue([]),
    },
    dbRead: { select: vi.fn(() => makeChain()) },
    dbClient: {},
    poolLeakDetector: { track: vi.fn(), untrack: vi.fn() },
    stopPoolTracker: vi.fn(),
    registerPoolTrackerCleanup: vi.fn(),
  }
})

import { __test__ as authTest } from '../src/routes/auth.js'
import { RiskRuleEngine } from '../src/services/risk-engine-service.js'

const USER_ID = 'user-f379'

function fakeRequest() {
  return {
    ip: '203.0.113.9',
    headers: { 'user-agent': 'ua-f379', 'x-device-fingerprint': 'fp-f379' },
    // 无上一次登录 IP ⇒ loginRegionChanged 不成立,隔离 R001
    server: { redis: { get: async () => null } },
    log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }
}

beforeEach(() => {
  dbState.refundRows = [{ c: 0 }]
  dbState.withdrawalRows = []
  dbState.failRefund = false
  dbState.failWithdrawal = false
})

describe('F-379 登录入口补齐 R002/R005 上下文', () => {
  it('源锁 + 行为锁:上下文含所需字段,规则真的命中(REVIEW)', async () => {
    // 近 24h 退款 6 次;最近一笔提现 6 万元(分),历史已完成均值 1500 元(分)
    dbState.refundRows = [{ c: 6 }]
    dbState.withdrawalRows = [
      { amount: 6_000_000, status: 0 },
      { amount: 100_000, status: 2 },
      { amount: 200_000, status: 2 },
    ]

    const ctx = await authTest.buildLoginRiskContext(fakeRequest() as never, USER_ID)

    // 源锁:字段必须由入口写进上下文(而非留给规则按 0 兜底)
    expect(ctx.recentRefundCount).toBe(6)
    expect(ctx.recentRefundWindowSec).toBe(24 * 60 * 60)
    expect(ctx.withdrawalAmountFen).toBe(6_000_000)
    expect(ctx.avgWithdrawalFen).toBe(150_000)

    // 行为锁:同样的上下文交给真实引擎,R002/R005 必须命中
    const risk = new RiskRuleEngine().evaluateRisk(ctx)
    const hitIds = risk.hits.map((h) => h.ruleId)
    expect(hitIds).toContain('R002_HIGH_FREQ_REFUND')
    expect(hitIds).toContain('R005_LARGE_WITHDRAWAL')
    expect(risk.action).toBe('REVIEW')
    expect(risk.undeterminedCount).toBe(0)
  })

  it('查询成功但无记录 ⇒ 显式 0(可判定,不是未判定)', async () => {
    dbState.refundRows = [{ c: 0 }]
    dbState.withdrawalRows = []

    const ctx = await authTest.buildLoginRiskContext(fakeRequest() as never, USER_ID)

    expect(ctx.recentRefundCount).toBe(0)
    expect(ctx.recentRefundWindowSec).toBe(24 * 60 * 60)
    expect(ctx.withdrawalAmountFen).toBe(0)
    expect(ctx.avgWithdrawalFen).toBe(0)

    const risk = new RiskRuleEngine().evaluateRisk(ctx)
    expect(risk.undeterminedCount).toBe(0)
    expect(risk.hits.some((h) => h.ruleId === 'R002_HIGH_FREQ_REFUND')).toBe(false)
    expect(risk.hits.some((h) => h.ruleId === 'R005_LARGE_WITHDRAWAL')).toBe(false)
  })

  it('未判定锁:字段缺失 ⇒ 返回 undetermined 并计数,不当作通过', () => {
    const risk = new RiskRuleEngine().evaluateRisk({ userId: USER_ID, ip: '203.0.113.9' })

    const r002 = risk.undetermined.find((u) => u.ruleId === 'R002_HIGH_FREQ_REFUND')
    const r005 = risk.undetermined.find((u) => u.ruleId === 'R005_LARGE_WITHDRAWAL')
    expect(r002).toBeDefined()
    expect(r005).toBeDefined()
    expect([...r002!.missingFields].sort()).toEqual([
      'recentRefundCount',
      'recentRefundWindowSec',
    ])
    expect(r005!.missingFields).toEqual(['withdrawalAmountFen'])
    expect(risk.undeterminedCount).toBeGreaterThanOrEqual(2)
    // 未判定 ≠ 命中,也 ≠ 通过:两条规则都不出现在 hits 里
    expect(risk.hits.some((h) => h.ruleId === 'R002_HIGH_FREQ_REFUND')).toBe(false)
    expect(risk.hits.some((h) => h.ruleId === 'R005_LARGE_WITHDRAWAL')).toBe(false)
  })

  it('DB 查询失败 ⇒ 入口不注入字段,规则记未判定并留痕', async () => {
    dbState.failRefund = true
    dbState.failWithdrawal = true
    const request = fakeRequest()

    const ctx = await authTest.buildLoginRiskContext(request as never, USER_ID)

    expect(ctx.recentRefundCount).toBeUndefined()
    expect(ctx.recentRefundWindowSec).toBeUndefined()
    expect(ctx.withdrawalAmountFen).toBeUndefined()
    expect(ctx.avgWithdrawalFen).toBeUndefined()
    // 入口必须留痕(不能静默)
    expect(request.log.warn).toHaveBeenCalled()

    const risk = new RiskRuleEngine().evaluateRisk(ctx)
    expect(risk.undeterminedCount).toBe(2)
    expect(risk.undetermined.map((u) => u.ruleId).sort()).toEqual([
      'R002_HIGH_FREQ_REFUND',
      'R005_LARGE_WITHDRAWAL',
    ])
  })
})
