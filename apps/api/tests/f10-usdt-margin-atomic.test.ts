// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-10 夹具:USDT 确认入账对 user_margins 的写必须是**单条原子增量**,
 * 不允许「事务内读旧值 → 应用层相加 → 写回绝对值」。
 *
 * 为什么这样测:
 * 默认 READ COMMITTED 下,同一用户两笔 pending 订单并发确认时,两个事务都会读到
 * 同一旧行版本 token_quantity=X。读后写实现分别写回 X+a / X+b,后者覆盖前者(丢账),
 * 流水 balance_after 也随之分叉。夹具把 user_margins 的读**固定返回同一旧快照 X**
 * (模拟两个事务都读到旧行),而写按 SQL 表达式的语义落库:
 *   - set 值是数字 ⇒ 绝对值覆盖(旧实现语义,本用例会失败);
 *   - set 值是 `token_quantity + $n` ⇒ 在当前值上增量(新实现语义,两笔累加)。
 * 因此用例不需要真库/真并发,也能在实现回退时变红。
 *
 * 断言:
 * ① 两笔确认后余额 = X + a + b,两次流水 balance_after 都是各自的新余额;
 * ② 渲染 set 表达式含 `token_quantity + $n`,且事务内没有 SELECT user_margins / 绝对值 UPDATE;
 * ③ 流水 balance_after 取 RETURNING 的新值(不是读到的旧值);
 * ④ user_margins 无行时的创建兜底保持(首笔即 X=0 起算)。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { userMargins } from '@ihui/database'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(64)
  process.env.REDIS_URL ??= 'redis://localhost:6379'
})

const h = vi.hoisted(() => {
  const state = {
    /** 用户余额行是否存在(用于覆盖创建兜底分支) */
    marginRowExists: true,
    /** 真实落库余额:增量写在此之上累加 */
    balance: 0,
    /** user_margins 的「并发旧读快照」:两个事务读到的都是这个旧值 */
    staleSnapshot: 0,
    /** dbRead.select 的订单结果队列(每次确认读一次订单) */
    orderQueue: [] as unknown[][],
    configRows: [{ key: 'usdt_payment.rate', value: '1' }] as unknown[],
    /** token_flows 落库行 */
    flows: [] as Array<Record<string, unknown>>,
    /** 事务内写操作留痕 */
    writes: [] as Array<{ table: string; kind: string; set?: any; values?: any; conflict?: any }>,
    txSelectTables: [] as string[],
    dbReadSelectTables: [] as string[],
    /** SQL 渲染器(hoisted 里不能直接引用 drizzle import,由用例模块注入) */
    sqlToQuery: null as null | ((expr: unknown) => { sql: string; params: unknown[] }),
  }

  /** drizzle 表对象的物理表名 */
  const tableName = (table: unknown): string => {
    if (!table || typeof table !== 'object') return ''
    const name = (table as Record<symbol, unknown>)[Symbol.for('drizzle:Name')]
    return typeof name === 'string' ? name : ''
  }

  /** 从 SQL 表达式里取出数值参数(用真实方言渲染,避免猜 drizzle 内部 chunk 结构) */
  const numericParamsOf = (expr: unknown): number[] => {
    if (!state.sqlToQuery) throw new Error('F-10 夹具:SQL 渲染器未注入')
    return state.sqlToQuery(expr).params.filter((value): value is number => typeof value === 'number')
  }

  /** select 的链式 thenable:按 from() 的表名决定返回行 */
  const selectChain = (resolve: (table: string) => unknown[]) => {
    let table = ''
    let cached: unknown[] | null = null
    const rows = () => (cached ??= resolve(table))
    const p: any = {
      from(t: unknown) {
        table = tableName(t)
        return p
      },
      where() {
        return p
      },
      orderBy() {
        return p
      },
      offset() {
        return p
      },
      limit() {
        return Promise.resolve(rows())
      },
      then(onFulfilled: any, onRejected: any) {
        return Promise.resolve(rows()).then(onFulfilled, onRejected)
      },
    }
    return p
  }

  /**
   * 复刻单行写入语义:
   * - 行不存在 ⇒ 按 values 插入(创建兜底);
   * - 行存在 + set 是数字 ⇒ 绝对值覆盖(读后写实现);
   * - 行存在 + set 是 `token_quantity + $n` ⇒ 在当前值上增量(原子实现)。
   */
  const applyMarginWrite = (values: any, conflict: any) => {
    if (!state.marginRowExists) {
      state.marginRowExists = true
      state.balance = Number(values?.tokenQuantity ?? 0)
      return [{ tokenQuantity: state.balance }]
    }
    const setValue = conflict?.set?.tokenQuantity
    if (typeof setValue === 'number') {
      state.balance = setValue
      return [{ tokenQuantity: state.balance }]
    }
    const params = numericParamsOf(setValue)
    if (params.length === 0) {
      throw new Error('F-10 夹具:无法从 set 表达式解析增量参数')
    }
    state.balance += params[params.length - 1]
    return [{ tokenQuantity: state.balance }]
  }

  const insert = vi.fn((table: unknown) => {
    const name = tableName(table)
    const p: any = {}
    p.values = (values: any) => {
      state.writes.push({ table: name, kind: 'insert', values })
      if (name === 'token_flows') state.flows.push(values)
      const q: any = Promise.resolve(undefined)
      q.onConflictDoUpdate = (conflict: any) => {
        state.writes.push({ table: name, kind: 'conflict', conflict })
        q.returning = () => Promise.resolve(applyMarginWrite(values, conflict))
        return q
      }
      q.returning = () => Promise.resolve([])
      return q
    }
    p.returning = () => Promise.resolve([])
    return p
  })

  const update = vi.fn((table: unknown) => {
    const name = tableName(table)
    const p: any = {}
    p.set = (set: any) => {
      state.writes.push({ table: name, kind: 'update', set })
      return p
    }
    p.where = () => p
    p.returning = () =>
      Promise.resolve(name === 'usdt_payments' ? [{ id: 'row-1', userId: 'user-1' }] : [])
    p.then = (onFulfilled: any, onRejected: any) =>
      Promise.resolve(undefined).then(onFulfilled, onRejected)
    return p
  })

  const txSelect = vi.fn(() =>
    selectChain((table) => {
      state.txSelectTables.push(table)
      // 并发旧读快照:两个事务都读到同一旧行版本
      if (table === 'user_margins') {
        return [{ userId: 'user-1', tokenQuantity: state.staleSnapshot, frozenQuantity: 0 }]
      }
      return []
    }),
  )

  const tx = { select: txSelect, update, insert }
  const transaction = vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx))

  const dbReadSelect = vi.fn(() =>
    selectChain((table) => {
      state.dbReadSelectTables.push(table)
      if (table === 'usdt_payments') return state.orderQueue.shift() ?? []
      if (table === 'system_configs') return state.configRows
      if (table === 'user_margins') {
        return [{ userId: 'user-1', tokenQuantity: state.staleSnapshot, frozenQuantity: 0 }]
      }
      return []
    }),
  )

  return { state, dbReadSelect, transaction, tx, insert, update }
})

vi.mock('../src/db/index.js', () => ({
  db: { transaction: h.transaction, update: h.update, insert: h.insert },
  dbRead: { select: h.dbReadSelect },
}))

vi.mock('../src/config/index.js', () => ({
  config: { USDT_CONFIRM_TRC20_MIN: 1, USDT_CONFIRM_ERC20_MIN: 1 },
}))

// hoisted 里拿不到模块 import,先把真实方言渲染器注入夹具
const dialect = new PgDialect()
h.state.sqlToQuery = (expr: unknown) => dialect.sqlToQuery(expr as any)

const { confirmUsdtPayment } = await import('../src/services/payment-usdt-service.js')

/** 一笔可用于确认入账的 pending 订单(金额与 amountPaid 精确匹配) */
function pendingOrder(orderId: string, amount: number) {
  return {
    orderId,
    userId: 'user-1',
    address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    network: 'TRC20',
    amount: amount.toFixed(8),
    amountPaid: '0',
    txHash: null,
    status: 'pending',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(Date.UTC(2026, 10, 11, 3, 0, 0)),
    confirmedAt: null,
  }
}

const ORDER_A = 'USDT-F10-A'
const ORDER_B = 'USDT-F10-B'
const AMOUNT_A = 10.00025 // × rate 1 × 100 ⇒ 1000 分
const AMOUNT_B = 20.00025 // ⇒ 2000 分
const OLD_BALANCE = 5000

beforeEach(() => {
  h.state.orderQueue.length = 0
  h.state.flows.length = 0
  h.state.writes.length = 0
  h.state.txSelectTables.length = 0
  h.state.dbReadSelectTables.length = 0
  h.state.marginRowExists = true
  h.state.balance = OLD_BALANCE
  h.state.staleSnapshot = OLD_BALANCE
  vi.clearAllMocks()
})

describe('F-10 USDT 入账 user_margins 必须原子增量', () => {
  it('① 两笔确认后余额为两笔之和(旧读快照不会覆盖已入账增量)', async () => {
    h.state.orderQueue.push([pendingOrder(ORDER_A, AMOUNT_A)])
    h.state.orderQueue.push([pendingOrder(ORDER_B, AMOUNT_B)])

    // 两次顺序调用,但 user_margins 的读始终返回同一旧快照 ⇒ 等价于两个并发事务都读到 X
    const r1 = await confirmUsdtPayment(ORDER_A, '0xf10a', AMOUNT_A)
    const r2 = await confirmUsdtPayment(ORDER_B, '0xf10b', AMOUNT_B)

    expect(r1).toEqual({ orderId: ORDER_A, status: 'confirmed', tokensCredited: 1000 })
    expect(r2).toEqual({ orderId: ORDER_B, status: 'confirmed', tokensCredited: 2000 })
    // 读后写实现会停在 5000+2000=7000(第一笔被覆盖)
    expect(h.state.balance).toBe(OLD_BALANCE + 1000 + 2000)
    expect(h.state.flows.map((flow) => flow.balanceAfter)).toEqual([6000, 8000])
  })

  it('② 落库是单条 `token_quantity + $n` 自增表达式,且事务内不再读 user_margins', async () => {
    h.state.orderQueue.push([pendingOrder(ORDER_A, AMOUNT_A)])
    await confirmUsdtPayment(ORDER_A, '0xf10a', AMOUNT_A)

    const conflictWrite = h.state.writes.find(
      (write) => write.table === 'user_margins' && write.kind === 'conflict',
    )
    expect(conflictWrite).toBeTruthy()

    const setValue = conflictWrite!.conflict.set.tokenQuantity
    // 应用层相加后的绝对值(读后写的产物)必须不存在
    expect(typeof setValue).not.toBe('number')

    const rendered = dialect.sqlToQuery(setValue)
    expect(rendered.sql).toMatch(/token_quantity"?\s*\+\s*\$\d+/)
    expect(rendered.params).toEqual([1000])

    // 冲突目标必须是 user_id 主键,保证并发落在同一行上重算
    expect(conflictWrite!.conflict.target).toBe(userMargins.userId)

    // 读后写的另一半:事务内 SELECT user_margins 或写绝对值 UPDATE,都算回退
    expect(h.state.txSelectTables).not.toContain('user_margins')
    expect(
      h.state.writes.filter((write) => write.table === 'user_margins' && write.kind === 'update'),
    ).toEqual([])
  })

  it('③ 流水 balance_after 取 RETURNING 的新值,不是读到的旧值', async () => {
    h.state.orderQueue.push([pendingOrder(ORDER_A, AMOUNT_A)])
    await confirmUsdtPayment(ORDER_A, '0xf10a', AMOUNT_A)

    expect(h.state.flows).toHaveLength(1)
    expect(h.state.flows[0].balanceAfter).toBe(OLD_BALANCE + 1000)
    expect(h.state.flows[0].balanceAfter).not.toBe(OLD_BALANCE)
  })

  it('④ user_margins 无行时保留创建兜底,首笔从 0 起算', async () => {
    h.state.marginRowExists = false
    h.state.balance = 0
    h.state.staleSnapshot = 0
    h.state.orderQueue.push([pendingOrder(ORDER_A, AMOUNT_A)])

    const r = await confirmUsdtPayment(ORDER_A, '0xf10a', AMOUNT_A)

    expect(r).toEqual({ orderId: ORDER_A, status: 'confirmed', tokensCredited: 1000 })
    expect(h.state.balance).toBe(1000)
    expect(h.state.flows[0].balanceAfter).toBe(1000)
  })
})
