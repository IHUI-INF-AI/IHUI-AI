// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-408 回归锁(2026-11-13):佣金入钱包不写 token_flows,账实断链。
 *
 * 病灶:createCommissionFlow 只 UPSERT userMargins.tokenQuantity,不写 token_flows —
 * 其它资金动作(充值/扣减/退款/过期)都写流水,于是 getTokenFlowTotals 累计获得漏计佣金,
 * 且没有 balanceAfter 无法还原对账。
 *
 * 本文件锁:
 *   ① 入账一笔 token 佣金 → 同事务写 1 条 opType=4 流水,quantity=本次入账、
 *      balanceAfter=UPSERT 后真实余额;
 *   ② 首次入账(无 margin 行)balanceAfter 即新余额本身;
 *   ③ 同一佣金单(订单+受益人+类型)重复调用不重复写流水、不重复加余额;
 *   ④ 流水写入失败 → 佣金行与余额整体回滚(不留半截账);
 *   ⑤ token=0 的现金佣金不入钱包、不写流水。
 *
 * 只 mock 底层 db(内存桩捕获 insert 值),不触达真实 PG,不 mock 被测函数。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============================================================================
// vi.hoisted:内存 DB 桩(按 drizzle 链式 API 形状实现,捕获所有 insert 值)
// ============================================================================
const { db, state } = vi.hoisted(() => {
  type Row = Record<string, any>
  const state = {
    margins: [] as Row[],
    commissionRows: [] as Row[],
    tokenFlowRows: [] as Row[],
    /** 注入 token_flows 写入失败,验证事务整体回滚 */
    failTokenFlow: false,
  }

  const COL_TO_FIELD: Record<string, string> = {
    id: 'id',
    user_id: 'userId',
    op_type: 'opType',
    quantity: 'quantity',
    balance_after: 'balanceAfter',
    related_order_no: 'relatedOrderNo',
    token_quantity: 'tokenQuantity',
    frozen_quantity: 'frozenQuantity',
    beneficiary_id: 'beneficiaryId',
    invited_user_id: 'invitedUserId',
    order_id: 'orderId',
    amount: 'amount',
    token: 'token',
    type: 'type',
    status: 'status',
    remark: 'remark',
  }

  // ---- drizzle 对象 duck-type 识别(与 tests/fund-flow-integration.test.ts 同口径)----
  const isSql = (x: unknown): boolean =>
    !!x && typeof x === 'object' && Array.isArray((x as any).queryChunks)
  const isChunk = (x: unknown): boolean =>
    !!x &&
    typeof x === 'object' &&
    Array.isArray((x as any).value) &&
    !Array.isArray((x as any).queryChunks)
  const isParam = (x: unknown): boolean =>
    !!x && typeof x === 'object' && 'value' in (x as any) && 'encoder' in (x as any)
  const isColumn = (x: unknown): boolean =>
    !!x && typeof x === 'object' && 'columnType' in (x as any) && 'name' in (x as any)

  const tableKind = (table: unknown): 'tokenFlowRows' | 'commissionRows' | 'margins' => {
    const t = table as any
    if (t && 'opType' in t) return 'tokenFlowRows'
    if (t && 'beneficiaryId' in t) return 'commissionRows'
    return 'margins'
  }

  const extractConstraints = (cond: unknown): Array<{ field: string; value: unknown }> => {
    const out: Array<{ field: string; value: unknown }> = []
    if (!isSql(cond)) return out
    const chunks = (cond as any).queryChunks
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]
      if (isSql(c)) {
        // and(...)/not(...) 等嵌套 SQL → 递归
        out.push(...extractConstraints(c))
      } else if (isColumn(c)) {
        // eq(col, val) 形态:[STR(""), COL, STR(" = "), PARAM, STR("")]
        const opStr = isChunk(chunks[i + 1]) ? (chunks[i + 1] as any).value.join('') : ''
        if (!/=/.test(opStr)) continue
        const valChunk = chunks[i + 2]
        const val = isParam(valChunk) ? (valChunk as any).value : valChunk
        const name = (c as any).name as string
        out.push({ field: COL_TO_FIELD[name] ?? name, value: val })
      }
    }
    return out
  }

  const matches = (row: Row, constraints: Array<{ field: string; value: unknown }>): boolean =>
    constraints.every((c) => row[c.field] === c.value)

  // ---- SET 值解释器:处理 sql`token_quantity + ${qty}` 增量表达式 ----
  const applySetSql = (sqlObj: any, row: Row): void => {
    let text = ''
    let colName: string | undefined
    let operand: unknown
    for (const chunk of sqlObj.queryChunks) {
      if (isChunk(chunk)) text += (chunk as any).value.join('')
      else if (isColumn(chunk)) colName = (chunk as any).name
      else if (isParam(chunk)) operand = (chunk as any).value
      else if (typeof chunk === 'number') operand = chunk
    }
    const field = COL_TO_FIELD[colName ?? ''] ?? colName ?? ''
    const current = Number(row[field] ?? 0)
    const val = Number(operand ?? 0)
    row[field] = /\+/.test(text) ? current + val : /-/.test(text) ? current - val : val
  }

  const applySet = (values: Row, row: Row): void => {
    for (const [k, v] of Object.entries(values)) {
      if (isSql(v)) applySetSql(v, row)
      else row[k] = v
    }
  }

  let seq = 0
  const doInsert = (table: unknown, v: Row): Row => {
    const kind = tableKind(table)
    const row: Row = { ...v }
    if (!('id' in row)) row.id = `${kind}-${++seq}`
    if (!('createdAt' in row)) row.createdAt = new Date()
    if (kind === 'tokenFlowRows') {
      if (state.failTokenFlow) throw new Error('injected token flow failure')
      // token_flows(related_order_no, op_type) 唯一索引:同佣金单不重复写流水
      if (
        row.relatedOrderNo &&
        state.tokenFlowRows.some(
          (r) => r.relatedOrderNo === row.relatedOrderNo && r.opType === row.opType,
        )
      ) {
        const e = new Error('duplicate key value violates unique constraint')
        ;(e as any).code = '23505'
        throw e
      }
      state.tokenFlowRows.push(row)
    } else if (kind === 'commissionRows') {
      state.commissionRows.push(row)
    } else {
      state.margins.push(row)
    }
    return row
  }

  const db = {
    select: () => ({
      from: (table: unknown) => {
        const rowsOf = () => state[tableKind(table)]
        const buildWhere = (cond: unknown) => {
          const constraints = extractConstraints(cond)
          const filtered = () => rowsOf().filter((r) => matches(r, constraints))
          const chain: any = {
            limit: (n: number) => Promise.resolve(filtered().slice(0, n)),
            orderBy: () => chain,
          }
          chain.then = (resolve: any, reject: any) =>
            Promise.resolve(filtered()).then(resolve, reject)
          return chain
        }
        const base: any = {
          where: buildWhere,
          limit: (n: number) => Promise.resolve(rowsOf().slice(0, n)),
        }
        base.then = (resolve: any, reject: any) => Promise.resolve(rowsOf()).then(resolve, reject)
        return base
      },
    }),
    insert: (table: unknown) => ({
      values: (v: Row) => {
        const result: any = {
          returning: () => Promise.resolve([{ ...doInsert(table, v) }]),
          onConflictDoUpdate: (opts: any) => {
            const targetField = COL_TO_FIELD[(opts.target as any).name] ?? (opts.target as any).name
            const existing = state.margins.find((r) => r[targetField] === v[targetField])
            const row = existing ? (applySet(opts.set, existing), existing) : doInsert(table, v)
            const chained: any = { returning: () => Promise.resolve([{ ...row }]) }
            chained.then = (resolve: any, reject: any) => Promise.resolve(row).then(resolve, reject)
            return chained
          },
        }
        // 普通 await tx.insert(t).values(v)(无 returning)→ 执行 insert,resolve undefined
        result.then = (resolve: any, reject: any) => {
          try {
            doInsert(table, v)
            resolve(undefined)
          } catch (e) {
            reject(e)
          }
        }
        return result
      },
    }),
    transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      // 模拟 PostgreSQL 事务:cb 抛错 ⇒ 所有表还原到事务开始前
      const snap = {
        margins: state.margins.map((r) => ({ ...r })),
        commissionRows: state.commissionRows.map((r) => ({ ...r })),
        tokenFlowRows: state.tokenFlowRows.map((r) => ({ ...r })),
      }
      try {
        return await cb(db)
      } catch (e) {
        state.margins.length = 0
        state.margins.push(...snap.margins)
        state.commissionRows.length = 0
        state.commissionRows.push(...snap.commissionRows)
        state.tokenFlowRows.length = 0
        state.tokenFlowRows.push(...snap.tokenFlowRows)
        throw e
      }
    },
  }

  return { db, state }
})

vi.mock('../src/db/index.js', () => ({ db, dbRead: db }))

import { createCommissionFlow } from '../src/db/commission-queries.js'

/** 一笔典型的 token 类佣金(普通用户父级返佣,现金部分为 0)。 */
function commissionInput(over: Record<string, unknown> = {}) {
  return {
    beneficiaryId: 'u-parent',
    invitedUserId: 'u-child',
    orderId: 'order-1',
    amount: 0,
    token: 30,
    type: 0,
    remark: '普通用户返佣',
    ...over,
  }
}

beforeEach(() => {
  state.margins.length = 0
  state.commissionRows.length = 0
  state.tokenFlowRows.length = 0
  state.failTokenFlow = false
})

describe('F-408:佣金入钱包必须同事务写 token_flows', () => {
  it('入账一笔佣金 → 写 1 条 opType=4 流水,quantity 与 balanceAfter 正确', async () => {
    state.margins.push({ userId: 'u-parent', tokenQuantity: 100, frozenQuantity: 0 })

    const flow = await createCommissionFlow(commissionInput(), null)

    expect(flow.token).toBe(30)
    // 余额真实累加
    expect(state.margins[0]!.tokenQuantity).toBe(130)
    // 同事务写 1 条钱包流水(此前一条都没有 ⇒ getTokenFlowTotals 漏计)
    expect(state.tokenFlowRows).toHaveLength(1)
    const tf = state.tokenFlowRows[0]!
    expect(tf.userId).toBe('u-parent')
    expect(tf.opType).toBe(4) // F-394 同款钱包资金流水口径
    expect(tf.quantity).toBe(30)
    expect(tf.balanceAfter).toBe(130) // 余额变动后的真实值(不是入账数、不是旧余额)
    expect(tf.relatedOrderNo).toBe('order-1')
  })

  it('首次入账(无 margin 行):balanceAfter 为新余额本身', async () => {
    await createCommissionFlow(commissionInput({ beneficiaryId: 'u-new', orderId: 'order-2', token: 20 }), null)

    expect(state.margins).toHaveLength(1)
    expect(state.margins[0]!.tokenQuantity).toBe(20)
    expect(state.tokenFlowRows).toHaveLength(1)
    expect(state.tokenFlowRows[0]!.quantity).toBe(20)
    expect(state.tokenFlowRows[0]!.balanceAfter).toBe(20)
  })

  it('同一佣金单重复分佣被唯一索引拦截 → 整体回滚,不重复写流水/不重复加余额', async () => {
    state.margins.push({ userId: 'u-parent', tokenQuantity: 100, frozenQuantity: 0 })

    const first = await createCommissionFlow(commissionInput(), null)
    expect(first.token).toBe(30)

    // 重复分佣(同订单 + 同 opType)命中 token_flows(related_order_no, op_type)唯一索引
    await expect(createCommissionFlow(commissionInput(), null)).rejects.toMatchObject({
      code: '23505',
    })

    // 事务整体回滚:佣金行、流水、余额都不产生第二份
    expect(state.commissionRows).toHaveLength(1)
    expect(state.tokenFlowRows).toHaveLength(1)
    expect(state.margins[0]!.tokenQuantity).toBe(130)
  })

  it('流水写入失败 → 佣金行与余额整体回滚(不留半截账)', async () => {
    state.margins.push({ userId: 'u-parent', tokenQuantity: 100, frozenQuantity: 0 })
    state.failTokenFlow = true

    await expect(createCommissionFlow(commissionInput({ orderId: 'order-3' }), null)).rejects.toThrow(
      'injected token flow failure',
    )

    expect(state.commissionRows).toHaveLength(0)
    expect(state.tokenFlowRows).toHaveLength(0)
    expect(state.margins[0]!.tokenQuantity).toBe(100)
  })

  it('token=0 的现金佣金不入钱包、不写流水', async () => {
    await createCommissionFlow(commissionInput({ orderId: 'order-4', amount: 500, token: 0, type: 1 }), null)

    expect(state.commissionRows).toHaveLength(1)
    expect(state.tokenFlowRows).toHaveLength(0)
    expect(state.margins).toHaveLength(0)
  })
})
