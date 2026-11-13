// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-457 回归锁(2026-11-14,缺陷票 docs/tickets/2026-11/findings-api.md#F-457)。
 *
 * 病灶:withdrawal_flows.status 语义分裂 —— 主链路驳回写 3(schema 口径 failed),商城后台
 * 驳回写 4;资金审核统计又把 rejected 只算 status=3,导致四类计数之和 < 总数、主链路驳回单
 * 在商城后台按 rejected 筛选查不到。
 *
 * 本文件用 mock db 捕获 SQL 过滤条件(不连真实 PG),锁:
 *   ① 统计四类计数覆盖 0/1/2/其余全部状态:驳回(3)与历史遗留(4)都计入 rejected,每个状态恰命中一个桶;
 *   ② 商城后台驳回只写统一状态 3,不再写 4;
 *   ③ 按 rejected/failed 筛选同时覆盖 3 与历史 4。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

type Compiled = { sql: string; params: unknown[] }

const H = vi.hoisted(() => ({
  statFields: [] as Array<Record<string, Compiled>>,
  whereClauses: [] as Compiled[],
  statusWrites: [] as number[],
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'admin-1'
  }),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'admin-1'
  }),
}))

vi.mock('../src/services/two-factor-step-up-store.js', () => ({
  requireStepUpForTwoFactorUser: vi.fn(async () => ({ ok: true, enforced: false })),
}))

vi.mock('../src/db/commission-queries.js', () => ({
  applyWithdrawal: vi.fn(),
  approveWithdrawal: vi.fn(),
  rejectWithdrawal: vi.fn(),
}))

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()
  function compile(node: unknown): Compiled {
    try {
      const q = dialect.sqlToQuery(node as Parameters<PgDialect['sqlToQuery']>[0])
      return { sql: q.sql, params: q.params as unknown[] }
    } catch {
      return { sql: '', params: [] }
    }
  }

  function makeSelectChain(result: unknown[]): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    for (const method of ['from', 'leftJoin', 'orderBy', 'limit', 'offset', 'groupBy'])
      chain[method] = () => chain
    chain.where = (condition: unknown) => {
      H.whereClauses.push(compile(condition))
      return chain
    }
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject)
    return chain
  }

  const tableName = (table: unknown): string =>
    (table as Record<symbol, string> | undefined)?.[Symbol.for('drizzle:Name')] ?? ''

  // 商城提现列表的 select 形状是 { w, username, nickname },路由会用 mapWithdrawal 读 w 的字段
  const withdrawalListRow = {
    w: {
      id: 'w-1',
      userId: 'u-1',
      amount: 100,
      fee: 0,
      originalAmount: 100,
      status: 3,
      method: 'alipay',
      accountInfo: null,
      partnerTradeNo: 'WD1',
      rejectReason: null,
      createdAt: new Date(0),
      processedAt: null,
    },
    username: 'u1',
    nickname: null,
  }

  const db = {
    select: (fields?: Record<string, unknown>) => {
      if (fields) {
        const compiled: Record<string, Compiled> = {}
        for (const [key, value] of Object.entries(fields)) compiled[key] = compile(value)
        H.statFields.push(compiled)
      }
      return makeSelectChain(fields && 'w' in fields ? [withdrawalListRow] : [{ count: 0 }])
    },
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          if ('status' in values) H.statusWrites.push(Number(values.status))
          const row =
            tableName(table) === 'withdrawal_flows'
              ? [{ id: 'w-1', userId: 'u-1', amount: 100, fee: 0, status: values.status }]
              : [{ userId: 'u-1' }]
          return { returning: async () => row }
        },
      }),
    }),
    insert: () => ({ values: () => ({ returning: async () => [] }) }),
    delete: () => ({ where: async () => [] }),
    execute: async () => [],
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  }
  return { db, dbRead: db, dbClient: {} }
})

import { financeExtendedRoutes } from '../src/routes/finance-extended.js'
import { adminShopRoutes } from '../src/routes/admin-shop-routes.js'

/** 用编译后的 SQL 文本判断某个状态是否落在该统计桶里 */
function bucketMatches(text: string, status: number): boolean {
  const notIn = text.match(/not\s+in\s*\(([^)]*)\)/i)
  if (notIn) {
    const excluded = notIn[1]!.split(',').map((v) => Number(v.trim()))
    return !excluded.includes(status)
  }
  const eq = text.match(/status"?\s*=\s*(\d+)/i)
  return eq !== null && Number(eq[1]) === status
}

describe('F-457 提现状态语义统一与资金统计不缺项', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(financeExtendedRoutes, { prefix: '/api' })
    await app.register(adminShopRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    H.statFields.length = 0
    H.whereClauses.length = 0
    H.statusWrites.length = 0
  })

  it('① 统计四类计数覆盖所有状态:驳回(3)与历史遗留(4)都计入 rejected', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/finance/fund/audit/list' })
    expect(res.statusCode).toBe(200)

    const stats = H.statFields.find((fields) => 'rejectedCount' in fields)
    expect(stats).toBeTruthy()
    const buckets = ['pendingCount', 'processingCount', 'completedCount', 'rejectedCount'] as const
    const text = (key: (typeof buckets)[number]) => stats![key]!.sql

    // 前三个桶按 0/1/2 精确计数
    expect(bucketMatches(text('pendingCount'), 0)).toBe(true)
    expect(bucketMatches(text('processingCount'), 1)).toBe(true)
    expect(bucketMatches(text('completedCount'), 2)).toBe(true)
    // rejected 必须是"其余全部终态",而不是只认 3 —— 否则历史 4 漏计
    expect(text('rejectedCount')).toMatch(/not\s+in\s*\(\s*0\s*,\s*1\s*,\s*2\s*\)/i)

    // 覆盖性:0/1/2/3/4 每个状态都恰好命中一个桶,四类之和 = 总数(不再缺项)
    for (const status of [0, 1, 2, 3, 4]) {
      const hits = buckets.filter((key) => bucketMatches(text(key), status))
      expect(hits, `status=${status} 应恰好命中一个统计桶`).toHaveLength(1)
    }
  })

  it('② 商城后台驳回只写统一状态 3,不再写分裂的 4', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/shop/withdrawals/w-1/reject',
      payload: { notes: '资料不符' },
    })
    expect(res.statusCode).toBe(200)
    expect(H.statusWrites).toEqual([3])
  })

  it('③ 按 rejected/failed 筛选同时覆盖 3 与历史 4', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/shop/withdrawals?status=rejected',
    })
    expect(res.statusCode).toBe(200)

    const filter = H.whereClauses.find(
      (clause) => /status"?\s+in\s*\(/i.test(clause.sql) && clause.params.length > 0,
    )
    expect(filter).toBeTruthy()
    expect(filter!.params).toEqual(expect.arrayContaining([3, 4]))
  })
})
