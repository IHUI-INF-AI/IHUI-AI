import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, dbQueue } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  dbQueue: { items: [] as unknown[][] },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn().mockResolvedValue(undefined),
  requirePermission: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
  requireAuth: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/services/audit-service.js', () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/db/index.js', () => {
  function createChain() {
    const thenFn = (resolve: (v: unknown) => void) => {
      const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
      return Promise.resolve(result).then(resolve)
    }
    const make = (): Record<string, unknown> => {
      const proxy = new Proxy({} as Record<string, unknown>, {
        get(_target, prop: string) {
          if (prop === 'then') return thenFn
          return vi.fn().mockReturnValue(make())
        },
      })
      return proxy
    }
    return make()
  }
  const factory = () => createChain()
  const dbMock = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(factory),
    insert: vi.fn(factory),
    update: vi.fn(factory),
    delete: vi.fn(factory),
    transaction: vi.fn(),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

import { adminOrderRoutes } from '../src/routes/order.js'
import { adminRefundAuditRoutes } from '../src/routes/refund-audit.js'
import { userRoutes } from '../src/routes/admin-extended/user-routes.js'

const ADMIN_PREFIX = '/api/admin'
const USER_PREFIX = '/api'
const ADMIN_USER = '00000000-0000-0000-0000-000000000001'

function mockAdmin() {
  mockAuthenticate.mockImplementation(async (request: { userId?: string; jwtPayload?: unknown }) => {
    request.userId = ADMIN_USER
    request.jwtPayload = { userId: ADMIN_USER, roleId: 1 }
  })
}

function enqueue(...results: unknown[][]) {
  dbQueue.items.push(...results)
}

describe('admin deep P0 stats — orders / refunds / users aggregation', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(adminOrderRoutes, { prefix: ADMIN_PREFIX })
    await server.register(adminRefundAuditRoutes, { prefix: ADMIN_PREFIX })
    await server.register(userRoutes, { prefix: USER_PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    dbQueue.items.length = 0
    mockAuthenticate.mockReset()
    mockAdmin()
  })

  // ============================================================
  // GET /api/admin/orders/stats
  // Promise.all 5 路:statusRows / revenueRow / refundRow / dailyRows / top5
  // ============================================================

  it('orders/stats 空表 — 全部归零', async () => {
    enqueue([], [], [], [], [])
    const res = await server.inject({ method: 'GET', url: `${ADMIN_PREFIX}/orders/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.totalCount).toBe(0)
    expect(body.data.paidCount).toBe(0)
    expect(body.data.pendingCount).toBe(0)
    expect(body.data.cancelledCount).toBe(0)
    expect(body.data.refundedCount).toBe(0)
    expect(body.data.byStatus).toEqual({})
    expect(body.data.totalRevenue).toBe('0')
    expect(body.data.totalRefundAmount).toBe('0')
    expect(body.data.daily).toEqual([])
    expect(body.data.top5).toEqual([])
  })

  it('orders/stats 单条 paid 订单 — total/paid/revenue 正确', async () => {
    enqueue(
      [{ status: 'paid', count: 1 }],
      [{ total: '100.00' }],
      [{ total: '0' }],
      [],
      [],
    )
    const res = await server.inject({ method: 'GET', url: `${ADMIN_PREFIX}/orders/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.totalCount).toBe(1)
    expect(body.data.paidCount).toBe(1)
    expect(body.data.pendingCount).toBe(0)
    expect(body.data.totalRevenue).toBe('100.00')
    expect(body.data.totalRefundAmount).toBe('0')
    expect(body.data.byStatus).toEqual({ paid: 1 })
  })

  it('orders/stats 多状态混合 — byStatus 聚合正确', async () => {
    enqueue(
      [
        { status: 'paid', count: 3 },
        { status: 'pending', count: 2 },
        { status: 'cancelled', count: 1 },
        { status: 'refunded', count: 1 },
      ],
      [{ total: '300.00' }],
      [{ total: '50.00' }],
      [],
      [],
    )
    const res = await server.inject({ method: 'GET', url: `${ADMIN_PREFIX}/orders/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.totalCount).toBe(7)
    expect(body.data.paidCount).toBe(3)
    expect(body.data.pendingCount).toBe(2)
    expect(body.data.cancelledCount).toBe(1)
    expect(body.data.refundedCount).toBe(1)
    expect(body.data.byStatus).toEqual({
      paid: 3,
      pending: 2,
      cancelled: 1,
      refunded: 1,
    })
    expect(body.data.totalRevenue).toBe('300.00')
    expect(body.data.totalRefundAmount).toBe('50.00')
  })

  it('orders/stats Top5 — 按 payAmount 降序返回', async () => {
    const top5Data = [
      { id: 'ord-5', orderNo: 'O005', targetTitle: '课程5', payAmount: '500.00', status: 'paid' },
      { id: 'ord-4', orderNo: 'O004', targetTitle: '课程4', payAmount: '400.00', status: 'paid' },
      { id: 'ord-3', orderNo: 'O003', targetTitle: '课程3', payAmount: '300.00', status: 'paid' },
      { id: 'ord-2', orderNo: 'O002', targetTitle: '课程2', payAmount: '200.00', status: 'paid' },
      { id: 'ord-1', orderNo: 'O001', targetTitle: '课程1', payAmount: '100.00', status: 'paid' },
    ]
    enqueue(
      [{ status: 'paid', count: 5 }],
      [{ total: '1500.00' }],
      [],
      [],
      top5Data,
    )
    const res = await server.inject({ method: 'GET', url: `${ADMIN_PREFIX}/orders/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.top5).toHaveLength(5)
    expect(body.data.top5[0].payAmount).toBe('500.00')
    expect(body.data.top5[4].payAmount).toBe('100.00')
    expect(body.data.top5.map((o: { orderNo: string }) => o.orderNo)).toEqual([
      'O005',
      'O004',
      'O003',
      'O002',
      'O001',
    ])
  })

  // ============================================================
  // GET /api/admin/refunds/stats
  // Promise.all 3 路:statusCounts / dailyRows / monthlyRows
  // ============================================================

  it('refunds/stats 空表 — 全部归零', async () => {
    enqueue([], [], [])
    const res = await server.inject({ method: 'GET', url: `${ADMIN_PREFIX}/refunds/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.totalCount).toBe(0)
    expect(body.data.totalAmount).toBe('0.00')
    expect(body.data.byStatus).toEqual({})
    expect(body.data.pendingCount).toBe(0)
    expect(body.data.approvedCount).toBe(0)
    expect(body.data.rejectedCount).toBe(0)
    expect(body.data.completedCount).toBe(0)
    expect(body.data.daily).toEqual([])
    expect(body.data.monthly).toEqual([])
  })

  it('refunds/stats 单条 pending — totalCount + byStatus 正确', async () => {
    enqueue(
      [{ status: 'pending', count: 1, totalAmount: '50.00' }],
      [],
      [],
    )
    const res = await server.inject({ method: 'GET', url: `${ADMIN_PREFIX}/refunds/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.totalCount).toBe(1)
    expect(body.data.totalAmount).toBe('50.00')
    expect(body.data.byStatus).toEqual({
      pending: { count: 1, totalAmount: '50.00' },
    })
    expect(body.data.pendingCount).toBe(1)
    expect(body.data.approvedCount).toBe(0)
  })

  it('refunds/stats 多状态 — pending/approved/rejected 聚合', async () => {
    enqueue(
      [
        { status: 'pending', count: 2, totalAmount: '100.00' },
        { status: 'approved', count: 3, totalAmount: '200.00' },
        { status: 'rejected', count: 1, totalAmount: '30.00' },
      ],
      [],
      [],
    )
    const res = await server.inject({ method: 'GET', url: `${ADMIN_PREFIX}/refunds/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.totalCount).toBe(6)
    expect(body.data.totalAmount).toBe('330.00')
    expect(body.data.byStatus).toEqual({
      pending: { count: 2, totalAmount: '100.00' },
      approved: { count: 3, totalAmount: '200.00' },
      rejected: { count: 1, totalAmount: '30.00' },
    })
    expect(body.data.pendingCount).toBe(2)
    expect(body.data.approvedCount).toBe(3)
    expect(body.data.rejectedCount).toBe(1)
  })

  it('refunds/stats daily 趋势 — 3 条不同日期', async () => {
    const dailyData = [
      { date: '2026-07-21', count: 2, totalAmount: '100.00' },
      { date: '2026-07-22', count: 1, totalAmount: '50.00' },
      { date: '2026-07-23', count: 3, totalAmount: '150.00' },
    ]
    enqueue([], dailyData, [])
    const res = await server.inject({ method: 'GET', url: `${ADMIN_PREFIX}/refunds/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.daily).toHaveLength(3)
    expect(body.data.daily[0]).toEqual({
      date: '2026-07-21',
      count: 2,
      totalAmount: '100.00',
    })
    expect(body.data.daily[2]).toEqual({
      date: '2026-07-23',
      count: 3,
      totalAmount: '150.00',
    })
    expect(
      body.data.daily.every(
        (d: { date: string; count: number; totalAmount: string }) =>
          'date' in d && 'count' in d && 'totalAmount' in d,
      ),
    ).toBe(true)
  })

  it('refunds/stats monthly 趋势 — 2 条不同月份', async () => {
    const monthlyData = [
      { month: '2026-06', count: 5, totalAmount: '500.00' },
      { month: '2026-07', count: 8, totalAmount: '800.00' },
    ]
    enqueue([], [], monthlyData)
    const res = await server.inject({ method: 'GET', url: `${ADMIN_PREFIX}/refunds/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.monthly).toHaveLength(2)
    expect(body.data.monthly[0]).toEqual({
      month: '2026-06',
      count: 5,
      totalAmount: '500.00',
    })
    expect(body.data.monthly[1]).toEqual({
      month: '2026-07',
      count: 8,
      totalAmount: '800.00',
    })
  })

  // ============================================================
  // GET /api/admin/users/stats
  // Promise.all 9 路:totalRows / todayRows / weekRows / monthRows
  //   / byStatusRows / byLevelRows / vipRows / dailyRows / activeRows
  // ============================================================

  it('users/stats 空表 — 全部归零', async () => {
    enqueue([], [], [], [], [], [], [], [], [])
    const res = await server.inject({ method: 'GET', url: `${USER_PREFIX}/admin/users/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.total).toBe(0)
    expect(body.data.todayNew).toBe(0)
    expect(body.data.weekNew).toBe(0)
    expect(body.data.monthNew).toBe(0)
    expect(body.data.byStatus).toEqual({})
    expect(body.data.byLevel).toEqual({})
    expect(body.data.vipCount).toBe(0)
    expect(body.data.activeUsers).toBe(0)
    expect(body.data.daily).toEqual([])
  })

  it('users/stats 单条用户 — total/byStatus/byLevel 正确', async () => {
    enqueue(
      [{ count: 1 }],
      [{ count: 1 }],
      [{ count: 1 }],
      [{ count: 1 }],
      [{ status: 1, count: 1 }],
      [{ level: 0, count: 1 }],
      [{ count: 0 }],
      [],
      [{ count: 0 }],
    )
    const res = await server.inject({ method: 'GET', url: `${USER_PREFIX}/admin/users/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.total).toBe(1)
    expect(body.data.todayNew).toBe(1)
    expect(body.data.byStatus).toEqual({ 1: 1 })
    expect(body.data.byLevel).toEqual({ 0: 1 })
    expect(body.data.vipCount).toBe(0)
  })

  it('users/stats 多用户混合 — byStatus/byLevel/vipCount 聚合正确', async () => {
    enqueue(
      [{ count: 5 }],
      [{ count: 2 }],
      [{ count: 3 }],
      [{ count: 4 }],
      [
        { status: 0, count: 1 },
        { status: 1, count: 3 },
        { status: 2, count: 1 },
      ],
      [
        { level: 0, count: 2 },
        { level: 1, count: 2 },
        { level: 2, count: 1 },
      ],
      [{ count: 2 }],
      [],
      [{ count: 3 }],
    )
    const res = await server.inject({ method: 'GET', url: `${USER_PREFIX}/admin/users/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.total).toBe(5)
    expect(body.data.byStatus).toEqual({ 0: 1, 1: 3, 2: 1 })
    expect(body.data.byLevel).toEqual({ 0: 2, 1: 2, 2: 1 })
    expect(body.data.vipCount).toBe(2)
    expect(body.data.activeUsers).toBe(3)
  })

  it('users/stats todayNew/weekNew/monthNew — 时间过滤值透传', async () => {
    enqueue(
      [{ count: 100 }],
      [{ count: 5 }],
      [{ count: 20 }],
      [{ count: 50 }],
      [],
      [],
      [],
      [],
      [],
    )
    const res = await server.inject({ method: 'GET', url: `${USER_PREFIX}/admin/users/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.total).toBe(100)
    expect(body.data.todayNew).toBe(5)
    expect(body.data.weekNew).toBe(20)
    expect(body.data.monthNew).toBe(50)
  })

  it('users/stats activeUsers — distinct learnRecords 计数', async () => {
    enqueue(
      [{ count: 10 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [],
      [],
      [{ count: 0 }],
      [],
      [{ count: 7 }],
    )
    const res = await server.inject({ method: 'GET', url: `${USER_PREFIX}/admin/users/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.activeUsers).toBe(7)
  })
})
