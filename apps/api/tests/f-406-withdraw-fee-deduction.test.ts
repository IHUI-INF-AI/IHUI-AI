// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-406 回归锁(2026-11-13)。
 *
 * 病灶:applyWithdrawal 只按净额 actualAmount 扣减 token 余额,手续费(fee)从未从余额扣除;
 * availableWithdrawal / 事务内额度复核又按净额 flow.amount 抵扣,手续费额度永远留在可提现余额里
 * ⇒ 可反复提取手续费(100 提现,fee=2、到账 98,余额仍余 2 可再提)。
 *
 * 本文件锁:
 *   ① 提现后余额 = 原余额 - 申请毛额(= 到账额 + 手续费),update 表达式按毛额扣减;
 *   ② 余额不足(含手续费)被拒:98 余额无法申请 100,且不写提现单、不扣款;
 *   ③ 同一请求重复提交只扣一次(事务行锁 + 毛额占用额度,第二笔 400);
 *   ④ 正常提现的返回结构与写入字段(amount=净额/fee/originalAmount)保持不变;
 *   ⑤ 驳回按毛额原路退回,手续费不被吞。
 *
 * 只 mock db.transaction 的链式调用,不连 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

const { mockTransaction } = vi.hoisted(() => ({ mockTransaction: vi.fn() }))

vi.mock('../src/db/index.js', () => ({
  db: { transaction: mockTransaction },
}))

import { applyWithdrawal, rejectWithdrawal } from '../src/db/commission-queries.js'

const USER_ID = '11111111-1111-4111-8111-111111111111'

/** 提取 drizzle SQL 模板里的数值参数(不含 userId 等字符串参数) */
function numParams(node: unknown): number[] {
  if (typeof node === 'number') return [node]
  const chunks = (node as { queryChunks?: unknown[] } | undefined)?.queryChunks
  if (!Array.isArray(chunks)) return []
  const out: number[] = []
  for (const c of chunks) {
    if (
      c &&
      typeof c === 'object' &&
      'value' in c &&
      typeof (c as { value: unknown }).value === 'number'
    ) {
      out.push((c as { value: number }).value)
    } else {
      out.push(...numParams(c))
    }
  }
  return out
}

interface Ledger {
  commissionTotal: number
  tokenQuantity: number
  frozenQuantity: number
  withdrawals: Array<{ amount: number; fee: number; originalAmount: number }>
  updateCount: number
  insertCount: number
  selectCount: number
  executeCount: number
  lastSet: Record<string, unknown>
  lastWhere: unknown
}

function makeLedger(over: Partial<Ledger> = {}): Ledger {
  return {
    commissionTotal: 0,
    tokenQuantity: 0,
    frozenQuantity: 0,
    withdrawals: [],
    updateCount: 0,
    insertCount: 0,
    selectCount: 0,
    executeCount: 0,
    lastSet: {},
    lastWhere: undefined,
    ...over,
  }
}

/** 状态化假事务:按真实语义应用 update/insert,便于验证"只扣一次""被拒零写库" */
function makeTx(ledger: Ledger) {
  return {
    execute: vi.fn(async () => {
      ledger.executeCount++
    }),
    select: vi.fn(() => ({
      from: () => ({
        where: async () => {
          ledger.selectCount++
          const isCommission = ledger.selectCount % 2 === 1
          return [
            {
              total: isCommission
                ? ledger.commissionTotal
                : ledger.withdrawals.reduce((s, w) => s + w.originalAmount, 0),
            },
          ]
        },
      }),
    })),
    update: vi.fn(() => {
      ledger.updateCount++
      const chain = {
        set: (values: Record<string, unknown>) => {
          ledger.lastSet = values
          return chain
        },
        where: (cond: unknown) => {
          ledger.lastWhere = cond
          return {
            returning: async () => {
              const threshold = numParams(cond)[0] ?? 0
              if (ledger.tokenQuantity < threshold) return []
              ledger.tokenQuantity -= numParams(ledger.lastSet.tokenQuantity)[0] ?? 0
              ledger.frozenQuantity += numParams(ledger.lastSet.frozenQuantity)[0] ?? 0
              return [{ userId: USER_ID, tokenQuantity: ledger.tokenQuantity }]
            },
          }
        },
      }
      return chain
    }),
    insert: vi.fn(() => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          ledger.insertCount++
          const flow = {
            id: `w${ledger.insertCount}`,
            userId: values.userId,
            amount: values.amount,
            fee: values.fee,
            originalAmount: values.originalAmount,
            status: values.status,
            method: values.method,
            accountInfo: values.accountInfo,
            partnerTradeNo: values.partnerTradeNo,
          }
          ledger.withdrawals.push({
            amount: flow.amount as number,
            fee: flow.fee as number,
            originalAmount: flow.originalAmount as number,
          })
          return [flow]
        },
      }),
    })),
  }
}

const input = {
  userId: USER_ID,
  amount: 100,
  method: 'wechat',
  accountInfo: { account: 'wx-acc' },
  requireCommissionEligibility: true,
}

describe('F-406 提现手续费必须从余额扣减', () => {
  let ledger: Ledger

  beforeEach(() => {
    mockTransaction.mockReset()
  })

  function run(over: Partial<typeof input> = {}) {
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(makeTx(ledger)),
    )
    return applyWithdrawal({ ...input, ...over }, USER_ID)
  }

  it('① 提现后余额 = 原余额 - 金额 - 手续费(按毛额扣减,冻结只记净额)', async () => {
    ledger = makeLedger({ commissionTotal: 1000, tokenQuantity: 1000 })
    const flow = await run()

    // fee = floor(100 * 2%) = 2,实际到账 98,余额应扣 100
    expect(flow.amount).toBe(98)
    expect(flow.fee).toBe(2)
    expect(flow.originalAmount).toBe(100)
    expect(ledger.tokenQuantity).toBe(900)
    expect(ledger.frozenQuantity).toBe(98)
    // 判据落在 update 表达式参数上:扣减 100(毛额),而不是 98(净额)
    expect(numParams(ledger.lastSet.tokenQuantity)).toEqual([100])
    expect(numParams(ledger.lastSet.frozenQuantity)).toEqual([98])
    expect(numParams(ledger.lastWhere)).toEqual([100])
    expect(ledger.executeCount).toBe(1) // 先锁 margin 行
  })

  it('② 余额不足(含手续费)被拒:98 余额申请 100 → 400,不写单不扣款', async () => {
    ledger = makeLedger({ commissionTotal: 100, tokenQuantity: 98 })
    await expect(run()).rejects.toMatchObject({ statusCode: 400 })
    await expect(run()).rejects.toThrow('可提现余额不足')
    expect(ledger.insertCount).toBe(0)
    expect(ledger.withdrawals).toHaveLength(0)
    expect(ledger.tokenQuantity).toBe(98)
    expect(ledger.frozenQuantity).toBe(0)
    // 变异自证:扣减改回净额 98 时,本用例会成功并写单,断言翻红。
  })

  it('③ 同一请求重复提交只扣一次(行锁 + 毛额占用额度,第二笔 400)', async () => {
    ledger = makeLedger({ commissionTotal: 100, tokenQuantity: 1000 })
    await run()
    expect(ledger.tokenQuantity).toBe(900)
    expect(ledger.insertCount).toBe(1)
    expect(ledger.withdrawals).toHaveLength(1)

    // 同一请求再提交:可提现额度已按毛额占满 → 拒绝,余额不再变化
    await expect(run()).rejects.toThrow('可提现余额不足')
    expect(ledger.tokenQuantity).toBe(900)
    expect(ledger.insertCount).toBe(1)
    expect(ledger.withdrawals).toHaveLength(1)
  })

  it('④ 正常提现返回结构与写入字段不变(防误伤下游打款/对账)', async () => {
    ledger = makeLedger({ commissionTotal: 500, tokenQuantity: 500 })
    const flow = await run({ method: 'bank', accountInfo: { bank: 'ICBC' } })

    expect(flow.status).toBe(0)
    expect(flow.method).toBe('bank')
    expect(flow.accountInfo).toEqual({ bank: 'ICBC' })
    expect(flow.amount).toBe(98) // 到账额(净额)语义不变
    expect(flow.originalAmount).toBe(100) // 申请毛额语义不变
    expect(flow.partnerTradeNo).toMatch(/^WD\d+-/)
    expect(ledger.tokenQuantity).toBe(400)
    expect(ledger.frozenQuantity).toBe(98)
  })

  it('⑤ 驳回按毛额原路退回,手续费不被吞', async () => {
    ledger = makeLedger({ tokenQuantity: 900, frozenQuantity: 98 })
    const flowRow = {
      id: 'w-reject',
      userId: USER_ID,
      amount: 98,
      fee: 2,
      originalAmount: 100,
      status: 0,
      method: 'wechat',
      accountInfo: {},
    }
    const sets: Array<Record<string, unknown>> = []
    let updateCalls = 0
    const tx = {
      update: vi.fn(() => {
        const chain = {
          set: (values: Record<string, unknown>) => {
            sets.push(values)
            return chain
          },
          where: () => ({
            returning: async () => {
              updateCalls++
              // 第一次 update 是条件置 status=3(返回更新后的流水),第二次是退余额
              return updateCalls === 1 ? [{ ...flowRow, status: 3 }] : [{ userId: USER_ID }]
            },
          }),
        }
        return chain
      }),
    }
    mockTransaction.mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(tx))

    const flow = await rejectWithdrawal('w-reject', '信息不全', null)
    expect(flow?.status).toBe(3)
    // 第二次 update 是退余额:token += 100(毛额),frozen -= 98(净额)
    expect(sets).toHaveLength(2)
    expect(numParams(sets[1]!.tokenQuantity)).toEqual([100])
    expect(numParams(sets[1]!.frozenQuantity)).toEqual([98])
  })
})
