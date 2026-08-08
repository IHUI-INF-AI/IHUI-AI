/**
 * 资金链路端到端集成测试(2026-08-02 立)。
 *
 * 验证上轮 P0 修复的资金守恒四象限 + 提现审批状态机:
 * - 场景 1(Bug B1):支付成功后 token 充值进账(orderType=2/3 才充;membership 不充;saga 幂等)
 * - 场景 2(Bug B2):退款退还 token(用 refund:<orderNo> 幂等键,不与充值冲突)
 * - 场景 3(Bug A1):提现驳回退冻结(tokenQuantity += amount,frozenQuantity -= amount)
 * - 场景 4(Bug A3):佣金入账(createCommissionFlow 事务内 UPSERT userMargins)
 * - 场景 5(Bug A2):approveWithdrawal 状态机 0→1(processing,不是 0→2)
 *
 * 测试模式:vi.hoisted + vi.mock db(内存 DB 模拟 drizzle 事务 + 条件/SET 解释器)
 * + 真实被测函数运行(commission-queries / order-service 的真实业务逻辑跑在 mock db 上)。
 * 关键:不 mock commission-queries,让 rechargeToken/rejectWithdrawal/approveWithdrawal/
 * createCommissionFlow 的真实逻辑跑,只 mock 底层 db,这样才能真正验证资金守恒 bug 修复。
 *
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { userMargins, tokenFlows, withdrawalFlows, commissionFlows } from '@ihui/database'

// ============================================================================
// vi.hoisted: 内存 DB + drizzle 条件/SET 解释器(自包含,不依赖任何 import)
// ============================================================================
const { db, getRows } = vi.hoisted(() => {
  // ---- DB 列名(snake_case)→ JS 字段(camelCase)映射 ----
  const COL_TO_FIELD: Record<string, string> = {
    user_id: 'userId',
    token_quantity: 'tokenQuantity',
    frozen_quantity: 'frozenQuantity',
    updated_at: 'updatedAt',
    created_at: 'createdAt',
    id: 'id',
    op_type: 'opType',
    quantity: 'quantity',
    balance_after: 'balanceAfter',
    remark: 'remark',
    related_order_no: 'relatedOrderNo',
    operator_id: 'operatorId',
    amount: 'amount',
    fee: 'fee',
    original_amount: 'originalAmount',
    status: 'status',
    method: 'method',
    account_info: 'accountInfo',
    partner_trade_no: 'partnerTradeNo',
    payment_no: 'paymentNo',
    reject_reason: 'rejectReason',
    processed_at: 'processedAt',
    beneficiary_id: 'beneficiaryId',
    invited_user_id: 'invitedUserId',
    order_id: 'orderId',
    token: 'token',
    type: 'type',
    created_by: 'createdBy',
    updated_by: 'updatedBy',
  }

  // ---- drizzle 对象 duck-type 识别(不依赖构造器名,避免内部重命名破坏)----
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

  // ---- 内存表存储:WeakMap 按 table 对象引用分发(被测函数与测试用同一 schema 引用)----
  const tableRegistry = new WeakMap<object, Record<string, any>[]>()
  const registeredTables: object[] = []
  const getRows = (table: object): Record<string, any>[] => {
    let r = tableRegistry.get(table)
    if (!r) {
      r = []
      tableRegistry.set(table, r)
      registeredTables.push(table)
    }
    return r
  }
  let idCounter = 0
  const genId = (): string => 'gen-' + ++idCounter

  // 事务快照(模拟 PostgreSQL 事务回滚:cb 抛错时还原所有表)
  const snapshot = (): Record<string, any>[][] =>
    registeredTables.map((t) => getRows(t).map((r) => ({ ...r })))
  const restore = (snap: Record<string, any>[][]): void => {
    registeredTables.forEach((t, i) => {
      const rows = getRows(t)
      rows.length = 0
      rows.push(...snap[i]!.map((r) => ({ ...r })))
    })
  }

  // ---- WHERE 条件解释器:递归提取 {field, op, value} 约束 ----
  // 支持 eq(col,val) / and(...) / sql`col >= ${val}` 三种形态(覆盖被测代码全部 where 用法)
  function extractConstraints(cond: unknown): Array<{ field: string; op: string; value: unknown }> {
    const out: Array<{ field: string; op: string; value: unknown }> = []
    if (!isSql(cond)) return out
    const chunks = (cond as any).queryChunks
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]
      if (isSql(c)) {
        // 嵌套 SQL(and 的子条件 / 子表达式)→ 递归
        out.push(...extractConstraints(c))
      } else if (isColumn(c)) {
        // eq 模式:[STR(""), COL, STR(" = "), PARAM/LIT, STR("")] → COL op value
        const nextStr = chunks[i + 1]
        const opStr = isChunk(nextStr) ? nextStr.value.join('') : ''
        const m = opStr.match(/\s*(>=|<=|<>|!=|>|<|=)\s*/)
        const op = m ? m[1] : '='
        const valChunk = chunks[i + 2]
        const val = isParam(valChunk) ? valChunk.value : valChunk
        out.push({ field: COL_TO_FIELD[(c as any).name] ?? (c as any).name, op, value: val })
      } else if (isChunk(c)) {
        // sql`col op ${val}` 模式:STR("col op ") 后跟 LIT/PARAM
        const s = c.value.join('')
        const m = s.match(/([a-z_]+)\s*(>=|<=|<>|!=|>|<|=)\s*$/)
        if (m) {
          const valChunk = chunks[i + 1]
          const val = isParam(valChunk) ? valChunk.value : valChunk
          out.push({ field: COL_TO_FIELD[m[1]] ?? m[1], op: m[2], value: val })
        }
      }
    }
    return out
  }

  function matches(
    row: Record<string, any>,
    constraints: Array<{ field: string; op: string; value: unknown }>,
  ): boolean {
    return constraints.every((c) => {
      const v = row[c.field]
      switch (c.op) {
        case '=':
        case '==':
          return v === c.value
        case '!=':
        case '<>':
          return v !== c.value
        case '>':
          return Number(v) > Number(c.value)
        case '>=':
          return Number(v) >= Number(c.value)
        case '<':
          return Number(v) < Number(c.value)
        case '<=':
          return Number(v) <= Number(c.value)
        default:
          return false
      }
    })
  }

  // ---- SET 值解释器:处理 sql`token_quantity + ${qty}` 等表达式 ----
  function readColName(sqlObj: any): string | undefined {
    for (const chunk of sqlObj.queryChunks) {
      if (isColumn(chunk)) return (chunk as any).name
    }
    return undefined
  }
  function applySetSql(sqlObj: any, row: Record<string, any>): void {
    let strParts = ''
    let operand: unknown = undefined
    let colName: string | undefined
    for (const chunk of sqlObj.queryChunks) {
      if (isChunk(chunk)) strParts += chunk.value.join('')
      else if (isColumn(chunk)) colName = (chunk as any).name
      else if (isParam(chunk)) operand = chunk.value
      else if (typeof chunk !== 'object') operand = chunk
      else if (isSql(chunk)) {
        // 嵌套 SQL(如 ${userMargins.tokenQuantity} 列引用)→ 取列名
        const sub = readColName(chunk)
        if (sub && !colName) colName = sub
      }
    }
    if (!colName) {
      const m = strParts.match(/^([a-z_]+)/)
      if (m) colName = m[1]
    }
    const opMatch = strParts.match(/([+\-*/])/)
    const op = opMatch ? opMatch[1] : null
    const field = (colName && (COL_TO_FIELD[colName] ?? colName)) || ''
    const current = Number(row[field] ?? 0)
    const val = Number(operand ?? 0)
    if (op === '+') row[field] = current + val
    else if (op === '-') row[field] = current - val
    else if (op === '*') row[field] = current * val
    else if (op === '/') row[field] = current / val
    else row[field] = val
  }
  function applySet(values: Record<string, any>, row: Record<string, any>): void {
    for (const [k, v] of Object.entries(values)) {
      if (isSql(v)) applySetSql(v, row)
      else row[k] = v
    }
  }

  // ---- insert 辅助 ----
  function doInsert(table: object, v: Record<string, any>): Record<string, any> {
    const rows = getRows(table)
    const row: Record<string, any> = { ...v }
    if (!('id' in row)) row.id = genId()
    if (!('createdAt' in row)) row.createdAt = new Date()
    if (!('updatedAt' in row)) row.updatedAt = new Date()
    // token_flows (related_order_no, op_type) unique 索引模拟(拦截重复回调/重复退款)
    if (row.opType !== undefined && row.relatedOrderNo) {
      const dup = rows.some(
        (r) => r.relatedOrderNo === row.relatedOrderNo && r.opType === row.opType,
      )
      if (dup) {
        const e = new Error('duplicate key value violates unique constraint')
        ;(e as any).code = '23505'
        throw e
      }
    }
    rows.push(row)
    return row
  }
  function doUpsert(table: object, v: Record<string, any>, opts: any): Record<string, any> {
    const rows = getRows(table)
    const targetField = COL_TO_FIELD[opts.target.name] ?? opts.target.name
    const existing = rows.find((r) => r[targetField] === v[targetField])
    if (existing) {
      applySet(opts.set, existing)
      return existing
    }
    return doInsert(table, v)
  }

  // ---- db 链式 API(模拟 drizzle query builder)----
  const db = {
    select: () => ({
      from: (table: object) => {
        const buildWhere = (cond: any) => {
          const constraints = extractConstraints(cond)
          const filtered = () => getRows(table).filter((r) => matches(r, constraints))
          const chain: any = {
            orderBy: () => chain,
            limit: (n: number) => Promise.resolve(filtered().slice(0, n)),
            for: () => chain, // for('update') 行锁 — 内存 DB 无需真实锁定
          }
          chain.then = (resolve: any, reject: any) =>
            Promise.resolve(filtered()).then(resolve, reject)
          return chain
        }
        const base: any = {
          where: buildWhere,
          orderBy: () => base,
          limit: (n: number) => Promise.resolve(getRows(table).slice(0, n)),
        }
        base.then = (resolve: any, reject: any) =>
          Promise.resolve(getRows(table)).then(resolve, reject)
        return base
      },
    }),
    update: (table: object) => ({
      set: (values: Record<string, any>) => ({
        where: (cond: any) => {
          const constraints = extractConstraints(cond)
          const matched = getRows(table).filter((r) => matches(r, constraints))
          for (const r of matched) applySet(values, r)
          const copies = matched.map((r) => ({ ...r }))
          const result: any = { returning: () => Promise.resolve(copies) }
          result.then = (resolve: any, reject: any) => Promise.resolve(copies).then(resolve, reject)
          return result
        },
      }),
    }),
    insert: (table: object) => ({
      values: (v: Record<string, any>) => {
        const result: any = {
          returning: () => Promise.resolve([doInsert(table, v)]),
          onConflictDoUpdate: (opts: any) => Promise.resolve(doUpsert(table, v, opts)),
        }
        // 普通路径 await tx.insert(t).values(v)(无 returning)→ 执行 insert,resolve undefined
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
    transaction: async (cb: (tx: typeof db) => Promise<unknown>) => {
      const snap = snapshot()
      try {
        return await cb(db)
      } catch (e) {
        // 模拟 PostgreSQL 事务回滚:cb 抛错时还原所有表到事务开始前状态
        restore(snap)
        throw e
      }
    },
  }

  return { db, getRows }
})

// ============================================================================
// vi.mock:db / logger / outbox / payment-queries / points-service
// ============================================================================
vi.mock('../src/db/index.js', () => ({ db }))
vi.mock('../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}))
vi.mock('../src/utils/outbox.js', () => ({ writeToOutbox: vi.fn().mockResolvedValue(undefined) }))

const { mockFindOrderByNo, mockUpdateOrderStatus, mockEarnPoints, mockSpendPoints } = vi.hoisted(
  () => ({
    mockFindOrderByNo: vi.fn(),
    mockUpdateOrderStatus: vi.fn(),
    mockEarnPoints: vi.fn(),
    mockSpendPoints: vi.fn(),
  }),
)

vi.mock('../src/db/payment-queries.js', () => ({
  findOrderByNo: mockFindOrderByNo,
  updateOrderStatus: mockUpdateOrderStatus,
  createOrder: vi.fn(),
  queryPendingOrders: vi.fn().mockResolvedValue([]),
  listPaidOrdersByDate: vi.fn().mockResolvedValue([]),
}))
vi.mock('../src/services/points-service.js', () => ({
  earnPoints: mockEarnPoints,
  spendPoints: mockSpendPoints,
}))
// P2-20 creditTopupBonus 调用 calculateTopupBonus,该函数依赖 dbRead 查询 systemConfigs,
// 内存 DB mock 未暴露 dbRead,故 mock 该模块直接返回无赠送结果,防止 getTopupConfig 报错。
vi.mock('../src/services/topup-discount-service.js', () => ({
  calculateTopupBonus: vi.fn().mockResolvedValue({ multiplier: 1, bonus: 0, actualCredit: 1 }),
  getTopupConfig: vi.fn(),
}))

// 被测函数(commission-queries 不 mock,真实逻辑跑在 mock db 上;order-service 依赖被 mock)
import { completeOrderWithSaga, refundOrder } from '../src/services/order-service.js'
import {
  rejectWithdrawal,
  approveWithdrawal,
  createCommissionFlow,
} from '../src/db/commission-queries.js'

// ============================================================================
// 测试夹具
// ============================================================================
let ordersStore: Array<Record<string, any>>

beforeEach(() => {
  // 重置 4 张内存表
  getRows(userMargins).length = 0
  getRows(tokenFlows).length = 0
  getRows(withdrawalFlows).length = 0
  getRows(commissionFlows).length = 0
  ordersStore = []
  vi.clearAllMocks()
  // points-service 默认返回(award-points saga 步骤用)
  mockEarnPoints.mockResolvedValue({ transaction: { id: 'ptx-1' } })
  mockSpendPoints.mockResolvedValue({ transaction: { id: 'ptx-2' } })
  // payment-queries:操作测试内的 ordersStore(条件 UPDATE 模拟 B3 状态机守卫)
  mockFindOrderByNo.mockImplementation(async (orderNo: string) => {
    const o = ordersStore.find((x) => x.orderNo === orderNo)
    return o ? { ...o } : undefined
  })
  mockUpdateOrderStatus.mockImplementation(
    async (orderNo: string, newStatus: string, fromStatus?: string) => {
      const o = ordersStore.find((x) => x.orderNo === orderNo)
      if (!o) return undefined
      if (fromStatus && o.status !== fromStatus) return undefined // B3 条件 UPDATE
      o.status = newStatus
      return { ...o }
    },
  )
})

/** 取 userMargins 某 userId 的行(测试断言用)。 */
function marginOf(userId: string): Record<string, any> | undefined {
  return getRows(userMargins).find((r) => r.userId === userId)
}

// ============================================================================
// 场景 1:支付成功后 token 充值(验证 Bug B1 修复)
// ============================================================================
describe('资金链路:支付成功充值 token(Bug B1)', () => {
  it('orderType=2(token)订单支付成功后,userMargins.tokenQuantity 增加', async () => {
    ordersStore.push({
      id: 'ord-1',
      orderNo: 'ORD-1',
      userId: 'U1',
      amount: 100,
      orderType: 2,
      status: 'pending',
      productId: null,
    })
    // U1 初始无 margin(rechargeToken 内部 ensureMargin 会创建 tokenQuantity=0)

    const result = await completeOrderWithSaga('ORD-1', 'PAY-1')

    expect(result.success).toBe(true)
    expect(result.order?.status).toBe('paid')
    // B1:token 充值订单支付成功后加 token(amount=100)
    expect(marginOf('U1')?.tokenQuantity).toBe(100)
    // tokenFlows 有一条 relatedOrderNo=ORD-1 的充值记录(opType=0=充值)
    const rechargeFlow = getRows(tokenFlows).find(
      (r) => r.relatedOrderNo === 'ORD-1' && r.opType === 0,
    )
    expect(rechargeFlow).toBeDefined()
    expect(rechargeFlow!.quantity).toBe(100)
  })

  it('orderType=1(membership)订单支付成功后,不充值 token(只激活 VIP)', async () => {
    ordersStore.push({
      id: 'ord-2',
      orderNo: 'ORD-2',
      userId: 'U2',
      amount: 100,
      orderType: 1,
      status: 'pending',
      productId: null,
    })

    const result = await completeOrderWithSaga('ORD-2', 'PAY-2')

    expect(result.success).toBe(true)
    expect(result.order?.status).toBe('paid')
    // B1:orderType=1 不是 token 充值订单,不调 rechargeToken
    expect(marginOf('U2')).toBeUndefined()
    expect(getRows(tokenFlows).filter((r) => r.relatedOrderNo === 'ORD-2')).toHaveLength(0)
  })

  it('重复回调(saga 幂等)不重复充值', async () => {
    ordersStore.push({
      id: 'ord-3',
      orderNo: 'ORD-3',
      userId: 'U3',
      amount: 100,
      orderType: 2,
      status: 'pending',
      productId: null,
    })

    await completeOrderWithSaga('ORD-3', 'PAY-3')
    // 第二次回调:订单已 paid,completeOrderWithSaga 走幂等早返回(B3),不再触发 rechargeToken
    await completeOrderWithSaga('ORD-3', 'PAY-3')

    expect(marginOf('U3')?.tokenQuantity).toBe(100)
    // tokenFlows 只有一条充值记录(unique 索引 + 状态机早返回双重保险)
    expect(
      getRows(tokenFlows).filter((r) => r.relatedOrderNo === 'ORD-3' && r.opType === 0),
    ).toHaveLength(1)
  })
})

// ============================================================================
// 场景 2:退款退还 token(验证 Bug B2 修复)
// ============================================================================
describe('资金链路:退款退 token(Bug B2)', () => {
  it('token 订单退款后,userMargins.tokenQuantity 恢复', async () => {
    ordersStore.push({
      id: 'ord-4',
      orderNo: 'ORD-4',
      userId: 'U4',
      amount: 50,
      orderType: 2,
      status: 'paid',
      productId: null,
    })
    // U4 已充值 50(模拟支付成功后的余额)
    getRows(userMargins).push({
      userId: 'U4',
      tokenQuantity: 50,
      frozenQuantity: 0,
      updatedAt: new Date(),
    })
    // 已有一条充值流水(模拟支付时写入)
    getRows(tokenFlows).push({
      id: 'tf-1',
      userId: 'U4',
      opType: 0,
      quantity: 50,
      balanceAfter: 50,
      remark: '充值',
      relatedOrderNo: 'ORD-4',
      createdAt: new Date(),
    })

    const result = await refundOrder('ORD-4')

    expect(result.success).toBe(true)
    expect(result.order?.status).toBe('refunded')
    // B2:退款扣回 token(50 → 0,refundTokenDeduct 尽力扣回)
    expect(marginOf('U4')?.tokenQuantity).toBe(0)
    // B2:用 refund:ORD-4 作幂等键,opType=3 表示退款扣回,与充值流水(ORD-4)不冲突
    const refundFlow = getRows(tokenFlows).find(
      (r) => r.relatedOrderNo === 'refund:ORD-4' && r.opType === 3,
    )
    expect(refundFlow).toBeDefined()
    expect(refundFlow!.quantity).toBe(50)
  })

  it('重复退款不重复退还(幂等,状态机守卫)', async () => {
    ordersStore.push({
      id: 'ord-5',
      orderNo: 'ORD-5',
      userId: 'U5',
      amount: 50,
      orderType: 2,
      status: 'paid',
      productId: null,
    })
    getRows(userMargins).push({
      userId: 'U5',
      tokenQuantity: 50,
      frozenQuantity: 0,
      updatedAt: new Date(),
    })

    await refundOrder('ORD-5')
    // 第二次:订单已 refunded,status !== 'paid' → refundOrder 返回失败,不再退 token
    const second = await refundOrder('ORD-5')

    expect(second.success).toBe(false)
    // tokenQuantity 只扣回一次(50 → 0,不是 -50)
    expect(marginOf('U5')?.tokenQuantity).toBe(0)
  })
})

// ============================================================================
// 场景 3:提现驳回退冻结(验证 Bug A1 修复)
// ============================================================================
describe('资金链路:提现驳回退冻结(Bug A1)', () => {
  it('rejectWithdrawal 后,tokenQuantity 恢复 + frozenQuantity 释放', async () => {
    // U6 申请提现 30 后的余额状态(applyWithdrawal 已 token -= 30, frozen += 30)
    getRows(userMargins).push({
      userId: 'U6',
      tokenQuantity: 70,
      frozenQuantity: 30,
      updatedAt: new Date(),
    })
    getRows(withdrawalFlows).push({
      id: '1',
      userId: 'U6',
      amount: 30,
      fee: 0,
      originalAmount: 30,
      status: 0,
      method: 'wechat',
      accountInfo: {},
      partnerTradeNo: 'WD1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const flow = await rejectWithdrawal('1', '信息不全', 'admin')

    // A1:驳回后 flow.status=3(failed)
    expect(flow).toBeDefined()
    expect(flow!.status).toBe(3)
    expect(flow!.rejectReason).toBe('信息不全')
    // A1:tokenQuantity 退还(70 → 100),frozenQuantity 释放(30 → 0)
    expect(marginOf('U6')?.tokenQuantity).toBe(100)
    expect(marginOf('U6')?.frozenQuantity).toBe(0)
  })

  it('驳回非 pending 状态的提现失败(状态机守卫,返回 undefined)', async () => {
    // status=1(processing),不是 pending(0)
    getRows(withdrawalFlows).push({
      id: '2',
      userId: 'U7',
      amount: 30,
      fee: 0,
      originalAmount: 30,
      status: 1,
      method: 'wechat',
      accountInfo: {},
      partnerTradeNo: 'WD2',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    getRows(userMargins).push({
      userId: 'U7',
      tokenQuantity: 70,
      frozenQuantity: 30,
      updatedAt: new Date(),
    })

    // A1:条件 UPDATE status=0→3 不匹配(当前 status=1)→ 0 行影响 → 返回 undefined
    const flow = await rejectWithdrawal('2', '原因', 'admin')

    expect(flow).toBeUndefined()
    // 余额未变(未退还冻结)
    expect(marginOf('U7')?.tokenQuantity).toBe(70)
    expect(marginOf('U7')?.frozenQuantity).toBe(30)
  })
})

// ============================================================================
// 场景 4:佣金入账(验证 Bug A3 修复)
// ============================================================================
describe('资金链路:佣金入账(Bug A3)', () => {
  it('createCommissionFlow 后,userMargins.tokenQuantity 增加', async () => {
    // U8 初始无 margin(createCommissionFlow 内部 onConflictDoUpdate 会 UPSERT 创建)

    const flow = await createCommissionFlow(
      { beneficiaryId: 'U8', amount: 0, token: 20, type: 0, remark: '父级返佣' },
      null,
    )

    // A3:commissionFlows 有记录(status=1 已发放)
    expect(flow).toBeDefined()
    expect(flow.beneficiaryId).toBe('U8')
    expect(flow.token).toBe(20)
    expect(flow.status).toBe(1)
    // A3:userMargins.tokenQuantity 累加入账(0 → 20)
    expect(marginOf('U8')?.tokenQuantity).toBe(20)
    expect(getRows(commissionFlows).filter((r) => r.beneficiaryId === 'U8')).toHaveLength(1)
  })

  it('token=0 的佣金不入账(守卫:input.token > 0)', async () => {
    // 注:被测函数 createCommissionFlow 硬编码 status=1(不接受 status 入参),
    // 其入账守卫为 `if (flow && input.token > 0)`。故 "不入账" 场景用 token=0 验证该守卫。
    getRows(userMargins).push({
      userId: 'U9',
      tokenQuantity: 5,
      frozenQuantity: 0,
      updatedAt: new Date(),
    })

    const flow = await createCommissionFlow(
      { beneficiaryId: 'U9', amount: 100, token: 0, type: 1, remark: '现金佣金' },
      null,
    )

    expect(flow).toBeDefined()
    expect(flow.token).toBe(0)
    // A3 守卫:token=0 不入 token 钱包(余额不变)
    expect(marginOf('U9')?.tokenQuantity).toBe(5)
  })

  it('多次佣金入账累加(UPSERT onConflictDoUpdate)', async () => {
    // 验证 A3 的 onConflictDoUpdate 路径:已有 margin 时累加,而非覆盖
    getRows(userMargins).push({
      userId: 'U10',
      tokenQuantity: 10,
      frozenQuantity: 0,
      updatedAt: new Date(),
    })

    await createCommissionFlow({ beneficiaryId: 'U10', amount: 0, token: 5, type: 0 }, null)
    await createCommissionFlow({ beneficiaryId: 'U10', amount: 0, token: 8, type: 0 }, null)

    // 10 + 5 + 8 = 23(累加,不是覆盖)
    expect(marginOf('U10')?.tokenQuantity).toBe(23)
    expect(getRows(commissionFlows).filter((r) => r.beneficiaryId === 'U10')).toHaveLength(2)
  })
})

// ============================================================================
// 场景 5:approveWithdrawal 状态机(验证 Bug A2 修复)
// ============================================================================
describe('资金链路:approveWithdrawal 状态机(Bug A2)', () => {
  it('approveWithdrawal 将 status 0→1(processing),不是 0→2', async () => {
    getRows(withdrawalFlows).push({
      id: '3',
      userId: 'U11',
      amount: 50,
      fee: 1,
      originalAmount: 51,
      status: 0,
      method: 'wechat',
      accountInfo: {},
      partnerTradeNo: 'WD3',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const flow = await approveWithdrawal('3', 'admin')

    // A2:status 变为 1(processing),不是 2(completed)
    expect(flow).toBeDefined()
    expect(flow!.status).toBe(1)
    expect(flow!.updatedBy).toBe('admin')
  })

  it('approveWithdrawal 非 pending 状态失败(条件 UPDATE 0 行 → undefined)', async () => {
    // status=2(completed),不能再次审批
    getRows(withdrawalFlows).push({
      id: '4',
      userId: 'U12',
      amount: 50,
      fee: 1,
      originalAmount: 51,
      status: 2,
      method: 'wechat',
      accountInfo: {},
      partnerTradeNo: 'WD4',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const flow = await approveWithdrawal('4', 'admin')

    // A2:条件 UPDATE status=0→1 不匹配(当前 status=2)→ 0 行 → undefined
    expect(flow).toBeUndefined()
    // 状态不变
    const row = getRows(withdrawalFlows).find((r) => r.id === '4')
    expect(row?.status).toBe(2)
  })
})
