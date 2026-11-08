// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-228 夹具:未支付订单不得生成结算;跨月结算按天摊分且逐期幂等。

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    inserts: [] as Array<Record<string, unknown>>,
    /** 模拟 agent_settlements 表(唯一键 = order_no + period)。 */
    rows: [] as Array<Record<string, unknown>>,
    /** 记录每次 onConflictDoNothing 的冲突目标,证明幂等走主库条件插入而不是从库预读。 */
    conflictTargets: [] as unknown[],
    /** 模拟从库延迟:副本永远读不到刚写入的结算行。 */
    replicaReads: 0,
  },
}))

vi.mock('../src/db/index.js', () => {
  const dbRead = {
    select: () => {
      const c: Record<string, unknown> = {}
      for (const m of ['from', 'where']) c[m] = () => c
      const take = () => {
        state.replicaReads++
        return Promise.resolve([])
      }
      c.limit = take
      c.then = (resolve: (v: unknown) => unknown) => take().then(resolve)
      return c
    },
  }
  const db = {
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        state.inserts.push(values)
        let conflictHandled = false
        const keyOf = (v: Record<string, unknown>): string =>
          `${String(v.orderNo)}|${String(v.period)}`
        const c: Record<string, unknown> = {
          onConflictDoNothing: (opts?: unknown) => {
            conflictHandled = true
            state.conflictTargets.push(opts)
            return c
          },
          returning: () => {
            // 只有接入 ON CONFLICT 的唯一键插入才幂等;旧实现没有约束,重复调用会落重复行。
            if (conflictHandled && state.rows.some((r) => keyOf(r) === keyOf(values))) {
              return Promise.resolve([])
            }
            const row = { id: `s-${state.rows.length + 1}`, ...values }
            state.rows.push(row)
            return Promise.resolve([row])
          },
        }
        return c
      },
    }),
  }
  return { db, dbRead }
})

import {
  createSettlementRecordsForRange,
  syncAgentBuyToSettlement,
} from '../src/services/settlement-service.js'

const AGENT_ID = '11111111-1111-4111-8111-111111111111'
const BUY_ID = '22222222-2222-4222-8222-222222222222'

describe('F-228 智能体结算同步', () => {
  beforeEach(() => {
    state.inserts.length = 0
    state.rows.length = 0
    state.conflictTargets.length = 0
    state.replicaReads = 0
  })

  it('未支付(pending)订单不得生成结算记录', async () => {
    const ok = await syncAgentBuyToSettlement({
      id: BUY_ID,
      agentId: AGENT_ID,
      price: '99.00',
      createdAt: new Date(2026, 0, 1),
      expiresAt: new Date(2026, 0, 31),
      status: 'pending',
    })

    expect(ok).toBe(false)
    expect(state.inserts).toHaveLength(0)
    // 变异自证:删掉 status !== 'active' 守卫后,这里会插入一期结算而翻红。
  })

  it('active 订单跨月生成多期,orderNo 逐期加 #issueNo、period 逐期落库且金额合计等于总额', async () => {
    const ok = await syncAgentBuyToSettlement({
      id: BUY_ID,
      agentId: AGENT_ID,
      price: '99.00',
      createdAt: new Date(2026, 0, 15),
      expiresAt: new Date(2026, 2, 15),
      status: 'active',
    })

    expect(ok).toBe(true)
    expect(state.inserts.map((r) => r.orderNo)).toEqual([
      `${BUY_ID}#1`,
      `${BUY_ID}#2`,
      `${BUY_ID}#3`,
    ])
    const amounts = state.inserts.map((r) => r.amount as number)
    expect(amounts).toHaveLength(3)
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(9900)
    expect(amounts[0]).not.toBe(9900)
    // 每期必须落真实账期(YYYY-MM),否则 (order_no, period) 唯一约束退化成只看 order_no。
    expect(state.inserts.map((r) => r.period)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(state.conflictTargets).toHaveLength(3)
    // 幂等不得依赖从库读:整条链路一次 dbRead 都不该发生。
    expect(state.replicaReads).toBe(0)
    // 变异自证:恢复"每期都写全额"后,amounts 为 [9900, 9900, 9900],本断言翻红。
  })

  it('同一订单 13 次结算请求只落 1 条/期(主库条件插入,从库延迟不影响)', async () => {
    const input = {
      id: BUY_ID,
      agentId: AGENT_ID,
      price: '99.00',
      createdAt: new Date(2026, 0, 15),
      expiresAt: new Date(2027, 0, 15),
      status: 'active',
    }

    for (let i = 0; i < 13; i++) {
      await syncAgentBuyToSettlement(input)
    }

    // 13 个月 × 13 次重复回调 = 169 次插入尝试,唯一约束只放行 13 行。
    expect(state.rows).toHaveLength(13)
    expect(new Set(state.rows.map((r) => `${String(r.orderNo)}|${String(r.period)}`)).size).toBe(13)
    expect(new Set(state.rows.map((r) => String(r.period))).size).toBe(13)
    expect(state.conflictTargets).toHaveLength(169)
    expect(state.replicaReads).toBe(0)
    // 变异自证:退回 dbRead 预读做幂等(副本恒空)后,state.rows 会变成 169 行,本断言翻红。
  })

  it('createSettlementRecordsForRange 按各期天数占比摊分,余数归最后一期', async () => {
    await createSettlementRecordsForRange(AGENT_ID, new Date(2026, 0, 1), new Date(2026, 2, 1), {
      buyRecordId: BUY_ID,
      orderNo: 'ORD-1',
      amount: 10000,
      status: 'unsettled',
    })

    const periods = [
      { ms: new Date(2026, 1, 1).getTime() - new Date(2026, 0, 1).getTime() },
      { ms: new Date(2026, 2, 1).getTime() - new Date(2026, 1, 1).getTime() },
    ]
    const totalMs = periods.reduce((sum, p) => sum + p.ms, 0)
    const expectedFirst = Math.floor((10000 * periods[0]!.ms) / totalMs)

    expect(state.inserts).toHaveLength(2)
    expect(state.inserts[0]?.amount).toBe(expectedFirst)
    expect(state.inserts[1]?.amount).toBe(10000 - expectedFirst)
    expect(state.inserts.map((r) => r.orderNo)).toEqual(['ORD-1#1', 'ORD-1#2'])
  })

  it('超长 orderNo 截断后加 #issueNo 仍不超过列宽 100', async () => {
    await createSettlementRecordsForRange(AGENT_ID, new Date(2026, 0, 1), new Date(2026, 1, 1), {
      orderNo: 'X'.repeat(120),
      amount: 100,
    })

    const orderNo = String(state.inserts[0]?.orderNo)
    expect(orderNo).toBe(`${'X'.repeat(90)}#1`)
    expect(orderNo.length).toBeLessThanOrEqual(100)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
