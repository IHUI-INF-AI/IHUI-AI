// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-234 回归锁(2026-11-13)。
 *
 * 病灶:每日 `commission-settle-daily` → `calibrateCommissionSettlement()` 的兜底查询是
 * `WHERE status='paid' AND NOT EXISTS(该订单的佣金流水) LIMIT 100` —— 无 ORDER BY、无时间下界。
 * 大多数订单本来就不会产生佣金流水(下单人无推荐人,`getParentUsers()` 返回 [])，
 * 这些「永不返佣」的行永远满足 NOT EXISTS,按任意物理顺序反复命中,
 * LIMIT 100 窗口被永久占满,真实漏单进不了窗口,兜底机制静默失效(missedOrders 恒为 100 噪音)。
 *
 * 本文件锁:
 *   ① 候选查询带确定性排序 (created_at ASC, id ASC) + created_at 时间下界(LIMIT 在排序之后);
 *   ② INNER JOIN users 且 `users.parent_id IS NOT NULL` —— 父级为空的订单不进候选;
 *   ③ 窗口内候选按 created_at 升序返回、按该顺序处理,单批仍限 100;
 *   ④ 支付回调实时链路(feedbackInvite → createCommissionFlows)行为不变,照常建流水。
 *
 * 只 mock db / commission-queries,不触达真实 PG、Redis。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { IdentityProportion } from '@ihui/database'

const {
  mockSelect,
  mockTransaction,
  mockGetBalance,
  mockGetParentUsers,
  mockGetActiveProportion,
  mockCreateCommissionFlow,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetBalance: vi.fn(),
  mockGetParentUsers: vi.fn(),
  mockGetActiveProportion: vi.fn(),
  mockCreateCommissionFlow: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockSelect,
    transaction: mockTransaction,
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}))

vi.mock('../src/db/commission-queries.js', () => ({
  getBalance: mockGetBalance,
  getParentUsers: mockGetParentUsers,
  getActiveProportion: mockGetActiveProportion,
  createCommissionFlow: mockCreateCommissionFlow,
}))

import { calibrateCommissionSettlement } from '../src/services/commission-settle-service.js'
import { feedbackInvite } from '../src/services/commission-service.js'

const dialect = new PgDialect()

/** drizzle SQL 对象 → { sql, params }(断言查询条件的唯一口径)。 */
function toQuery(value: unknown) {
  return dialect.sqlToQuery(value as Parameters<PgDialect['sqlToQuery']>[0])
}

interface CandidateRow {
  id: string
  userId: string | null
  amount: number
  orderType: number
  productId: string | null
}

function makeCandidate(overrides: Partial<CandidateRow> = {}): CandidateRow {
  return { id: 'o1', userId: 'u1', amount: 10000, orderType: 1, productId: null, ...overrides }
}

/** 配置 select→from→innerJoin→where→orderBy→limit 链(candidates 即"数据库返回的候选行")。 */
function mockCandidateQuery(rows: CandidateRow[]) {
  const limit = vi.fn().mockResolvedValue(rows)
  const orderBy = vi.fn().mockReturnValue({ limit })
  const where = vi.fn().mockReturnValue({ orderBy })
  const innerJoin = vi.fn().mockReturnValue({ where })
  const from = vi.fn().mockReturnValue({ innerJoin })
  mockSelect.mockReturnValue({ from })
  return { from, innerJoin, where, orderBy, limit }
}

/** 配置事务内的 tx.select 链:按调用次序依次返回 rowSets 中的结果。 */
function mockTxQuery(rowSets: unknown[][]) {
  let call = 0
  const limit = vi.fn(async () => rowSets[call++] ?? [])
  const forUpdate = vi.fn(() => ({ limit }))
  const where = vi.fn(() => ({ for: forUpdate, limit }))
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({ select }),
  )
  return { select, from, where, limit, forUpdate }
}

const proportion: IdentityProportion = {
  id: 'p1',
  beginTime: null,
  endTime: null,
  status: 1,
  gift: 0,
  tokenProportion: 10,
  vipGift: 0,
  routineProportion: 5,
  vipProportion: 8,
  traderProportion: 10,
  traderGift: 0,
  traderRoutineProportion: 12,
  traderVipProportion: 15,
  traderTraderProportion: 20,
  grandRoutineProportion: 2,
  grandVipProportion: 3,
  grandTraderProportion: 4,
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
  updatedAt: new Date('2026-11-01T00:00:00.000Z'),
}

describe('F-234 佣金兜底校准窗口', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('① 候选查询含确定性排序与 created_at 时间下界,LIMIT 在排序之后', async () => {
    const chain = mockCandidateQuery([])

    const result = await calibrateCommissionSettlement()
    expect(result).toEqual({ scanned: 0, missedOrders: 0, createdFlows: 0, errors: [] })

    // ORDER BY created_at ASC, id ASC(确定性:同一时刻的行也不会乱序翻页)
    expect(chain.orderBy).toHaveBeenCalledTimes(1)
    const orderArgs = chain.orderBy.mock.calls[0]!
    expect(orderArgs).toHaveLength(2)
    expect(toQuery(orderArgs[0]).sql).toMatch(/"orders"\."created_at"\s+asc/i)
    expect(toQuery(orderArgs[1]).sql).toMatch(/"orders"\."id"\s+asc/i)

    // WHERE 含 created_at 时间下界(近 N 天),不再无界扫描历史
    const where = toQuery(chain.where.mock.calls[0]![0])
    expect(where.sql).toContain('"orders"."created_at" >=')
    // timestamp 列经 drizzle 编码后参数可能是 Date 或 ISO 字符串,两种都接受
    const windowParam = where.params.find(
      (p) => p instanceof Date || (typeof p === 'string' && !Number.isNaN(Date.parse(p))),
    )
    expect(windowParam).toBeDefined()
    const windowStart = windowParam instanceof Date ? windowParam : new Date(String(windowParam))
    const ageDays = (Date.now() - windowStart.getTime()) / 86_400_000
    expect(ageDays).toBeGreaterThan(0)
    expect(ageDays).toBeLessThanOrEqual(400)

    // 先排序后截断:limit 挂在 orderBy 的返回值上,单批仍为 100
    expect(chain.limit).toHaveBeenCalledTimes(1)
    expect(chain.limit).toHaveBeenCalledWith(100)
  })

  it('② 父级为空的订单不进入候选(INNER JOIN users + parent_id IS NOT NULL)', async () => {
    const chain = mockCandidateQuery([])

    await calibrateCommissionSettlement()

    // JOIN 条件:users.id = orders.user_id
    expect(chain.innerJoin).toHaveBeenCalledTimes(1)
    expect(toQuery(chain.innerJoin.mock.calls[0]![1]).sql).toBe('"users"."id" = "orders"."user_id"')

    const where = toQuery(chain.where.mock.calls[0]![0])
    expect(where.sql).toContain('"users"."parent_id" is not null')
    expect(where.sql).toContain('"orders"."status" =')
    expect(where.sql).toMatch(/not exists/i)
    expect(where.params).toContain('paid')

    // 无上级订单被 SQL 过滤掉 ⇒ 0 候选,不会逐单取余额/尝试返佣
    expect(mockGetBalance).not.toHaveBeenCalled()
    expect(mockGetActiveProportion).not.toHaveBeenCalled()
  })

  it('③ 窗口内候选按 created_at 升序处理,单批最多 100 条', async () => {
    // created_at 升序即为:o1 < o2 < o3
    const chain = mockCandidateQuery([
      makeCandidate({ id: 'o1', userId: 'u1' }),
      makeCandidate({ id: 'o2', userId: 'u2' }),
      makeCandidate({ id: 'o3', userId: 'u3' }),
    ])
    mockGetBalance.mockResolvedValue(0)
    mockGetActiveProportion.mockResolvedValue(null) // 无生效比例 → 不产生流水(不影响扫描顺序)

    const result = await calibrateCommissionSettlement()

    expect(result.scanned).toBe(3)
    expect(result.createdFlows).toBe(0)
    expect(chain.limit).toHaveBeenCalledWith(100)
    // 处理顺序 = 查询返回顺序 = created_at 升序
    expect(mockGetBalance.mock.calls.map((c) => c[0])).toEqual(['u1', 'u2', 'u3'])
  })

  it('④ 正常结算路径(feedbackInvite)行为不变,照常按父级身份建流水(F-404:基数取本单充值增量)', async () => {
    mockGetActiveProportion.mockResolvedValue(proportion)
    mockGetParentUsers.mockResolvedValue([{ userId: 'p1', isVip: 0, level: 1 }])
    // F-404 后事务内 3 次查询:①锁订单(带 orderNo) ②按 orderNo 查本单充值增量 ③幂等查既有流水
    // 本单充值流水 total=200 → baseTokens=200 → token = floor(200*10/100) = 20(不再取钱包总余额)
    mockTxQuery([[{ id: 'o1', orderNo: 'NO-234' }], [{ total: 200 }], []])
    mockCreateCommissionFlow.mockResolvedValue({ id: 'cf1' })

    const created = await feedbackInvite(
      { id: 'u1', tokenQuantity: 200 },
      { id: 'o1', amount: 10000, orderType: 1, productId: null },
    )

    // 普通父级:token = floor(baseTokens(200) * 10 / 100) = 20,type=0(基数为本单充值增量)
    expect(created).toBe(1)
    expect(mockCreateCommissionFlow).toHaveBeenCalledTimes(1)
    expect(mockCreateCommissionFlow.mock.calls[0]![0]).toMatchObject({
      beneficiaryId: 'p1',
      invitedUserId: 'u1',
      orderId: 'o1',
      amount: 0,
      token: 20,
      type: 0,
    })
  })
})
