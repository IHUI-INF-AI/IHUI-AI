// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-228 夹具:未支付订单不得生成结算;跨月结算按天摊分且逐期幂等。

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    selectResults: [] as unknown[][],
    inserts: [] as Array<Record<string, unknown>>,
    insertResults: [] as unknown[][],
  },
}))

vi.mock('../src/db/index.js', () => {
  const dbRead = {
    select: () => {
      const c: Record<string, unknown> = {}
      for (const m of ['from', 'where']) c[m] = () => c
      const take = () => Promise.resolve(state.selectResults.shift() ?? [])
      c.limit = take
      c.then = (resolve: (v: unknown) => unknown) => take().then(resolve)
      return c
    },
  }
  const db = {
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        state.inserts.push(values)
        return {
          returning: () => Promise.resolve(state.insertResults.shift() ?? [{ id: 's', ...values }]),
        }
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
    state.selectResults.length = 0
    state.inserts.length = 0
    state.insertResults.length = 0
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

  it('active 订单跨月生成多期,orderNo 逐期加 #issueNo 且金额合计等于总额', async () => {
    // 每期一次幂等 SELECT 都返回空 ⇒ 未结算过
    state.selectResults.push([], [], [])

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
    // 变异自证:恢复"每期都写全额"后,amounts 为 [9900, 9900, 9900],本断言翻红。
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
