// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-436 回归锁(2026-11-13):事务内再开 db.transaction,注释的 savepoint 假设不成立。
 *
 * 病灶:createCommissionFlows 已经在外层事务里持有连接并锁住 orders 行,
 * 却调用不带 tx 的 createCommissionFlow ⇒ 后者用模块级 db 另借连接开第二层事务。
 * Drizzle 只有 `tx.transaction` 才复用连接/转 savepoint;顶层 `db.transaction` 是独立事务,
 * 内层先提交,外层回滚时佣金与钱包已入账 ⇒ 账实分叉;连接池紧张时并发回调互等连接。
 *
 * 本文件锁:
 *   ① 有外层事务时,createCommissionFlow 显式接收并使用调用方 tx,不再调用 db.transaction,
 *      事务内读写全部落在同一个 tx 客户端上;
 *   ② createCommissionFlows 整条链路(VIP 父级 + 操盘手祖父级,两次内层写入)
 *      的 db.transaction 只被调用 1 次;
 *   ③ 没有外层事务时仍由 createCommissionFlow 自己开、且只开 1 次事务,入账行为不变。
 *
 * 不连真实 DB:mock ../src/db/index.js,内存桩按 drizzle 链式 API 形状统计
 * transaction 调用次数与每次读写的客户端归属。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

type Row = Record<string, any>

const { state, db } = vi.hoisted(() => {
  const state = {
    /** 唯一一条活跃分佣比例配置 */
    proportion: {
      id: 'prop-1',
      status: 1,
      tokenProportion: 20,
      vipProportion: 10,
      grandVipProportion: 5,
      routineProportion: 10,
      grandRoutineProportion: 5,
      traderVipProportion: 10,
      traderRoutineProportion: 5,
    } as Row,
    users: [] as Row[],
    orders: [] as Row[],
    commissionRows: [] as Row[],
    marginRows: [] as Row[],
    tokenFlowRows: [] as Row[],
    /** db.transaction 被调用的次数 */
    txCalls: 0,
    /** 是否处于某个事务回调内 */
    inTx: false,
    /** 事务回调内所有经 tx 客户端发出的读写 */
    inTxOps: [] as Array<{ op: string; client: unknown }>,
    /** 事务回调内仍走模块级 db 的操作(修复后必须为空) */
    dbOpsDuringTx: [] as string[],
    seq: 0,
  }

  const isSql = (x: unknown): boolean =>
    !!x && typeof x === 'object' && Array.isArray((x as Row).queryChunks)
  const isChunk = (x: unknown): boolean =>
    !!x &&
    typeof x === 'object' &&
    Array.isArray((x as Row).value) &&
    !Array.isArray((x as Row).queryChunks)
  const isParam = (x: unknown): boolean =>
    !!x && typeof x === 'object' && 'value' in (x as Row) && 'encoder' in (x as Row)
  const isColumn = (x: unknown): boolean =>
    !!x && typeof x === 'object' && 'columnType' in (x as Row) && 'name' in (x as Row)

  /** 递归收集 where / set 中的绑定参数,用于行级匹配 */
  const collectParams = (x: unknown, out: unknown[] = []): unknown[] => {
    if (!x || typeof x !== 'object') return out
    if (isParam(x)) {
      out.push((x as Row).value)
      return out
    }
    if (isSql(x)) {
      for (const chunk of (x as Row).queryChunks as unknown[]) collectParams(chunk, out)
      return out
    }
    if (Array.isArray(x)) {
      for (const item of x as unknown[]) collectParams(item, out)
    }
    return out
  }

  /** 按表形状分派(与 tests/f-408-commission-token-flow.test.ts 同口径) */
  const rowsOf = (table: unknown): Row[] => {
    if (!table || typeof table !== 'object') return []
    const t = table as Row
    if ('tokenProportion' in t) return [state.proportion]
    if ('parentId' in t) return state.users
    if ('orderNo' in t) return state.orders
    if ('beneficiaryId' in t) return state.commissionRows
    if ('tokenQuantity' in t) return state.marginRows
    if ('opType' in t) return state.tokenFlowRows
    return []
  }

  const filterRows = (table: unknown, cond: unknown): Row[] => {
    const rows = rowsOf(table)
    if (cond === undefined) return rows
    const params = collectParams(cond)
    const t = table as Row
    if ('tokenProportion' in t) return params.includes(1) ? rows : []
    if ('parentId' in t) return rows.filter((r) => params.includes(r.id))
    if ('orderNo' in t) return rows.filter((r) => params.includes(r.id))
    if ('beneficiaryId' in t)
      return rows.filter(
        (r) => params.includes(r.orderId) && params.includes(r.beneficiaryId),
      )
    if ('tokenQuantity' in t) return rows.filter((r) => params.includes(r.userId))
    if ('opType' in t)
      return rows.filter(
        (r) => params.includes(r.relatedOrderNo) || params.includes(r.userId),
      )
    return rows
  }

  const doInsert = (table: unknown, values: Row): Row => {
    const row: Row = { ...values }
    if (!('id' in row)) row.id = `row-${++state.seq}`
    const t = table as Row
    if ('opType' in t) state.tokenFlowRows.push(row)
    else if ('beneficiaryId' in t) state.commissionRows.push(row)
    else if ('tokenQuantity' in t) state.marginRows.push(row)
    return row
  }

  /** 解释 sql`token_quantity + ${n}` 这类增量 set */
  const applySetSql = (sqlObj: Row, row: Row): void => {
    let text = ''
    let columnName: string | undefined
    let operand: unknown
    for (const chunk of sqlObj.queryChunks as unknown[]) {
      if (isChunk(chunk)) text += ((chunk as Row).value as string[]).join('')
      else if (isColumn(chunk)) columnName = (chunk as Row).name as string
      else if (isParam(chunk)) operand = (chunk as Row).value
      else if (typeof chunk === 'number') operand = chunk
    }
    const field = columnName === 'token_quantity' ? 'tokenQuantity' : (columnName ?? '')
    const current = Number(row[field] ?? 0)
    const val = Number(operand ?? 0)
    row[field] = /\+/.test(text) ? current + val : /-/.test(text) ? current - val : val
  }

  const upsertMargin = (values: Row, set: Row): Row => {
    const existing = state.marginRows.find((r) => r.userId === values.userId)
    if (!existing) return doInsert({ tokenQuantity: 'tokenQuantity' }, values)
    for (const [k, v] of Object.entries(set)) {
      if (isSql(v)) applySetSql(v as Row, existing)
      else existing[k] = v
    }
    return existing
  }

  const makeClient = (scope: 'db' | 'tx') => {
    const client: Row = {}
    const record = (op: string): void => {
      if (scope === 'db') {
        if (state.inTx) state.dbOpsDuringTx.push(op)
        return
      }
      state.inTxOps.push({ op, client })
    }

    const selectChain = (table: unknown) => {
      let cond: unknown
      const chain: Row = {
        from: (t: unknown) => {
          table = t
          return chain
        },
        where: (c: unknown) => {
          cond = c
          return chain
        },
        for: () => chain,
        orderBy: () => chain,
        offset: () => chain,
        limit: (n: number) => {
          record('select')
          return Promise.resolve(filterRows(table, cond).slice(0, n))
        },
      }
      chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
        record('select')
        return Promise.resolve(filterRows(table, cond)).then(resolve, reject)
      }
      return chain
    }

    client.select = () => selectChain(undefined)
    client.insert = (table: unknown) => ({
      values: (values: Row) => {
        const result: Row = {
          returning: () => {
            record('insert')
            return Promise.resolve([{ ...doInsert(table, values) }])
          },
          onConflictDoUpdate: (opts: { set: Row; target?: unknown }) => {
            record('insert')
            const row = upsertMargin(values, opts.set)
            const chained: Row = {
              returning: () => Promise.resolve([{ ...row }]),
            }
            chained.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
              Promise.resolve(row).then(resolve, reject)
            return chained
          },
        }
        result.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
          record('insert')
          try {
            resolve(doInsert(table, values))
          } catch (e) {
            reject(e)
          }
        }
        return result
      },
    })
    return client
  }

  const db: Row = {
    ...makeClient('db'),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      state.txCalls += 1
      const tx = makeClient('tx')
      const prev = state.inTx
      state.inTx = true
      try {
        return await fn(tx)
      } finally {
        state.inTx = prev
      }
    },
  }

  return { state, db }
})

vi.mock('../src/db/index.js', () => ({ db, dbRead: db }))

import { createCommissionFlow } from '../src/db/commission-queries.js'
import { createCommissionFlows } from '../src/services/commission-service.js'

beforeEach(() => {
  state.users.length = 0
  state.orders.length = 0
  state.commissionRows.length = 0
  state.marginRows.length = 0
  state.tokenFlowRows.length = 0
  state.txCalls = 0
  state.inTx = false
  state.inTxOps.length = 0
  state.dbOpsDuringTx.length = 0
})

describe('F-436:事务内不得再开第二层 db.transaction', () => {
  it('createCommissionFlows 两次内层分佣只开 1 次事务,读写全走同一 tx', async () => {
    // 父级 VIP(isVip=1)+ 祖父级操盘手(isVip=2)⇒ 一次链路内两次内层写佣金
    state.users.push(
      { id: 'u-child', parentId: 'u-parent', isVip: 0 },
      { id: 'u-parent', parentId: 'u-grand', isVip: 1 },
      { id: 'u-grand', parentId: null, isVip: 2 },
    )
    state.orders.push({
      id: 'o-1',
      orderNo: 'NO-1',
      amount: 1000,
      orderType: 1,
      productId: null,
    })

    const created = await createCommissionFlows(
      { id: 'u-child' },
      { id: 'o-1', amount: 1000, orderType: 1, productId: null },
    )

    // 行为不变:父级 10% + 祖父级 5%
    expect(created).toBe(2)
    expect(state.commissionRows.map((r) => r.amount).sort((a, b) => a - b)).toEqual([50, 100])
    expect(state.commissionRows.map((r) => r.beneficiaryId).sort()).toEqual([
      'u-grand',
      'u-parent',
    ])
    // F-436:只开外层一次事务;事务内的读写全部落在同一个 tx 客户端
    expect(state.txCalls).toBe(1)
    expect(state.dbOpsDuringTx).toEqual([])
    expect(state.inTxOps.length).toBeGreaterThan(0)
    expect(new Set(state.inTxOps.map((o) => o.client)).size).toBe(1)
  })

  it('内层函数显式接收外层 tx:不再触达 db.transaction,入账与流水照旧', async () => {
    state.marginRows.push({ userId: 'u-parent', tokenQuantity: 100, frozenQuantity: 0 })

    const flow = await db.transaction(async (tx: unknown) =>
      createCommissionFlow(
        {
          beneficiaryId: 'u-parent',
          invitedUserId: 'u-child',
          orderId: 'o-2',
          amount: 0,
          token: 30,
          type: 0,
          remark: '普通用户返佣',
        },
        null,
        tx as Parameters<typeof createCommissionFlow>[2],
      ),
    )

    expect(flow.token).toBe(30)
    expect(state.txCalls).toBe(1)
    expect(state.dbOpsDuringTx).toEqual([])
    expect(new Set(state.inTxOps.map((o) => o.client)).size).toBe(1)
    expect(state.marginRows[0]!.tokenQuantity).toBe(130)
    expect(state.tokenFlowRows).toHaveLength(1)
  })

  it('无外层事务时自己开且只开 1 次事务,行为不变', async () => {
    state.marginRows.push({ userId: 'u-parent', tokenQuantity: 100, frozenQuantity: 0 })

    const flow = await createCommissionFlow(
      {
        beneficiaryId: 'u-parent',
        invitedUserId: 'u-child',
        orderId: 'o-3',
        amount: 0,
        token: 30,
        type: 0,
        remark: '普通用户返佣',
      },
      null,
    )

    expect(flow.token).toBe(30)
    expect(state.txCalls).toBe(1)
    expect(state.commissionRows).toHaveLength(1)
    expect(state.marginRows[0]!.tokenQuantity).toBe(130)
    expect(state.tokenFlowRows).toHaveLength(1)
    expect(state.tokenFlowRows[0]!.balanceAfter).toBe(130)
    expect(state.tokenFlowRows[0]!.opType).toBe(4)
  })
})
