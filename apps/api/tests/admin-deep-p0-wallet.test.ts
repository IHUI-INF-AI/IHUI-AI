import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const {
  dbQueue,
  mockAuthenticate,
  mockRequireAdmin,
  mockLogAction,
  txSelectResult,
  txUpdateReturning,
  txInsertReturning,
  txInsertValuesSpy,
  txUpdateWhereSpy,
} = vi.hoisted(() => ({
  dbQueue: { items: [] as unknown[][] },
  mockAuthenticate: vi.fn(),
  mockRequireAdmin: vi.fn(),
  mockLogAction: vi.fn(),
  txSelectResult: vi.fn(),
  txUpdateReturning: vi.fn(),
  txInsertReturning: vi.fn(),
  txInsertValuesSpy: vi.fn(),
  txUpdateWhereSpy: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: mockRequireAdmin,
  requireAuth: vi.fn(),
  requirePermission: vi.fn(),
}))

vi.mock('../src/services/audit-service.js', () => ({
  logAction: mockLogAction,
}))

vi.mock('../src/db/index.js', () => {
  function createReadChain() {
    const chain: {
      then: (resolve: (v: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of [
      'select',
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'innerJoin',
      'groupBy',
    ]) {
      chain[m] = vi.fn(() => chain)
    }
    return chain
  }
  function createTxSelectChain() {
    const chain: {
      then: (resolve: (v: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => Promise.resolve(txSelectResult()).then(resolve),
    }
    for (const m of ['from', 'where', 'limit']) {
      chain[m] = vi.fn(() => chain)
    }
    return chain
  }
  const tx = {
    select: vi.fn(() => createTxSelectChain()),
    insert: vi.fn(() => ({ values: txInsertValuesSpy })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: txUpdateWhereSpy })) })),
  }
  return {
    db: {
      select: vi.fn(() => createReadChain()),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)),
      execute: vi.fn().mockResolvedValue([]),
    },
    dbRead: {
      select: vi.fn(() => createReadChain()),
    },
    dbClient: {},
  }
})

import { adminWalletRoutes } from '../src/routes/wallet.js'

const PREFIX = '/api/admin/wallet'
const ADMIN_USER = '00000000-0000-0000-0000-000000000001'
const TARGET_USER = '11111111-1111-1111-1111-111111111111'

describe('adminWalletRoutes — /api/admin/wallet/*', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(adminWalletRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    dbQueue.items.length = 0
    txSelectResult.mockReset().mockResolvedValue([])
    txUpdateReturning.mockReset().mockResolvedValue([])
    txInsertReturning.mockReset().mockResolvedValue([])
    txInsertValuesSpy.mockReset().mockReturnValue({ returning: txInsertReturning })
    txUpdateWhereSpy.mockReset().mockReturnValue({ returning: txUpdateReturning })
    mockAuthenticate.mockReset()
    mockRequireAdmin
      .mockReset()
      .mockImplementation(
        async (request: { userId?: string; jwtPayload?: { roleId?: number } }) => {
          request.userId = ADMIN_USER
          request.jwtPayload = { userId: ADMIN_USER, roleId: 1 }
        },
      )
    mockLogAction.mockReset().mockResolvedValue(undefined)
  })

  // ---------- GET /stats ----------

  it('GET /stats 成功 — 8 路 Promise.all 聚合返回正确字段', async () => {
    dbQueue.items.push(
      [{ total: 1000 }], // rechargeSum
      [{ total: 500 }], // withdrawSum
      [{ total: 200 }], // commissionSum
      [{ total: 50 }], // adjustSum
      [{ count: 5, amount: 300 }], // todayRecharge
      [{ count: 2, amount: 100 }], // todayWithdraw
      [{ date: '2026-07-23', recharge: 100, withdraw: 50, commission: 20 }], // daily
      [{ count: 42 }], // activeWallets
    )
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.totalRecharge).toBe(1000)
    expect(body.data.totalWithdraw).toBe(500)
    expect(body.data.totalCommission).toBe(200)
    expect(body.data.totalAdminAdjust).toBe(50)
    expect(body.data.todayRecharge).toEqual({ count: 5, amount: 300 })
    expect(body.data.todayWithdraw).toEqual({ count: 2, amount: 100 })
    expect(body.data.daily).toEqual([
      { date: '2026-07-23', recharge: 100, withdraw: 50, commission: 20 },
    ])
    expect(body.data.activeWallets).toBe(42)
  })

  it('GET /stats 空表 — 所有字段默认 0 / 空数组', async () => {
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/stats` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.totalRecharge).toBe(0)
    expect(body.data.totalWithdraw).toBe(0)
    expect(body.data.totalCommission).toBe(0)
    expect(body.data.totalAdminAdjust).toBe(0)
    expect(body.data.todayRecharge).toEqual({ count: 0, amount: 0 })
    expect(body.data.todayWithdraw).toEqual({ count: 0, amount: 0 })
    expect(body.data.daily).toEqual([])
    expect(body.data.activeWallets).toBe(0)
  })

  // ---------- GET /flows ----------

  it('GET /flows 默认分页 — page=1 / pageSize=20 + list/total', async () => {
    const createdAt = new Date('2026-07-23T10:00:00Z')
    dbQueue.items.push(
      [
        {
          id: 'f1',
          userId: TARGET_USER,
          opType: 0,
          quantity: 100,
          balanceAfter: 100,
          remark: '充值',
          operatorId: ADMIN_USER,
          relatedOrderNo: null,
          createdAt,
          nickname: 'u1',
          avatar: null,
        },
      ],
      [{ count: 1 }],
    )
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/flows` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].id).toBe('f1')
    expect(body.data.list[0].createdAt).toBe(createdAt.toISOString())
    expect(body.data.total).toBe(1)
    expect(body.data.page).toBe(1)
    expect(body.data.pageSize).toBe(20)
  })

  it('GET /flows 组合过滤 — userId+opType+startDate+endDate+keyword', async () => {
    const createdAt = new Date('2026-07-22T08:00:00Z')
    dbQueue.items.push(
      [
        {
          id: 'f2',
          userId: TARGET_USER,
          opType: 0,
          quantity: 50,
          balanceAfter: 150,
          remark: '关键词 hello 命中',
          operatorId: ADMIN_USER,
          relatedOrderNo: 'O1',
          createdAt,
          nickname: 'u2',
          avatar: 'a.png',
        },
      ],
      [{ count: 1 }],
    )
    const url =
      `${PREFIX}/flows?userId=${TARGET_USER}&opType=0` +
      `&startDate=2026-07-01&endDate=2026-07-31&keyword=hello`
    const res = await server.inject({ method: 'GET', url })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].remark).toContain('hello')
    expect(body.data.total).toBe(1)
  })

  it('GET /flows 自定义分页 — page=2 / pageSize=10', async () => {
    dbQueue.items.push([], [{ count: 15 }])
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/flows?page=2&pageSize=10`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toEqual([])
    expect(body.data.total).toBe(15)
    expect(body.data.page).toBe(2)
    expect(body.data.pageSize).toBe(10)
  })

  // ---------- POST /adjust ----------

  it('POST /adjust 充值 opType=0 amount=100 margin 存在 → update 路径', async () => {
    txSelectResult.mockResolvedValueOnce([{ tokenQuantity: 100, userId: TARGET_USER }])
    txUpdateReturning.mockResolvedValueOnce([{ tokenQuantity: 200, userId: TARGET_USER }])
    txInsertReturning.mockResolvedValueOnce([
      { balanceAfter: 200, opType: 0, quantity: 100 },
    ])

    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/adjust`,
      payload: { userId: TARGET_USER, amount: 100, opType: 0, remark: '充值' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.margin.tokenQuantity).toBe(200)
    expect(body.data.flow.balanceAfter).toBe(200)
    expect(txInsertValuesSpy).toHaveBeenCalledTimes(1)
    expect(txUpdateWhereSpy).toHaveBeenCalledTimes(1)
  })

  it('POST /adjust 管理员调整 opType=5 amount=-50 margin 存在余额足够 → update 路径', async () => {
    txSelectResult.mockResolvedValueOnce([{ tokenQuantity: 100, userId: TARGET_USER }])
    txUpdateReturning.mockResolvedValueOnce([{ tokenQuantity: 50, userId: TARGET_USER }])
    txInsertReturning.mockResolvedValueOnce([
      { balanceAfter: 50, opType: 5, quantity: -50 },
    ])

    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/adjust`,
      payload: { userId: TARGET_USER, amount: -50, opType: 5, remark: '扣减' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.margin.tokenQuantity).toBe(50)
    expect(body.data.flow.balanceAfter).toBe(50)
    expect(txInsertValuesSpy).toHaveBeenCalledTimes(1)
    expect(txUpdateWhereSpy).toHaveBeenCalledTimes(1)
  })

  it('POST /adjust margin 不存在 → insert userMargins 路径', async () => {
    txSelectResult.mockResolvedValueOnce([])
    txInsertReturning
      .mockResolvedValueOnce([{ tokenQuantity: 50, userId: TARGET_USER }])
      .mockResolvedValueOnce([{ balanceAfter: 50, opType: 0, quantity: 50 }])

    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/adjust`,
      payload: { userId: TARGET_USER, amount: 50, opType: 0 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.margin.tokenQuantity).toBe(50)
    expect(body.data.flow.balanceAfter).toBe(50)
    expect(txInsertValuesSpy).toHaveBeenCalledTimes(2)
    expect(txUpdateWhereSpy).not.toHaveBeenCalled()
  })

  it('POST /adjust 余额不足 newBalance<0 → 400 + 事务回滚 + logAction 不调用', async () => {
    txSelectResult.mockResolvedValueOnce([{ tokenQuantity: 30, userId: TARGET_USER }])

    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/adjust`,
      payload: { userId: TARGET_USER, amount: -50, opType: 5, remark: '扣太多' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
    expect(body.message).toBe('调整后余额不能为负数')
    expect(txInsertValuesSpy).not.toHaveBeenCalled()
    expect(txUpdateWhereSpy).not.toHaveBeenCalled()
    expect(mockLogAction).not.toHaveBeenCalled()
  })

  it('POST /adjust Zod 校验 — amount=0 (nonzero 拒绝) → 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/adjust`,
      payload: { userId: TARGET_USER, amount: 0, opType: 0 },
    })
    expect(res.statusCode).toBe(400)
    expect(txInsertValuesSpy).not.toHaveBeenCalled()
  })

  it('POST /adjust Zod 校验 — opType=3 非 0/5 → 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/adjust`,
      payload: { userId: TARGET_USER, amount: 100, opType: 3 },
    })
    expect(res.statusCode).toBe(400)
    expect(txInsertValuesSpy).not.toHaveBeenCalled()
  })

  it('POST /adjust Zod 校验 — userId 非 uuid → 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/adjust`,
      payload: { userId: 'not-a-uuid', amount: 100, opType: 0 },
    })
    expect(res.statusCode).toBe(400)
    expect(txInsertValuesSpy).not.toHaveBeenCalled()
  })

  it('POST /adjust Zod 校验 — remark 超 500 字 → 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/adjust`,
      payload: {
        userId: TARGET_USER,
        amount: 100,
        opType: 0,
        remark: 'a'.repeat(501),
      },
    })
    expect(res.statusCode).toBe(400)
    expect(txInsertValuesSpy).not.toHaveBeenCalled()
  })

  it('POST /adjust 成功后 logAction 被调用 — action/resourceType/resourceId/details 正确', async () => {
    txSelectResult.mockResolvedValueOnce([{ tokenQuantity: 100, userId: TARGET_USER }])
    txUpdateReturning.mockResolvedValueOnce([{ tokenQuantity: 200, userId: TARGET_USER }])
    txInsertReturning.mockResolvedValueOnce([
      { balanceAfter: 200, opType: 0, quantity: 100 },
    ])

    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/adjust`,
      payload: { userId: TARGET_USER, amount: 100, opType: 0, remark: '充值' },
    })
    expect(res.statusCode).toBe(201)
    expect(mockLogAction).toHaveBeenCalledTimes(1)
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ADMIN_USER,
        action: 'wallet.admin_adjust',
        resourceType: 'wallet',
        resourceId: TARGET_USER,
        details: expect.objectContaining({
          targetUserId: TARGET_USER,
          amount: 100,
          opType: 0,
          remark: '充值',
          balanceAfter: 200,
        }),
      }),
    )
  })

  it('POST /adjust 验证 operatorId = request.userId (ADMIN_USER) 写入 flowValues', async () => {
    txSelectResult.mockResolvedValueOnce([{ tokenQuantity: 100, userId: TARGET_USER }])
    txUpdateReturning.mockResolvedValueOnce([{ tokenQuantity: 200, userId: TARGET_USER }])
    txInsertReturning.mockResolvedValueOnce([
      { balanceAfter: 200, opType: 0, quantity: 100 },
    ])

    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/adjust`,
      payload: { userId: TARGET_USER, amount: 100, opType: 0, remark: '充值' },
    })
    expect(res.statusCode).toBe(201)
    expect(txInsertValuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TARGET_USER,
        opType: 0,
        quantity: 100,
        balanceAfter: 200,
        remark: '充值',
        operatorId: ADMIN_USER,
      }),
    )
  })
})
