// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-63 夹具:提现必须在事务内按佣金口径复核额度,并先锁 margin 行消除 TOCTOU。

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

const { mockTransaction } = vi.hoisted(() => ({ mockTransaction: vi.fn() }))

vi.mock('../src/db/index.js', () => ({
  db: { transaction: mockTransaction },
}))

import { applyWithdrawal } from '../src/db/commission-queries.js'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const FLOW = {
  id: 'w1',
  userId: USER_ID,
  amount: 98,
  fee: 2,
  originalAmount: 100,
  status: 0,
}

interface TxState {
  commissionTotal: number
  withdrawalTotal: number
  selectCalls: number
  updateCalls: number
  executeCalls: number
  order: string[]
}

function makeTx(state: TxState) {
  return {
    execute: vi.fn(async () => {
      state.executeCalls++
      state.order.push('lock')
    }),
    select: vi.fn(() => ({
      from: () => ({
        where: async () => {
          // 门禁内固定先查佣金、再查提现,用调用序而不是表对象 identity 区分
          state.selectCalls++
          const isCommission = state.selectCalls === 1
          state.order.push(isCommission ? 'select:commission' : 'select:withdrawal')
          return [{ total: isCommission ? state.commissionTotal : state.withdrawalTotal }]
        },
      }),
    })),
    update: vi.fn(() => {
      state.updateCalls++
      state.order.push('update')
      return {
        set: () => ({
          where: () => ({ returning: async () => [{ userId: USER_ID }] }),
        }),
      }
    }),
    insert: vi.fn(() => ({
      values: () => ({ returning: async () => [FLOW] }),
    })),
  }
}

const input = {
  userId: USER_ID,
  amount: 100,
  method: 'alipay',
  accountInfo: { account: 'a@b.c' },
  requireCommissionEligibility: true,
}

describe('F-63 提现佣金资格门禁', () => {
  let state: TxState

  beforeEach(() => {
    state = {
      commissionTotal: 0,
      withdrawalTotal: 0,
      selectCalls: 0,
      updateCalls: 0,
      executeCalls: 0,
      order: [],
    }
    mockTransaction.mockReset()
  })

  function run() {
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(makeTx(state)),
    )
    return applyWithdrawal(input, USER_ID)
  }

  it('无佣金流水 → 400,且不得冻结余额/插入流水', async () => {
    state.commissionTotal = 0
    await expect(run()).rejects.toThrow('可提现余额不足')
    expect(state.updateCalls).toBe(0)
    // 变异自证:删掉 requireCommissionEligibility 分支后,会直接冻结并插入流水,本断言翻红。
  })

  it('佣金已被在途/已完成提现占满 → 400(并发第二笔不放过)', async () => {
    state.commissionTotal = 500
    state.withdrawalTotal = 450
    await expect(run()).rejects.toThrow('可提现余额不足')
    expect(state.updateCalls).toBe(0)
  })

  it('额度充足 → 先锁行再复核,最后冻结并写流水', async () => {
    state.commissionTotal = 500
    state.withdrawalTotal = 0
    const flow = await run()
    expect(flow).toBe(FLOW)
    expect(state.executeCalls).toBe(1)
    expect(state.updateCalls).toBe(1)
    expect(state.order).toEqual(['lock', 'select:commission', 'select:withdrawal', 'update'])
    // 变异自证:去掉 FOR UPDATE 后 executeCalls=0、order 首项不是 lock,本断言翻红。
  })

  it('不传门禁标志的旧调用方保持原行为(用于非佣金提现场景)', async () => {
    state.commissionTotal = 0
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(makeTx(state)),
    )
    const flow = await applyWithdrawal({ ...input, requireCommissionEligibility: false }, USER_ID)
    expect(flow).toBe(FLOW)
    expect(state.executeCalls).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
