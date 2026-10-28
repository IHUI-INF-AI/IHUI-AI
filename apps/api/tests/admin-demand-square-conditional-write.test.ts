// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 批量审核「条件写」离线回归(2026-09-26 立,不连库:mock db 链式调用,走 Fastify 注入真实路由)。
//
// 缺陷:PUT/POST /batch-review 先 select 取 pendingIdSet(JS 快照),再 UPDATE ... where inArray(id,...)。
// 读与写之间不原子 —— 另一个管理员在两次 round-trip 之间把某条从 pending 改成 approved/rejected,
// 本条 UPDATE(只按 id 集合过滤)会无条件覆盖他的结论,并把 reviewedBy/reviewedAt 改写成第二个人。
//
// 修法:把 pending 条件写进 SQL 的 where —— and(inArray(id,...), eq(status,'pending')),
// 由数据库(而非 JS 快照)裁决哪些行仍是 pending,returning 只回报真被翻转的行,
// 未命中(含"并发已处理")一律进 missedIds。既有 batchWriteOutcome 出口与 results/missedIds 口径不变。
//
// 判据分工:
//  - 用例①/⑤:断言 UPDATE 的 where 片段(经 PgDialect 编译为 SQL)含 "status" 等值条件 ——
//    这是"条件写真的进了 SQL"的行为证明,不是仅断言"代码里写了 eq"。把条件摘掉 ⇒ ①/⑤ 必红。
//  - 用例②:库只翻转 2/3 ⇒ 未翻转那条 results=skipped、missedIds 点名它、日志 affected 与响应同源。
//  - 用例③:全命中 ⇒ missedIds 空数组、既有键名逐字不变。
//  - 用例④:读时就不是 pending 的 id ⇒ 仍走 skipped(不因新条件改变既有语义)。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'

const { mockUpdateRows, mockSelectRows, mockUpdateWhereArgs, loggerInfo, ADMIN_ID } = vi.hoisted(
  () => ({
    mockUpdateRows: vi.fn((): unknown[] => []),
    mockSelectRows: vi.fn((): unknown[] => []),
    /** 记录 UPDATE 链上 .where() 收到的 SQL 片段(不透明对象),由用例经 PgDialect 编译后断言 */
    mockUpdateWhereArgs: [] as unknown[],
    loggerInfo: vi.fn(),
    ADMIN_ID: '11111111-1111-4111-8111-111111111111',
  }),
)

vi.mock('../src/db/index.js', () => {
  const makeChain = (
    entry: 'select' | 'update' | 'insert' | 'delete',
    resolver: () => unknown[],
  ) => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'set', 'returning', 'values', 'orderBy', 'limit', 'offset']) {
      step[m] = vi.fn((arg?: unknown) => {
        // 只截 UPDATE 的 where —— 本票要证的是条件写进了 UPDATE 的 where
        if (entry === 'update' && m === 'where') mockUpdateWhereArgs.push(arg)
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject)
    return step
  }
  return {
    db: {
      select: vi.fn(() => makeChain('select', mockSelectRows)),
      update: vi.fn(() => makeChain('update', mockUpdateRows)),
      insert: vi.fn(() => makeChain('insert', () => [])),
      delete: vi.fn(() => makeChain('delete', () => [])),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
    },
    dbRead: { select: vi.fn(() => makeChain('select', mockSelectRows)) },
  }
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: { userId?: string }): Promise<void> => {
    request.userId = ADMIN_ID
  },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: loggerInfo, warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  setFastify: vi.fn(),
  serializeErrorFields: vi.fn((m: unknown) => m),
}))

import { adminDemandSquareRoutes } from '../src/routes/admin-demand-square.js'

const D1 = '11111111-1111-4111-8111-111111111111'
const D2 = '22222222-2222-4222-8222-222222222222'
const D3 = '33333333-3333-4333-8333-333333333333'

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(adminDemandSquareRoutes, { prefix: '/api/admin/demand-square' })
  await app.ready()
  return app
}

/** 把 UPDATE .where() 收到的片段编译成 SQL 文本(条件写有牙证明的核心:量的是 SQL 面,不是源码文本)。 */
function compiledUpdateWhereSql(): string {
  const arg = mockUpdateWhereArgs[mockUpdateWhereArgs.length - 1]
  if (arg === undefined) return ''
  // eq/and/inArray 构造出的即 drizzle SQL 表达式,PgDialect 可直接编译
  return new PgDialect().sqlToQuery(arg as Parameters<PgDialect['sqlToQuery']>[0]).sql
}

function expectConditionalWrite(): void {
  const sql = compiledUpdateWhereSql()
  // 断言其中存在 status 列的等值比较(条件写);摘掉 eq(status,'pending') 后这里必判红
  expect(sql).toMatch(/"status"\s*=\s*\$/)
  // 且仍保留按 id 集合过滤(inArray)
  expect(sql).toMatch(/"id"\s+in\s*\(/i)
}

describe('POST /demand-square/batch-review:UPDATE 必须带 pending 条件写(原子裁决)', () => {
  beforeEach(() => {
    mockUpdateRows.mockReturnValue([])
    mockSelectRows.mockReturnValue([])
    mockUpdateWhereArgs.length = 0
    loggerInfo.mockClear()
  })

  it('① 判据有牙:UPDATE 的 where 片段编译后含 status 等值条件', async () => {
    mockSelectRows.mockReturnValue([
      { id: D1, status: 'pending' },
      { id: D2, status: 'pending' },
    ])
    mockUpdateRows.mockReturnValue([{ id: D1 }, { id: D2 }])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/demand-square/batch-review',
      payload: { ids: [D1, D2], action: 'approve' },
    })
    expect(res.statusCode).toBe(200)
    // 走到这里 pendingIdSet 非空 ⇒ UPDATE 发了 ⇒ 记录了 where 片段
    expect(mockUpdateWhereArgs.length).toBe(1)
    expectConditionalWrite()
    await app.close()
  })

  it('② 库只翻转 2/3 ⇒ 未翻转那条 skipped、missedIds 点名它、日志 affected=2(与响应同源)', async () => {
    mockSelectRows.mockReturnValue([
      { id: D1, status: 'pending' },
      { id: D2, status: 'pending' },
      { id: D3, status: 'pending' },
    ])
    mockUpdateRows.mockReturnValue([{ id: D1 }, { id: D2 }])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/demand-square/batch-review',
      payload: { ids: [D1, D2, D3], action: 'approve' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.results).toEqual([
      { id: D1, status: 'approved' },
      { id: D2, status: 'approved' },
      { id: D3, status: 'skipped' },
    ])
    expect(body.data.missedIds).toEqual([D3])
    const logFields = loggerInfo.mock.calls[0]?.[1] as { affected: number } | undefined
    expect(logFields?.affected).toBe(2)
    await app.close()
  })

  it('③ 全命中 ⇒ missedIds 为空数组、既有键名逐字不变', async () => {
    mockSelectRows.mockReturnValue([
      { id: D1, status: 'pending' },
      { id: D2, status: 'pending' },
    ])
    mockUpdateRows.mockReturnValue([{ id: D1 }, { id: D2 }])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/demand-square/batch-review',
      payload: { ids: [D1, D2], action: 'reject', reason: '违规' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(body.data.results).toEqual([
      { id: D1, status: 'rejected' },
      { id: D2, status: 'rejected' },
    ])
    expect(body.data.missedIds).toEqual([])
    await app.close()
  })

  it('④ 读时就不是 pending 的 id ⇒ 仍走 skipped(不因新条件改变既有语义)', async () => {
    mockSelectRows.mockReturnValue([
      { id: D1, status: 'pending' },
      { id: D2, status: 'approved' },
    ])
    mockUpdateRows.mockReturnValue([{ id: D1 }])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/demand-square/batch-review',
      payload: { ids: [D1, D2], action: 'reject' },
    })
    const body = res.json()
    expect(body.data.results).toEqual([
      { id: D1, status: 'rejected' },
      { id: D2, status: 'skipped' },
    ])
    expect(body.data.missedIds).toEqual([D2])
    await app.close()
  })

  it('⑤ 并发已处理正例证明:读时报 pending、但条件写把该 id 挡在 returning 外 ⇒ 落 missedIds 且 where 带 status 条件', async () => {
    // 模拟:读时三条都 pending;写时 D3 已被另一管理员改成非 pending,
    // 带 eq(status,'pending') 的 UPDATE 不会命中它 ⇒ returning 无 D3 ⇒ missedIds 点名它。
    mockSelectRows.mockReturnValue([
      { id: D1, status: 'pending' },
      { id: D2, status: 'pending' },
      { id: D3, status: 'pending' },
    ])
    mockUpdateRows.mockReturnValue([{ id: D1 }, { id: D2 }])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/demand-square/batch-review',
      payload: { ids: [D1, D2, D3], action: 'approve' },
    })
    const body = res.json()
    // 本票要修的洞:没有条件写时 D3 会被无脑覆盖成 approved;有了条件写 ⇒ 只回报真被翻转的行。
    expect(body.data.results).toEqual([
      { id: D1, status: 'approved' },
      { id: D2, status: 'approved' },
      { id: D3, status: 'skipped' },
    ])
    expect(body.data.missedIds).toEqual([D3])
    expectConditionalWrite()
    await app.close()
  })

  it('⑥ 早退分支仍在:读时一条都不 pending ⇒ 不发 UPDATE(省一次无谓写 round-trip)', async () => {
    mockSelectRows.mockReturnValue([
      { id: D1, status: 'approved' },
      { id: D2, status: 'rejected' },
    ])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/demand-square/batch-review',
      payload: { ids: [D1, D2], action: 'approve' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.results).toEqual([
      { id: D1, status: 'skipped' },
      { id: D2, status: 'skipped' },
    ])
    expect(body.data.missedIds).toEqual([D1, D2])
    // pendingIdSet 为空 ⇒ UPDATE 一次都没发,也就没有 where 片段被记录
    expect(mockUpdateWhereArgs.length).toBe(0)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
