// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * admin/stats 三聚合端点测试(dashboard / revenue / users)。
 * 目的:验证真实 DB 聚合的 SQL 调用(查询表/过滤/分组)与响应契约(前端在用,字段结构不可变)。
 * db 以链式 thenable builder mock:每次 db.select() 按顺序消费 selectQueue 中的预置结果。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { getTableName } from 'drizzle-orm'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ─────────────────────────────────────────────────────────────
// Mock:admin 鉴权层
// ─────────────────────────────────────────────────────────────
const { setAdmin, getAdmin } = vi.hoisted(() => {
  let isAdmin = true
  const adminUser = { userId: 'admin-test-001', roleId: 1 }
  return {
    setAdmin: (v: boolean) => {
      isAdmin = v
    },
    getAdmin: () => (isAdmin ? adminUser : null),
  }
})

vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async (request: any, reply: any) => {
    const admin = getAdmin()
    if (!admin) {
      return reply.status(403).send({ code: 403, message: 'Admin required', data: null })
    }
    request.user = admin
  }),
}))

// ─────────────────────────────────────────────────────────────
// Mock:db 层 — 记录每次 select 的表名/where/groupBy,按队列返回预置行
// ─────────────────────────────────────────────────────────────
const { selectRecords, selectQueue, pushResult } = vi.hoisted(() => {
  /** 每次 db.select() 的调用记录(表序列 / 过滤 / 分组 / 预置结果) */
  const selectRecords: Array<{
    tables: string[]
    hasWhere: boolean
    groupByCount: number
    result: unknown[] | Error
  }> = []
  /** 按查询顺序预置的结果队列(数组 = 返回行,Error = 查询抛错) */
  const selectQueue: Array<unknown[] | Error> = []
  return {
    selectRecords,
    selectQueue,
    /** 预置一条 select 结果 */
    pushResult: (r: unknown[] | Error) => selectQueue.push(r),
  }
})

vi.mock('../../db/index.js', () => {
  type Record_ = (typeof selectRecords)[number]
  // 链式 thenable builder:记录表名/where/groupBy,await 时消费预置结果
  const makeBuilder = (record: Record_) => {
    const builder: Record<string, unknown> = {
      from(table: unknown) {
        record.tables.push(getTableName(table as never))
        return builder
      },
      innerJoin(table: unknown) {
        record.tables.push(getTableName(table as never))
        return builder
      },
      where(cond: unknown) {
        record.hasWhere = cond !== undefined
        return builder
      },
      groupBy(..._cols: unknown[]) {
        record.groupByCount += 1
        return builder
      },
      orderBy(..._cols: unknown[]) {
        return builder
      },
      limit(_n: number) {
        return builder
      },
      offset(_n: number) {
        return builder
      },
      then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const queued = record.result
        const p =
          queued instanceof Error ? Promise.reject(queued) : Promise.resolve(queued as unknown[])
        return p.then(onFulfilled, onRejected)
      },
    }
    return builder
  }
  return {
    db: {
      select: () => {
        const result = selectQueue.shift() ?? []
        const record = { tables: [] as string[], hasWhere: false, groupByCount: 0, result }
        selectRecords.push(record)
        return makeBuilder(record)
      },
    },
  }
})

import statsRoutes from '../admin/stats.js'

describe('Admin Stats 三聚合端点(dashboard/revenue/users)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(statsRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    setAdmin(true)
    selectQueue.length = 0
    selectRecords.length = 0
  })

  // ─────────────────────────────────────────────────────────
  // 鉴权
  // ─────────────────────────────────────────────────────────
  it('非 admin 访问 → 403', async () => {
    setAdmin(false)
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/dashboard' })
    expect(res.statusCode).toBe(403)
  })

  // ─────────────────────────────────────────────────────────
  // GET /stats/dashboard
  // ─────────────────────────────────────────────────────────
  it('dashboard:真实聚合 PV/UV/订单/营收 + 7 日趋势 + 状态占比,响应契约不变', async () => {
    // 查询顺序:PV(count visit_logs) → UV(distinct) → 订单数 → 已支付营收 → 趋势 → 占比
    pushResult([{ c: 1200 }]) // PV
    pushResult([{ c: 300 }]) // UV
    pushResult([{ c: 80 }]) // 订单总数
    pushResult([{ total: 123450 }]) // 已支付营收(分)
    pushResult([
      { label: '08-29', value: 40 },
      { label: '08-30', value: 42 },
    ]) // 7 日趋势
    pushResult([
      { label: 'paid', value: 70 },
      { label: 'pending', value: 10 },
    ]) // 订单状态占比

    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/dashboard' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)

    // 响应契约:overview{pv,uv,orders,revenue} + trend + metrics + ratios
    expect(Object.keys(body.data.overview).sort()).toEqual(['orders', 'pv', 'revenue', 'uv'])
    expect(body.data.overview.pv).toBe(1200)
    expect(body.data.overview.uv).toBe(300)
    expect(body.data.overview.orders).toBe(80)
    // 123450 分 → 1234.50 元
    expect(body.data.overview.revenue).toBe(1234.5)
    expect(body.data.trend).toEqual([
      { label: '08-29', value: 40 },
      { label: '08-30', value: 42 },
    ])
    expect(body.data.metrics).toEqual([
      { label: 'PV', value: 1200 },
      { label: 'UV', value: 300 },
      { label: '订单', value: 80 },
      { label: '营收', value: 1234.5 },
    ])
    expect(body.data.ratios).toEqual([
      { label: 'paid', value: 70 },
      { label: 'pending', value: 10 },
    ])

    // SQL 调用:6 次查询,表序列 visit_logs×2 → orders×2 → visit_logs → orders
    expect(selectRecords).toHaveLength(6)
    expect(selectRecords.map((r) => r.tables)).toEqual([
      ['visit_logs'],
      ['visit_logs'],
      ['orders'],
      ['orders'],
      ['visit_logs'],
      ['orders'],
    ])
    // 已支付营收查询带 status 过滤;趋势查询带 where + group by
    expect(selectRecords[3]!.hasWhere).toBe(true)
    expect(selectRecords[4]!.hasWhere).toBe(true)
    expect(selectRecords[4]!.groupByCount).toBe(1)
    // 占比查询按 status 分组
    expect(selectRecords[5]!.groupByCount).toBe(1)
  })

  it('dashboard:查询异常 → 返回零值结构,不 500', async () => {
    pushResult(new Error('relation "visit_logs" does not exist'))
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/dashboard' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data).toEqual({
      overview: { pv: 0, uv: 0, orders: 0, revenue: 0 },
      trend: [],
      metrics: [],
      ratios: [],
    })
  })

  // ─────────────────────────────────────────────────────────
  // GET /stats/revenue
  // ─────────────────────────────────────────────────────────
  it('revenue:时间窗口聚合收入/退款/ARPU + 30 日趋势,响应契约不变', async () => {
    // 查询顺序:总营收 → 本月 → 今日 → 订单总数 → 已支付数 → 退款 → 30 日趋势
    pushResult([{ total: 100000 }]) // 总营收(分)
    pushResult([{ total: 50000 }]) // 本月营收(分)
    pushResult([{ total: 12345 }]) // 今日营收(分)
    pushResult([{ c: 80 }]) // 订单总数
    pushResult([{ c: 60 }]) // 已支付订单数
    pushResult([{ amount: 25.5, count: 3 }]) // 已完成退款(元)
    pushResult([{ label: '08-30', value: 5000 }]) // 30 日营收趋势(分)

    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/revenue' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)

    // 响应契约:overview 9 字段 + trend + byChannel + byProduct
    expect(Object.keys(body.data.overview).sort()).toEqual([
      'arpu',
      'monthRevenue',
      'netRevenue',
      'paidOrders',
      'refundAmount',
      'refundCount',
      'todayRevenue',
      'totalOrders',
      'totalRevenue',
    ])
    expect(body.data.overview.totalRevenue).toBe(1000)
    expect(body.data.overview.monthRevenue).toBe(500)
    expect(body.data.overview.todayRevenue).toBe(123.45)
    expect(body.data.overview.totalOrders).toBe(80)
    expect(body.data.overview.paidOrders).toBe(60)
    expect(body.data.overview.refundAmount).toBe(25.5)
    expect(body.data.overview.refundCount).toBe(3)
    // 净营收 = 1000 - 25.5
    expect(body.data.overview.netRevenue).toBe(974.5)
    // ARPU = 1000 / 60
    expect(body.data.overview.arpu).toBe(16.67)
    expect(body.data.trend).toEqual([{ label: '08-30', value: 5000 }])
    expect(body.data.byChannel).toEqual([])
    expect(body.data.byProduct).toEqual([])

    // SQL 调用:7 次查询,orders×5 → edu_refunds → orders(趋势)
    expect(selectRecords).toHaveLength(7)
    expect(selectRecords.map((r) => r.tables)).toEqual([
      ['orders'],
      ['orders'],
      ['orders'],
      ['orders'],
      ['orders'],
      ['edu_refunds'],
      ['orders'],
    ])
    // 营收/时间窗查询(0,1,2,4)与退款(5)/趋势(6)都带过滤;订单总数(3)无过滤
    expect([0, 1, 2, 4, 5, 6].map((i) => selectRecords[i]!.hasWhere)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ])
    expect(selectRecords[3]!.hasWhere).toBe(false)
    expect(selectRecords[6]!.groupByCount).toBe(1)
  })

  it('revenue:查询异常 → 返回零值结构,不 500', async () => {
    pushResult(new Error('DB connection lost'))
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/revenue' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.overview).toEqual({
      totalRevenue: 0,
      monthRevenue: 0,
      todayRevenue: 0,
      totalOrders: 0,
      paidOrders: 0,
      refundAmount: 0,
      refundCount: 0,
      netRevenue: 0,
      arpu: 0,
    })
    expect(body.data.trend).toEqual([])
    expect(body.data.byChannel).toEqual([])
    expect(body.data.byProduct).toEqual([])
  })

  // ─────────────────────────────────────────────────────────
  // GET /stats/users
  // ─────────────────────────────────────────────────────────
  it('users:注册趋势/DAU/MAU/留存真实聚合,响应契约不变', async () => {
    // 查询顺序:总数 → 今日新增 → 周新增 → 月新增 → DAU → MAU → 按角色 → 30 日增长
    pushResult([{ c: 1000 }]) // 总用户
    pushResult([{ c: 5 }]) // 今日新增
    pushResult([{ c: 20 }]) // 本周新增
    pushResult([{ c: 50 }]) // 本月新增
    pushResult([{ c: 120 }]) // DAU(今日活跃)
    pushResult([{ c: 400 }]) // MAU(本月活跃)
    pushResult([
      { roleId: 1, count: 900 },
      { roleId: 2, count: 100 },
    ]) // 按角色分布
    pushResult([{ day: '2026-08-30', count: 5 }]) // 30 日注册增长
    // 留存:7 天同期活跃 → 7 天同期基数 → 30 天同期活跃 → 30 天同期基数
    pushResult([{ c: 4 }]) // 7 日留存分子
    pushResult([{ c: 10 }]) // 7 日留存分母
    pushResult([{ c: 3 }]) // 30 日留存分子
    pushResult([{ c: 20 }]) // 30 日留存分母

    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/users' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)

    // 响应契约:overview 8 字段 + growth + byRole + byRegion
    expect(Object.keys(body.data.overview).sort()).toEqual([
      'dau',
      'mau',
      'monthNew',
      'retention30d',
      'retention7d',
      'todayNew',
      'totalUsers',
      'weekNew',
    ])
    expect(body.data.overview.totalUsers).toBe(1000)
    expect(body.data.overview.todayNew).toBe(5)
    expect(body.data.overview.weekNew).toBe(20)
    expect(body.data.overview.monthNew).toBe(50)
    expect(body.data.overview.dau).toBe(120)
    expect(body.data.overview.mau).toBe(400)
    // 留存率:4/10=40% , 3/20=15%
    expect(body.data.overview.retention7d).toBe(40)
    expect(body.data.overview.retention30d).toBe(15)
    expect(body.data.growth).toEqual([{ day: '2026-08-30', count: 5 }])
    expect(body.data.byRole).toEqual([
      { roleId: 1, count: 900 },
      { roleId: 2, count: 100 },
    ])
    expect(body.data.byRegion).toEqual([])

    // SQL 调用:12 次查询
    expect(selectRecords).toHaveLength(12)
    const tableSeq = selectRecords.map((r) => r.tables)
    // 前 8 次:users×4(计数) → visit_logs(DAU) → visit_logs(MAU) → users(角色) → users(增长)
    expect(tableSeq.slice(0, 8)).toEqual([
      ['users'],
      ['users'],
      ['users'],
      ['users'],
      ['visit_logs'],
      ['visit_logs'],
      ['users'],
      ['users'],
    ])
    // 留存 4 次:visit_logs innerJoin users(分子) + users(分母) ×2 组
    expect(tableSeq[8]).toEqual(['visit_logs', 'users'])
    expect(tableSeq[9]).toEqual(['users'])
    expect(tableSeq[10]).toEqual(['visit_logs', 'users'])
    expect(tableSeq[11]).toEqual(['users'])
    // 新增/活跃/增长查询(1-5,7)都带时间过滤;总数(0)与按角色分布(6)无过滤
    expect([1, 2, 3, 4, 5, 7].map((i) => selectRecords[i]!.hasWhere)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ])
    expect(selectRecords[0]!.hasWhere).toBe(false)
    expect(selectRecords[6]!.hasWhere).toBe(false)
    // 增长趋势按天分组
    expect(selectRecords[7]!.groupByCount).toBe(1)
  })

  it('users:查询异常 → 返回零值结构,不 500', async () => {
    pushResult(new Error('relation "users" does not exist'))
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats/users' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.overview).toEqual({
      totalUsers: 0,
      todayNew: 0,
      weekNew: 0,
      monthNew: 0,
      dau: 0,
      mau: 0,
      retention7d: 0,
      retention30d: 0,
    })
    expect(body.data.growth).toEqual([])
    expect(body.data.byRole).toEqual([])
    expect(body.data.byRegion).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
