// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/**
 * F-66 回归(P2):管理端批量取消订单
 *
 * 票面缺陷:`POST /api/admin/orders/batch-cancel` 先用 `dbRead`(读副本)筛 pending,
 * 随后 `UPDATE ... WHERE id IN (cancellableIds)` 不带 status 谓词,且 edu_orders 与统一
 * orders 两次 UPDATE 不在同一事务内。预读与写之间被支付回调改成 paid 的订单仍会被
 * 写成 cancelled;第二张表失败还会留下半截状态。
 *
 * 本文件不连库:整体替身 `src/db/index.js`(与 g134-batch4 同款方法链替身),只观测
 * 路由发出的语句形状(是否主库 / 是否在事务内 / WHERE 是否带 status='pending' / 是否
 * RETURNING)与库回执驱动的响应。判据实现全在业务代码侧,本文件不复制守门正则。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

interface SqlCall {
  op: 'select' | 'update' | 'insert' | 'delete'
  /** 'db' = 主库;'dbRead' = 读副本代理 */
  source: 'db' | 'dbRead'
  /** 该语句是否在 db.transaction 回调内发出 */
  inTx: boolean
  whereArg: unknown
  returningRequested: boolean
}

const { state, mockLogAction } = vi.hoisted(() => ({
  mockLogAction: vi.fn(),
  state: {
    calls: [] as SqlCall[],
    selectRows: [] as unknown[],
    updateRows: [] as unknown[][],
    /** 第几次 db.update(...) 调用(从 1 起),用于按序回放库回执/注入失败 */
    updateSeq: 0,
    /** 第 N 次 update 的 thenable 直接 reject(模拟第二张表写失败) */
    failUpdateIndex: 0,
    txDepth: 0,
    txStarted: 0,
    txCommitted: 0,
    txRolledBack: 0,
  },
}))

vi.mock('../src/db/index.js', () => {
  const build = (op: SqlCall['op'], source: SqlCall['source']): Record<string, unknown> => {
    const entry: SqlCall = {
      op,
      source,
      inTx: state.txDepth > 0,
      whereArg: undefined,
      returningRequested: false,
    }
    state.calls.push(entry)
    const updateIndex = op === 'update' ? state.updateSeq + 1 : 0
    if (op === 'update') state.updateSeq = updateIndex

    const chain: Record<string, unknown> = {}
    const self = (): Record<string, unknown> => chain
    for (const m of [
      'from',
      'set',
      'values',
      'orderBy',
      'groupBy',
      'limit',
      'offset',
      'for',
      'innerJoin',
      'leftJoin',
      'onConflictDoNothing',
      'onConflictDoUpdate',
    ]) {
      chain[m] = self
    }
    chain.where = (arg: unknown): Record<string, unknown> => {
      entry.whereArg = arg
      return chain
    }
    chain.returning = (): Record<string, unknown> => {
      entry.returningRequested = true
      return chain
    }
    chain.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ): Promise<unknown> => {
      let result: Promise<unknown>
      if (op === 'select') {
        result = Promise.resolve(state.selectRows)
      } else if (op === 'update') {
        result =
          state.failUpdateIndex === updateIndex
            ? Promise.reject(new Error('simulated unified orders update failure'))
            : Promise.resolve(state.updateRows[updateIndex - 1] ?? [])
      } else {
        result = Promise.resolve([])
      }
      return result.then(onFulfilled, onRejected)
    }
    return chain
  }

  const db = {
    select: () => build('select', 'db'),
    update: () => build('update', 'db'),
    insert: () => build('insert', 'db'),
    delete: () => build('delete', 'db'),
    execute: () => Promise.resolve([]),
    transaction: async (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => {
      state.txStarted += 1
      state.txDepth += 1
      try {
        const result = await fn(db)
        state.txCommitted += 1
        return result
      } catch (err) {
        state.txRolledBack += 1
        throw err
      } finally {
        state.txDepth -= 1
      }
    },
  }
  const dbRead = {
    select: () => build('select', 'dbRead'),
    update: () => build('update', 'dbRead'),
    insert: () => build('insert', 'dbRead'),
    delete: () => build('delete', 'dbRead'),
    execute: () => Promise.resolve([]),
    transaction: async (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => fn(dbRead),
  }
  return { db, dbRead, dbClient: {}, returningOne: vi.fn() }
})

vi.mock('../src/plugins/auth.js', () => {
  // 替身里的测试主体 id 必须是字面量:工厂在模块图初始化期就会被调用,引用后声明的常量会踩 TDZ。
  const principal = {
    userId: '00000000-0000-4000-8000-000000000066',
    phone: '',
    familyId: 'fam-f66',
    roleId: 1,
  }
  const attach = (request: { userId?: string; jwtPayload?: unknown }): void => {
    request.userId = principal.userId
    request.jwtPayload = principal
  }
  return {
    authenticate: async (request: { userId?: string; jwtPayload?: unknown }) => {
      attach(request)
      return principal
    },
    checkAuth: async (request: { userId?: string; jwtPayload?: unknown }) => {
      attach(request)
      return true
    },
    requireActiveUser: async (): Promise<void> => undefined,
  }
})

vi.mock('../src/db/rbac-queries.js', () => ({
  checkPermission: async (): Promise<boolean> => false,
  checkAnyPermission: async (): Promise<boolean> => false,
}))

vi.mock('../src/services/audit-service.js', () => ({ logAction: mockLogAction }))

import { adminOrderRoutes } from '../src/routes/order.js'

const ADMIN_PREFIX = '/api/admin'
const O1 = '11111111-1111-4111-8111-111111111111'
const O2 = '22222222-2222-4222-8222-222222222222'
const O3 = '33333333-3333-4333-8333-333333333333'

const dialect = new PgDialect()

function compileWhere(call: SqlCall): { sql: string; paramsText: string } {
  expect(call.whereArg).toBeTruthy()
  const q = dialect.sqlToQuery(call.whereArg as SQL)
  return { sql: q.sql, paramsText: JSON.stringify(q.params) }
}

function updates(): SqlCall[] {
  return state.calls.filter((c) => c.op === 'update')
}

describe('F-66 批量取消:主库事务 + status=pending 条件更新 + RETURNING 为准', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err: FastifyError, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : err.message,
      })
    })
    await server.register(adminOrderRoutes, { prefix: ADMIN_PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    state.calls.length = 0
    state.selectRows = []
    state.updateRows = []
    state.updateSeq = 0
    state.failUpdateIndex = 0
    state.txDepth = 0
    state.txStarted = 0
    state.txCommitted = 0
    state.txRolledBack = 0
    mockLogAction.mockReset()
    mockLogAction.mockResolvedValue(undefined)
  })

  function cancel(ids: string[]) {
    return server.inject({
      method: 'POST',
      url: `${ADMIN_PREFIX}/orders/batch-cancel`,
      payload: { ids },
    })
  }

  it('判态与两条 UPDATE 都在主库同一事务内发出,全程不碰 dbRead(读副本)', async () => {
    state.selectRows = [{ id: O1, status: 'pending' }]
    state.updateRows = [[{ id: O1 }], [{ id: O1 }]]

    const res = await cancel([O1])
    expect(res.statusCode).toBe(200)
    expect(res.json().data.cancelled).toBe(1)
    expect(res.json().data.skipped).toEqual([])

    expect(state.calls.filter((c) => c.source === 'dbRead')).toEqual([])
    expect(state.txStarted).toBe(1)
    expect(state.txCommitted).toBe(1)
    const writesAndReads = state.calls.filter((c) => c.op === 'select' || c.op === 'update')
    expect(writesAndReads.length).toBe(3)
    expect(writesAndReads.every((c) => c.inTx)).toBe(true)
  })

  it('两条 UPDATE 的 WHERE 都带 status = pending 条件且都要求 RETURNING', async () => {
    state.selectRows = [{ id: O1, status: 'pending' }]
    state.updateRows = [[{ id: O1 }], [{ id: O1 }]]

    await cancel([O1])

    const updateCalls = updates()
    expect(updateCalls.length).toBe(2)
    for (const call of updateCalls) {
      expect(call.returningRequested).toBe(true)
      const { sql, paramsText } = compileWhere(call)
      expect(sql).toContain('status')
      expect(paramsText).toContain('pending')
    }
  })

  it('cancelled 以库回 RETURNING 为准:请求 2 条、库只确认 1 条 ⇒ 1 + missedIds 点名', async () => {
    state.selectRows = [
      { id: O1, status: 'pending' },
      { id: O2, status: 'pending' },
    ]
    state.updateRows = [[{ id: O1 }], [{ id: O1 }]]

    const res = await cancel([O1, O2])
    const body = res.json()
    expect(body.data.cancelled).toBe(1)
    expect(body.data.missedIds).toEqual([O2])
    expect(body.data.skipped).toEqual([])
  })

  it('预读已是 paid 的订单不进入 UPDATE 集合(只进 skipped)', async () => {
    state.selectRows = [
      { id: O1, status: 'paid' },
      { id: O2, status: 'pending' },
    ]
    state.updateRows = [[{ id: O2 }], [{ id: O2 }]]

    const res = await cancel([O1, O2])
    const body = res.json()
    expect(body.data.cancelled).toBe(1)
    expect(body.data.skipped).toEqual([{ id: O1, reason: '状态 paid 不可取消' }])

    const firstWhere = compileWhere(updates()[0]!)
    expect(firstWhere.paramsText).toContain(O2)
    expect(firstWhere.paramsText).not.toContain(O1)
  })

  it('预读后订单已被支付回调改态(条件更新 0 命中)⇒ cancelled=0,不按旧集合记账', async () => {
    state.selectRows = [
      { id: O1, status: 'pending' },
      { id: O2, status: 'pending' },
    ]
    state.updateRows = [[], []]

    const res = await cancel([O1, O2])
    const body = res.json()
    expect(body.data.cancelled).toBe(0)
    expect(body.data.missedIds).toEqual([O1, O2])
    // 第一张表零命中 ⇒ 不再发第二张表的 UPDATE
    expect(updates().length).toBe(1)
  })

  it('第二张表 UPDATE 失败 ⇒ 整个事务回滚,请求 500 而非"成功改动"', async () => {
    state.selectRows = [{ id: O1, status: 'pending' }]
    state.updateRows = [[{ id: O1 }], [{ id: O1 }]]
    state.failUpdateIndex = 2

    const res = await cancel([O1])
    expect(res.statusCode).toBe(500)
    expect(state.txRolledBack).toBe(1)
    expect(state.txCommitted).toBe(0)
    expect(res.json().data).toBeUndefined()
  })

  it('全部不可取消时:一个 UPDATE 都不发,仍回 200 + skipped 全量', async () => {
    state.selectRows = [
      { id: O1, status: 'paid' },
      { id: O3, status: 'cancelled' },
    ]

    const res = await cancel([O1, O3])
    const body = res.json()
    expect(res.statusCode).toBe(200)
    expect(body.data.cancelled).toBe(0)
    expect(body.data.skipped).toEqual([
      { id: O1, reason: '状态 paid 不可取消' },
      { id: O3, reason: '状态 cancelled 不可取消' },
    ])
    expect(updates().length).toBe(0)
  })
})
