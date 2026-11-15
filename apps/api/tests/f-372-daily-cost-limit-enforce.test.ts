// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-372 回归锁(2026-11-13)。
 *
 * 病灶:aiBudgets.dailyCostLimit 只参与预算告警判定,ai-cost 的计费前置检查
 * (checkBudget)只校验 dailyTokenLimit,配了日成本上限仍照常放行,成本熔断缺失。
 *
 * 本文件锁:
 *   ① 当日累计成本 >= 限额 ⇒ 拒绝(非放行),并留 warn(含 userId/limit/used);
 *   ② 低于限额 ⇒ 放行;
 *   ③ 未配置限额(getUserDailyCostLimit 返回 null)⇒ 放行,行为不变;
 *   ④ 限额读取抛错 ⇒ 放行 + warn(存储抖动不得封死全部调用)。
 *
 * Mock 策略:ai-cost 的重依赖(pricing / business-metrics / config / logger)全部 mock;
 * budget-alert-service 只暴露 getUserDailyCostLimit,用于驱动阈值并验证「同源读取」;
 * db 为最小内存假库,按 select 列区分 aiBudgets 行 / 今日 token 聚合 / 今日成本聚合。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockStore, getDailyCostLimitMock, loggerWarnMock } = vi.hoisted(() => ({
  mockStore: {
    /** aiBudgets 单行桩(null = 无预算记录) */
    budget: null as unknown,
    /** 今日 token 用量桩 */
    usedTokens: 0,
    /** 今日成本聚合桩(numeric 以字符串返回,与 drizzle 一致) */
    usedCost: '0',
  },
  getDailyCostLimitMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: { ORG_POLICIES_ENABLED: false, PRICING_RULES_ENABLED: false },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: loggerWarnMock, error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/services/budget-alert-service.js', () => ({
  getUserDailyCostLimit: getDailyCostLimitMock,
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => {}),
}))
vi.mock('../src/services/pricing-service.js', () => ({
  calculateCost: vi.fn(async () => ({ totalCost: 0, currency: 'CNY' })),
}))
vi.mock('../src/services/pricing-engine.js', () => ({
  resolvePrice: vi.fn(async () => null),
}))
vi.mock('../src/plugins/business-metrics.js', () => ({
  recordAiCallSample: vi.fn(),
  recordAiCostWriteFailure: vi.fn(),
}))

/** 给 Promise 挂 .limit,兼容 select().where().limit() 与直接 await where() 两种收口 */
function makeRows(rows: unknown[]) {
  const p = Promise.resolve(rows) as Promise<unknown[]> & {
    limit: (n: number) => Promise<unknown[]>
  }
  p.limit = (n: number) => Promise.resolve(rows.slice(0, n))
  return p
}

/** 把 drizzle SQL 表达式渲染为文本(同 org-g6 的官方渲染路径) */
function renderSql(v: unknown): string {
  const q = v as { toQuery?: (cfg: unknown) => { sql: string } }
  if (q && typeof q.toQuery === 'function') {
    try {
      return q.toQuery({
        escapeName: (n: string) => `"${n}"`,
        escapeParam: (i: number) => `$${i + 1}`,
        casing: {
          getColumnCasing: (c: { name?: string }) => c?.name ?? '',
          cache: () => undefined,
          convert: (c: string) => c,
        },
      }).sql
    } catch {
      /* 渲染失败落到 String 兜底 */
    }
  }
  return String(v)
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: (cols?: Record<string, unknown>) => ({
      from: () => ({
        where: () => {
          // 无列投影 / 非 total 投影 = checkBudget 的个人预算行查询
          if (!cols || !('total' in cols)) {
            return makeRows(mockStore.budget ? [mockStore.budget] : [])
          }
          const text = renderSql(cols.total)
          if (text.includes('total_tokens')) return makeRows([{ total: mockStore.usedTokens }])
          if (text.includes('"cost"')) return makeRows([{ total: mockStore.usedCost }])
          return makeRows([])
        },
      }),
    }),
  },
  dbRead: {
    select: () => ({
      from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [] }) }) }),
    }),
  },
  dbClient: {},
}))

import { checkBudget } from '../src/plugins/ai-cost.js'

const USER_ID = 'u1'

function warnTexts(): string[] {
  return loggerWarnMock.mock.calls.map((c) => String(c[0]))
}

describe('F-372 日成本上限必须在计费前置检查中熔断', () => {
  beforeEach(() => {
    mockStore.budget = {
      id: 'b1',
      scope: 'user',
      scopeKey: USER_ID,
      model: null,
      dailyTokenLimit: 1000,
    }
    mockStore.usedTokens = 10
    mockStore.usedCost = '0'
    getDailyCostLimitMock.mockReset()
    loggerWarnMock.mockReset()
  })

  it('① 当日累计成本 >= 限额 ⇒ 拒绝(非放行),并留 warn 含 userId/limit/used', async () => {
    getDailyCostLimitMock.mockResolvedValue(5)
    mockStore.usedCost = '5'

    const result = await checkBudget('user', USER_ID)

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('日成本预算已用尽')
    expect(getDailyCostLimitMock).toHaveBeenCalledWith(USER_ID)
    expect(
      warnTexts().some(
        (t) => t.includes(`userId=${USER_ID}`) && t.includes('limit=5') && t.includes('used=5'),
      ),
    ).toBe(true)
  })

  it('② 当日累计成本低于限额 ⇒ 放行', async () => {
    getDailyCostLimitMock.mockResolvedValue(5)
    mockStore.usedCost = '4.99'

    expect((await checkBudget('user', USER_ID)).allowed).toBe(true)
  })

  it('③ 未配置日成本限额(null)⇒ 放行,行为不变', async () => {
    getDailyCostLimitMock.mockResolvedValue(null)
    mockStore.usedCost = '999999'

    expect((await checkBudget('user', USER_ID)).allowed).toBe(true)
  })

  it('④ 限额读取抛错 ⇒ 按不拦截放行 + warn(存储抖动不封死调用)', async () => {
    getDailyCostLimitMock.mockRejectedValue(new Error('pg down'))
    mockStore.usedCost = '999999'

    const result = await checkBudget('user', USER_ID)

    expect(result.allowed).toBe(true)
    expect(
      warnTexts().some(
        (t) =>
          t.includes('按不拦截放行') && t.includes(`userId=${USER_ID}`) && t.includes('pg down'),
      ),
    ).toBe(true)
  })

  it('⑤ 既有日 token 上限语义不受影响(优先级高于成本检查)', async () => {
    getDailyCostLimitMock.mockResolvedValue(5)
    mockStore.usedTokens = 1000
    mockStore.usedCost = '0'

    const result = await checkBudget('user', USER_ID)

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('日 token 预算已用尽')
  })
})
