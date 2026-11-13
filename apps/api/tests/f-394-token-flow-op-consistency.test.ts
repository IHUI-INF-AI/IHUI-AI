// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-394 回归锁(2026-11-13,缺陷票 docs/tickets/2026-11/findings-api.md#F-394)。
 *
 * 病灶:token_flows 的 op_type / quantity 符号 / balance_after 含义在写入侧与统计侧各自硬编码,
 * 后台资金列表、开发者收入看板、relay 钱包充值三处口径互不一致 ⇒ 汇总与明细对不上。
 *
 * 口径(TOKEN_FLOW_OP 单一来源,定义在 services/relay-billing-service.ts):
 *   - quantity 的绝对值是本笔变动数量,方向由 opType 表达(1/2/3 流出,0/4 入账;
 *     opType=5 管理员调整保留正负号;opType=6 是配额计数,不是钱);
 *   - balance_after 恒为「这笔落账之后」的钱包余额;
 *   - 统计按绝对值聚合,提现等负号流水不得把消耗合计抵小。
 *
 * 本文件锁:
 *   ① 内存桩流水表写入/消费/退款各一笔后,按 opType 聚合 == 统计函数 summarizeTokenFlows;
 *   ② 同一 opType 正负号混存(即时扣费正号 + 提现负号)时,合计仍等于绝对值之和;
 *   ③ 源锁:三个读写点不得再出现 opType 魔法数字;relay 钱包充值必须记成消费流出,
 *      后台消耗累计必须按绝对值聚合。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

vi.mock('../src/config/index.js', () => ({
  isDevelopmentRuntime: false,
  isProductionRuntime: false,
  isTestRuntime: true,
  config: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), execute: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

// relay-billing-service 的重依赖(本文件只用其中的口径常量与纯函数)
vi.mock('../src/services/api-key-group-service.js', () => ({
  getKeyGroup: vi.fn(async () => null),
}))
vi.mock('../src/services/relay-commission-service.js', () => ({
  recordRelayCommission: vi.fn(async () => undefined),
}))
vi.mock('../src/services/webhook-relay-notifier.js', () => ({
  notifyRelayEvent: vi.fn(async () => undefined),
}))
vi.mock('../src/services/tiered-pricing-service.js', () => ({
  getCurrentTierMultiplier: vi.fn(async () => ({ multiplier: 1 })),
}))
vi.mock('../src/services/peak-pricing-service.js', () => ({
  resolvePeakMultiplier: vi.fn(async () => ({ multiplier: 1, ruleId: null, ruleName: null })),
}))
vi.mock('../src/services/subscription-window-service.js', () => ({
  checkSubscriptionWindowQuota: vi.fn(async () => ({ allowed: true })),
  consumeSubscriptionWindowUsage: vi.fn(async () => false),
}))
vi.mock('../src/services/key-rate-window-service.js', () => ({
  checkKeyRateWindows: vi.fn(async () => ({ allowed: true })),
  incrKeyRateWindows: vi.fn(async () => undefined),
}))
vi.mock('../src/services/mail-relay-notifier.js', () => ({
  checkAndNotifyLowBalance: vi.fn(async () => false),
  sendLowBalanceMail: vi.fn(async () => false),
}))
vi.mock('../src/services/user-billing-group-service.js', () => ({
  getUserModelMultiplier: vi.fn(async () => 1),
}))
vi.mock('../src/services/api-key-share-service.js', () => ({
  incrementUsage: vi.fn(async () => undefined),
}))

import {
  TOKEN_FLOW_OP,
  tokenFlowDelta,
  summarizeTokenFlows,
} from '../src/services/relay-billing-service.js'

interface LedgerRow {
  opType: number
  quantity: number
  balanceAfter: number
}

/**
 * 内存桩流水表:与生产写入口径一致 —— 数量取绝对值,方向由 opType 表达,
 * balanceAfter 记「本笔落账之后」的钱包余额。
 */
function createStubLedger(startBalance: number) {
  const rows: LedgerRow[] = []
  let balance = startBalance
  return {
    rows,
    get balance() {
      return balance
    },
    write(opType: number, amount: number) {
      balance += tokenFlowDelta(opType, amount)
      rows.push({ opType, quantity: amount, balanceAfter: balance })
    },
  }
}

/** 与后台 SQL 等价的按 opType 聚合(绝对值口径)。 */
function groupByOpType(rows: readonly LedgerRow[]): Map<number, number> {
  const grouped = new Map<number, number>()
  for (const row of rows) {
    grouped.set(row.opType, (grouped.get(row.opType) ?? 0) + Math.abs(row.quantity))
  }
  return grouped
}

describe('F-394 token_flows 口径单一来源', () => {
  it('TOKEN_FLOW_OP 的数值与既有表约定一致(0..6)', () => {
    expect(TOKEN_FLOW_OP).toEqual({
      RECHARGE: 0,
      CONSUME: 1,
      EXPIRE: 2,
      REFUND: 3,
      COMMISSION: 4,
      ADMIN_ADJUST: 5,
      API_QUOTA: 6,
    })
  })

  it('符号约定:0/4 入账为正,1/2/3 流出为负,5 保留原始符号,6 不计钱', () => {
    expect(tokenFlowDelta(TOKEN_FLOW_OP.RECHARGE, 1000)).toBe(1000)
    expect(tokenFlowDelta(TOKEN_FLOW_OP.COMMISSION, 80)).toBe(80)
    expect(tokenFlowDelta(TOKEN_FLOW_OP.CONSUME, 300)).toBe(-300)
    expect(tokenFlowDelta(TOKEN_FLOW_OP.CONSUME, -300)).toBe(-300)
    expect(tokenFlowDelta(TOKEN_FLOW_OP.EXPIRE, 50)).toBe(-50)
    expect(tokenFlowDelta(TOKEN_FLOW_OP.REFUND, 50)).toBe(-50)
    expect(tokenFlowDelta(TOKEN_FLOW_OP.ADMIN_ADJUST, -20)).toBe(-20)
    expect(tokenFlowDelta(TOKEN_FLOW_OP.API_QUOTA, 999)).toBe(0)
  })
})

describe('F-394 写入/消费/退款各一笔后,聚合与统计函数严格相等', () => {
  it('按 opType 聚合的合计 == summarizeTokenFlows,且 balanceAfter 与净变化自洽', () => {
    const ledger = createStubLedger(0)
    ledger.write(TOKEN_FLOW_OP.RECHARGE, 1000) // 充值入账
    ledger.write(TOKEN_FLOW_OP.CONSUME, 300) // 消费扣减
    ledger.write(TOKEN_FLOW_OP.REFUND, 100) // 退款扣回

    expect(ledger.rows.map((r) => r.balanceAfter)).toEqual([1000, 700, 600])

    const grouped = groupByOpType(ledger.rows)
    const summary = summarizeTokenFlows(ledger.rows)

    expect(summary).toEqual({
      totalRecharge: grouped.get(TOKEN_FLOW_OP.RECHARGE),
      totalConsume: grouped.get(TOKEN_FLOW_OP.CONSUME),
      totalRefund: grouped.get(TOKEN_FLOW_OP.REFUND),
      totalCommission: 0,
      totalAdminAdjust: 0,
      netChange: 600,
    })
    // balanceAfter 是落账后的余额,最后一笔必须等于起始余额 + 净变化
    expect(ledger.balance).toBe(0 + summary.netChange)
    expect(ledger.rows.at(-1)?.balanceAfter).toBe(summary.netChange)
  })

  it('消费类流水正负号混存时,消耗合计仍等于绝对值之和(不被提现负号抵小)', () => {
    const ledger = createStubLedger(0)
    ledger.write(TOKEN_FLOW_OP.RECHARGE, 1000)
    ledger.write(TOKEN_FLOW_OP.CONSUME, 300) // 即时扣费(正号)
    ledger.write(TOKEN_FLOW_OP.CONSUME, -200) // 提现申请(负号)

    const summary = summarizeTokenFlows(ledger.rows)
    expect(summary.totalConsume).toBe(500)
    expect(summary.netChange).toBe(500)
    expect(ledger.rows.at(-1)?.balanceAfter).toBe(500)
  })

  it('管理员调整保留正负号,不进充值/消耗合计', () => {
    const summary = summarizeTokenFlows([
      { opType: TOKEN_FLOW_OP.RECHARGE, quantity: 100 },
      { opType: TOKEN_FLOW_OP.ADMIN_ADJUST, quantity: -40 },
      { opType: TOKEN_FLOW_OP.API_QUOTA, quantity: 5000 },
    ])
    expect(summary.totalRecharge).toBe(100)
    expect(summary.totalConsume).toBe(0)
    expect(summary.totalAdminAdjust).toBe(-40)
    expect(summary.netChange).toBe(60) // 100 - 40,配额计数不计钱
  })
})

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const read = (rel: string): string => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

describe('F-394 源锁:读写点必须走 TOKEN_FLOW_OP,relay 充值记作消费流出', () => {
  it('relay 钱包充值:opType=CONSUME、数量记负号(不再冒充佣金 opType=4)', () => {
    const src = stripComments(read('src/services/relay-billing-service.ts'))
    expect(src).toContain('opType: TOKEN_FLOW_OP.CONSUME')
    expect(src).toContain('quantity: -totalTokensNeeded')
    expect(src).not.toMatch(/opType:\s*\d+/)
  })

  it('developer.ts:收入/提现读写不再出现 opType 魔法数字', () => {
    const src = stripComments(read('src/routes/developer.ts'))
    expect(src).toContain('TOKEN_FLOW_OP.COMMISSION')
    expect(src).toContain('TOKEN_FLOW_OP.CONSUME')
    expect(src).not.toMatch(/eq\(tokenFlows\.opType,\s*\d+/)
    expect(src).not.toMatch(/opType:\s*\d+/)
  })

  it('admin-shop-routes.ts:资金列表用枚举 + 绝对值聚合,负号流水不抵小消耗', () => {
    const src = stripComments(read('src/routes/admin-shop-routes.ts'))
    const lines = src.split('\n')
    const rechargeLine = lines.find((l) => l.includes('totalRecharge: sql<number>')) ?? ''
    const consumeLine = lines.find((l) => l.includes('totalConsume: sql<number>')) ?? ''
    expect(rechargeLine).toContain('TOKEN_FLOW_OP.RECHARGE')
    expect(consumeLine).toContain('TOKEN_FLOW_OP.CONSUME')
    expect(rechargeLine).toContain('abs(')
    expect(consumeLine).toContain('abs(')
    expect(src).not.toMatch(/tokenFlows\.opType\}\s*=\s*\d+/)
    expect(src).not.toMatch(/inArray\(tokenFlows\.opType,\s*\[\s*\d/)
  })
})
