// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-455 回归锁(2026-11-13,缺陷票 docs/tickets/2026-11/findings-api.md#F-455)。
 *
 * 病灶:POST /api/admin/shop/withdrawals 直插 withdrawal_flows,不校验也不扣减用户可用余额
 * (还可自定 status);DELETE /:id 直接删行,申请时已扣的 token 与已冻结额双双蒸发。
 *
 * 本文件锁:
 *   ① 新增:事务内校验余额并 tokenQuantity -= amount / frozenQuantity += amount,写 CONSUME 负向流水;
 *   ② 余额不足:409,零写库(不建单、不扣款);
 *   ③ 新增时指定非 pending 状态:400,零写库(禁止凭空造出已完成提现单);
 *   ④ 删除 pending:按申请额退回可用余额并释放冻结;
 *   ⑤ 重复删除:200 deleted=false,不重复退款(幂等);
 *   ⑥ 已完成的提现单:409,不删除也不退款。
 *
 * 只 mock db / requireAdmin,用状态化假事务驱动真实路由,不连真实 PG。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

const H = vi.hoisted(() => ({
  userId: '11111111-1111-4111-8111-111111111111',
  adminId: '22222222-2222-4222-8222-222222222222',
  margin: { tokenQuantity: 0, frozenQuantity: 0 },
  flows: [] as Array<Record<string, unknown>>,
  tokenFlows: [] as Array<Record<string, unknown>>,
  seq: 0,
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async (request: { userId?: string }) => {
    request.userId = H.adminId
  }),
}))

/**
 * 状态化假 DB:按 drizzle 表名分派,把 SQL 模板里的增减量落到内存账本,
 * 并复刻 DB 级 WHERE(token_quantity/frozen_quantity >= 阈值)的守卫语义。
 */
vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()
  const tableName = (table: unknown): string =>
    (table as Record<symbol, string> | undefined)?.[Symbol.for('drizzle:Name')] ?? ''

  function compile(node: unknown) {
    return dialect.sqlToQuery(node as Parameters<PgDialect['sqlToQuery']>[0])
  }
  function numbersIn(node: unknown): number[] {
    return compile(node).params.filter((p): p is number => typeof p === 'number')
  }
  function stringsIn(node: unknown): string[] {
    return compile(node).params.filter((p): p is string => typeof p === 'string')
  }
  function applyExpr(expr: unknown, current: number): number {
    if (typeof expr === 'number') return expr
    if (!expr || typeof expr !== 'object') return current
    const compiled = compile(expr)
    const nums = compiled.params.filter((p): p is number => typeof p === 'number')
    const amount = nums.length > 0 ? nums[nums.length - 1]! : 0
    if (/\+\s*\$\d+/.test(compiled.sql)) return current + amount
    if (/-\s*\$\d+/.test(compiled.sql)) return current - amount
    return current
  }

  function selectRows(table: string): unknown[] {
    if (table === 'user_margins') return [{ userId: H.userId, ...H.margin, updatedAt: new Date() }]
    if (table === 'withdrawal_flows') return H.flows.map((f) => ({ ...f }))
    return []
  }

  function tableQuery(table: string) {
    const settle = {
      for: () => settle,
      limit: async () => selectRows(table),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(selectRows(table)).then(resolve, reject),
    }
    return {
      where: () => settle,
      for: () => settle,
      limit: async () => selectRows(table),
      then: settle.then,
    }
  }

  function applyMarginUpdate(values: Record<string, unknown>, condition: unknown): unknown[] {
    const cond = compile(condition)
    const threshold = numbersIn(condition)[0] ?? 0
    // DB 级 WHERE:守卫列余额不足 ⇒ 0 行(防超发)
    if (/token_quantity/.test(cond.sql) && H.margin.tokenQuantity < threshold) return []
    if (/frozen_quantity/.test(cond.sql) && H.margin.frozenQuantity < threshold) return []
    const nextToken =
      values.tokenQuantity === undefined
        ? H.margin.tokenQuantity
        : applyExpr(values.tokenQuantity, H.margin.tokenQuantity)
    const nextFrozen =
      values.frozenQuantity === undefined
        ? H.margin.frozenQuantity
        : applyExpr(values.frozenQuantity, H.margin.frozenQuantity)
    if (nextToken < 0 || nextFrozen < 0) return []
    H.margin.tokenQuantity = nextToken
    H.margin.frozenQuantity = nextFrozen
    return [{ userId: H.userId, tokenQuantity: nextToken, frozenQuantity: nextFrozen }]
  }

  const db = {
    select: () => ({ from: (table: unknown) => tableQuery(tableName(table)) }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (condition: unknown) => {
          const rows =
            tableName(table) === 'user_margins' ? applyMarginUpdate(values, condition) : []
          const pending = Promise.resolve(rows) as Promise<unknown[]> & {
            returning: (selector?: unknown) => Promise<unknown[]>
          }
          pending.returning = async (selector?: unknown) => {
            if (tableName(table) !== 'user_margins' || !selector) return rows
            return rows.map((r) => ({
              tokenQuantity: (r as { tokenQuantity: number }).tokenQuantity,
            }))
          }
          return pending
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        const name = tableName(table)
        const rows: unknown[] = []
        if (name === 'withdrawal_flows') {
          const row = { id: `flow-${++H.seq}`, createdAt: new Date(), ...values }
          H.flows.push(row)
          rows.push(row)
        } else if (name === 'token_flows') {
          H.tokenFlows.push(values)
        }
        const pending = Promise.resolve(rows) as Promise<unknown[]> & {
          returning: () => Promise<unknown[]>
        }
        pending.returning = async () => rows
        return pending
      },
    }),
    delete: (table: unknown) => ({
      where: async (condition: unknown) => {
        if (tableName(table) !== 'withdrawal_flows') return []
        const ids = stringsIn(condition)
        H.flows = H.flows.filter((f) => !ids.includes(f.id as string))
        return ids.map((id) => ({ id }))
      },
    }),
    execute: async () => [],
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  }
  return { db, dbRead: db, dbClient: {} }
})

import { adminShopRoutes } from '../src/routes/admin-shop-routes.js'

const AUTH = { authorization: 'Bearer admin-token' }

describe('F-455 管理端新增/删除提现单必须与资金动作对称', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminShopRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    H.margin = { tokenQuantity: 0, frozenQuantity: 0 }
    H.flows = []
    H.tokenFlows = []
    H.seq = 0
  })

  const post = (payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/api/admin/shop/withdrawals',
      headers: AUTH,
      payload,
    })

  const del = (id: string) =>
    app.inject({
      method: 'DELETE',
      url: `/api/admin/shop/withdrawals/${id}`,
      headers: AUTH,
    })

  it('① 新增:可用余额扣减、等额冻结,并写 CONSUME 负向流水', async () => {
    H.margin = { tokenQuantity: 1000, frozenQuantity: 0 }

    const res = await post({
      user: H.userId,
      amount: 300,
      channel: 'alipay',
      account: 'acc@alipay.com',
    })

    expect(res.statusCode).toBe(201)
    expect(H.margin).toEqual({ tokenQuantity: 700, frozenQuantity: 300 })
    expect(H.flows).toHaveLength(1)
    expect(H.flows[0]).toMatchObject({
      userId: H.userId,
      amount: 300,
      originalAmount: 300,
      status: 0,
      method: 'alipay',
    })
    expect(String(H.flows[0]!.partnerTradeNo)).toMatch(/^ADMWD\d+-/)
    const ledger = H.tokenFlows.find((f) => f.remark === '管理端提现申请')
    expect(ledger).toMatchObject({ quantity: -300, balanceAfter: 700 })
  })

  it('② 余额不足:409,且零写库(不建单、不扣款)', async () => {
    H.margin = { tokenQuantity: 200, frozenQuantity: 0 }

    const res = await post({
      user: H.userId,
      amount: 300,
      channel: 'alipay',
      account: 'acc@alipay.com',
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe(409)
    expect(H.margin).toEqual({ tokenQuantity: 200, frozenQuantity: 0 })
    expect(H.flows).toHaveLength(0)
    expect(H.tokenFlows).toHaveLength(0)
  })

  it('③ 新增时指定非 pending 状态:400,零写库', async () => {
    H.margin = { tokenQuantity: 1000, frozenQuantity: 0 }

    const res = await post({
      user: H.userId,
      amount: 300,
      channel: 'alipay',
      account: 'acc@alipay.com',
      status: 'completed',
    })

    expect(res.statusCode).toBe(400)
    expect(H.margin).toEqual({ tokenQuantity: 1000, frozenQuantity: 0 })
    expect(H.flows).toHaveLength(0)
  })

  it('④ 删除 pending:退回可用余额并释放冻结', async () => {
    H.margin = { tokenQuantity: 700, frozenQuantity: 300 }
    H.flows = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        userId: H.userId,
        amount: 300,
        fee: 0,
        originalAmount: 300,
        status: 0,
      },
    ]

    const res = await del('33333333-3333-4333-8333-333333333333')

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ id: '33333333-3333-4333-8333-333333333333', deleted: true })
    expect(H.margin).toEqual({ tokenQuantity: 1000, frozenQuantity: 0 })
    expect(H.flows).toHaveLength(0)
  })

  it('⑤ 重复删除幂等:第二次 deleted=false,不再重复退款', async () => {
    H.margin = { tokenQuantity: 700, frozenQuantity: 300 }
    H.flows = [
      {
        id: '44444444-4444-4444-8444-444444444444',
        userId: H.userId,
        amount: 300,
        fee: 0,
        originalAmount: 300,
        status: 0,
      },
    ]

    const first = await del('44444444-4444-4444-8444-444444444444')
    expect(first.statusCode).toBe(200)
    expect(first.json().data.deleted).toBe(true)
    expect(H.margin).toEqual({ tokenQuantity: 1000, frozenQuantity: 0 })

    const second = await del('44444444-4444-4444-8444-444444444444')
    expect(second.statusCode).toBe(200)
    expect(second.json().data.deleted).toBe(false)
    expect(H.margin).toEqual({ tokenQuantity: 1000, frozenQuantity: 0 })
  })

  it('⑥ 已完成的提现单:409,不删除也不退款', async () => {
    H.margin = { tokenQuantity: 700, frozenQuantity: 300 }
    H.flows = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        userId: H.userId,
        amount: 300,
        fee: 0,
        originalAmount: 300,
        status: 2,
      },
    ]

    const res = await del('55555555-5555-4555-8555-555555555555')

    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe(409)
    expect(H.margin).toEqual({ tokenQuantity: 700, frozenQuantity: 300 })
    expect(H.flows).toHaveLength(1)
  })
})
