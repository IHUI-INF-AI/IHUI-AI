// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 批量写"未命中点名"离线回归(2026-09-26,不连库:mock db 链式调用,走 Fastify 注入真实路由)。
// 覆盖三格:
//   cancelAll   传 3 个 userId、库只命中 1 ⇒ affected=1 且 missedIds 点名另外 2 个
//   selectAll   全命中 ⇒ missedIds 为空数组,既有 success/affected 字段不变(等价回归)
//   demand-square batch-review:读时 3 个 pending、UPDATE 只 returning 2 个 ⇒
//     未命中的那个不得是 newStatus、missedIds 点名它、日志 affected 以库确认集合为准
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockUpdateRows, mockSelectRows, loggerInfo, ADMIN_ID } = vi.hoisted(() => ({
  mockUpdateRows: vi.fn((): unknown[] => []),
  mockSelectRows: vi.fn((): unknown[] => []),
  loggerInfo: vi.fn(),
  ADMIN_ID: '11111111-1111-4111-8111-111111111111',
}))

vi.mock('../src/db/index.js', () => {
  const makeChain = (resolver: () => unknown[]) => {
    const step: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'set',
      'returning',
      'values',
      'innerJoin',
      'orderBy',
      'limit',
      'offset',
      'groupBy',
    ]) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject)
    return step
  }
  return {
    db: {
      select: vi.fn(() => makeChain(mockSelectRows)),
      update: vi.fn(() => makeChain(mockUpdateRows)),
      insert: vi.fn(() => makeChain(() => [])),
      delete: vi.fn(() => makeChain(() => [])),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
    },
    dbRead: { select: vi.fn(() => makeChain(mockSelectRows)) },
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

import { roleRoutes } from '../src/routes/admin-sys/role-routes.js'
import { adminDemandSquareRoutes } from '../src/routes/admin-demand-square.js'

const U1 = 'u-11111111-1111-4111-8111-111111111111'
const U2 = 'u-22222222-2222-4222-8222-222222222222'
const U3 = 'u-33333333-3333-4333-8333-333333333333'

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(roleRoutes, { prefix: '/api/admin/role' })
  await app.register(adminDemandSquareRoutes, { prefix: '/api/admin/demand-square' })
  await app.ready()
  return app
}

describe('PUT /role/authUser/cancelAll:未命中的 userId 必须点名', () => {
  beforeEach(() => {
    mockUpdateRows.mockReturnValue([])
    mockSelectRows.mockReturnValue([])
  })

  it('传 3 个 userId 而库只命中 1 ⇒ affected=1,missedIds 点名另外 2 个', async () => {
    mockUpdateRows.mockReturnValue([{ id: U1 }])
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/role/authUser/cancelAll?roleId=1&userIds=${[U1, U2, U3].join(',')}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.success).toBe(true)
    expect(body.data.affected).toBe(1)
    expect(body.data.missedIds).toEqual([U2, U3])
    await app.close()
  })

  it('selectAll 全命中 ⇒ missedIds 为空数组,既有字段逐字不变(等价回归)', async () => {
    mockUpdateRows.mockReturnValue([{ id: U1 }, { id: U2 }])
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/role/authUser/selectAll?roleId=2&userIds=${[U1, U2].join(',')}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { success: true, affected: 2, missedIds: [] },
    })
    await app.close()
  })
})

describe('POST /demand-square/batch-review:读时 pending ≠ 写确认', () => {
  const D1 = '11111111-1111-4111-8111-111111111111'
  const D2 = '22222222-2222-4222-8222-222222222222'
  const D3 = '33333333-3333-4333-8333-333333333333'

  beforeEach(() => {
    mockUpdateRows.mockReturnValue([])
    mockSelectRows.mockReturnValue([])
    loggerInfo.mockClear()
  })

  it('读时 3 个 pending、UPDATE 只 returning 2 个 ⇒ 未命中的不得是 newStatus,missedIds 点名它', async () => {
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
    expect(body.code).toBe(0)
    // 逐条状态以库确认集合为准:D3 读时 pending 却没被写命中 ⇒ 不得报成 approved
    expect(body.data.results).toEqual([
      { id: D1, status: 'approved' },
      { id: D2, status: 'approved' },
      { id: D3, status: 'skipped' },
    ])
    expect(body.data.results[2].status).not.toBe('approved')
    expect(body.data.missedIds).toEqual([D3])
    // 日志里的 affected 也必须是库确认数(2),不是请求侧自算的 pendingIdSet.size(3)
    const logFields = loggerInfo.mock.calls[0]?.[1] as { affected: number } | undefined
    expect(logFields?.affected).toBe(2)
    await app.close()
  })

  it('等价回归:pending 的全部写命中 ⇒ results 与库确认一致、missedIds 只含未被写命中的', async () => {
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
    // missedIds 口径 = 本次写没有命中的全部 id(含读时已非 pending 的正常跳过);
    // 逐条语义仍以 results 为准:D2 是 skipped 而不是被谎报成 rejected
    expect(body.data.missedIds).toEqual([D2])
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
