import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, mockLogAction, dbQueue } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockLogAction: vi.fn().mockResolvedValue(undefined),
  dbQueue: { items: [] as unknown[][] },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn().mockResolvedValue(true),
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  checkPermission: vi.fn().mockResolvedValue(false),
}))

vi.mock('../src/services/audit-service.js', () => ({
  logAction: mockLogAction,
}))

vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'values',
      'set',
      'returning',
      'innerJoin',
      'leftJoin',
      'select',
      'groupBy',
      'having',
      'on',
    ]) {
      chain[m] = () => chain
    }
    return chain
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

const O1 = '11111111-1111-1111-1111-111111111111'
const O2 = '22222222-2222-2222-2222-222222222222'
const O3 = '33333333-3333-3333-3333-333333333333'
const R1 = '44444444-4444-4444-4444-444444444444'
const R2 = '55555555-5555-5555-5555-555555555555'
const R3 = '66666666-6666-6666-6666-666666666666'
const U1 = '77777777-7777-7777-7777-777777777777'
const U2 = '88888888-8888-8888-8888-888888888888'
const U3 = '99999999-9999-9999-9999-999999999999'

function mockAdmin() {
  mockAuthenticate.mockImplementation(
    async (request: { userId?: string; jwtPayload?: { roleId?: number } }) => {
      request.userId = ADMIN_USER
      request.jwtPayload = { userId: ADMIN_USER, roleId: 1 }
    },
  )
}

function enqueue(...results: unknown[][]) {
  dbQueue.items.push(...results)
}

function genUuids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const hex = i.toString(16).padStart(12, '0')
    return `00000000-0000-0000-0000-${hex}`
  })
}

describe('admin deep P0 batch operations', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600
          ? err.statusCode
          : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : err.message,
      })
    })
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
    mockLogAction.mockReset()
    mockLogAction.mockResolvedValue(undefined)
    mockAdmin()
  })

  // ========== POST /api/admin/orders/batch-cancel ==========

  describe('POST /api/admin/orders/batch-cancel', () => {
    it('成功取消全部 pending 订单', async () => {
      enqueue(
        [{ id: O1, status: 'pending' }, { id: O2, status: 'pending' }],
        [],
      )
      const res = await server.inject({
        method: 'POST',
        url: `${ADMIN_PREFIX}/orders/batch-cancel`,
        payload: { ids: [O1, O2] },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.cancelled).toBe(2)
      expect(body.data.skipped).toEqual([])
    })

    it('部分跳过:非 pending 状态进 skipped', async () => {
      enqueue(
        [
          { id: O1, status: 'pending' },
          { id: O2, status: 'paid' },
          { id: O3, status: 'cancelled' },
        ],
        [],
      )
      const res = await server.inject({
        method: 'POST',
        url: `${ADMIN_PREFIX}/orders/batch-cancel`,
        payload: { ids: [O1, O2, O3] },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.cancelled).toBe(1)
      expect(body.data.skipped).toHaveLength(2)
      expect(body.data.skipped[0]).toEqual({ id: O2, reason: '状态 paid 不可取消' })
      expect(body.data.skipped[1]).toEqual({ id: O3, reason: '状态 cancelled 不可取消' })
    })

    it('全部跳过:无 pending 订单', async () => {
      enqueue([{ id: O1, status: 'paid' }, { id: O2, status: 'refunded' }])
      const res = await server.inject({
        method: 'POST',
        url: `${ADMIN_PREFIX}/orders/batch-cancel`,
        payload: { ids: [O1, O2] },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.cancelled).toBe(0)
      expect(body.data.skipped).toHaveLength(2)
    })

    it('Zod 校验:ids 空数组 → 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${ADMIN_PREFIX}/orders/batch-cancel`,
        payload: { ids: [] },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    })

    it('Zod 校验:ids 超 100 个 → 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${ADMIN_PREFIX}/orders/batch-cancel`,
        payload: { ids: genUuids(101) },
      })
      expect(res.statusCode).toBe(400)
    })

    it('Zod 校验:ids 含非 uuid → 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${ADMIN_PREFIX}/orders/batch-cancel`,
        payload: { ids: ['not-a-uuid'] },
      })
      expect(res.statusCode).toBe(400)
    })

    it('验证 logAction 被调用:action=order.batch_cancel', async () => {
      enqueue([{ id: O1, status: 'pending' }], [])
      await server.inject({
        method: 'POST',
        url: `${ADMIN_PREFIX}/orders/batch-cancel`,
        payload: { ids: [O1] },
      })
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'order.batch_cancel',
          resourceType: 'order',
        }),
      )
    })
  })

  // ========== POST /api/admin/refunds/batch-audit ==========

  describe('POST /api/admin/refunds/batch-audit', () => {
    it('成功审核全部 pending (approve)', async () => {
      enqueue(
        [{ id: R1, status: 'pending' }, { id: R2, status: 'pending' }],
        [{ id: R1, status: 'approved' }],
        [],
        [{ id: R2, status: 'approved' }],
        [],
      )
      const res = await server.inject({
        method: 'POST',
        url: `${ADMIN_PREFIX}/refunds/batch-audit`,
        payload: { ids: [R1, R2], action: 'approve' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.processed).toBe(2)
      expect(body.data.skipped).toEqual([])
    })

    it('成功审核全部 pending (reject)', async () => {
      enqueue(
        [{ id: R1, status: 'pending' }, { id: R2, status: 'pending' }],
        [{ id: R1, status: 'rejected' }],
        [],
        [{ id: R2, status: 'rejected' }],
        [],
      )
      const res = await server.inject({
        method: 'POST',
        url: `${ADMIN_PREFIX}/refunds/batch-audit`,
        payload: { ids: [R1, R2], action: 'reject' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.processed).toBe(2)
      expect(body.data.skipped).toEqual([])
    })

    it('部分跳过:非 pending 状态进 skipped', async () => {
      enqueue(
        [
          { id: R1, status: 'pending' },
          { id: R2, status: 'approved' },
          { id: R3, status: 'completed' },
        ],
        [{ id: R1, status: 'approved' }],
        [],
      )
      const res = await server.inject({
        method: 'POST',
        url: `${ADMIN_PREFIX}/refunds/batch-audit`,
        payload: { ids: [R1, R2, R3], action: 'approve' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.processed).toBe(1)
      expect(body.data.skipped).toHaveLength(2)
      expect(body.data.skipped[0]).toEqual({ id: R2, reason: '状态 approved 不可审核' })
      expect(body.data.skipped[1]).toEqual({ id: R3, reason: '状态 completed 不可审核' })
    })

    it('Zod 校验:action 非 approve/reject → 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${ADMIN_PREFIX}/refunds/batch-audit`,
        payload: { ids: [R1], action: 'invalid' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('Zod 校验:ids 空 → 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${ADMIN_PREFIX}/refunds/batch-audit`,
        payload: { ids: [], action: 'approve' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('验证 logAction 被调用:action=refund.batch_approve', async () => {
      enqueue(
        [{ id: R1, status: 'pending' }],
        [{ id: R1, status: 'approved' }],
        [],
      )
      await server.inject({
        method: 'POST',
        url: `${ADMIN_PREFIX}/refunds/batch-audit`,
        payload: { ids: [R1], action: 'approve' },
      })
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'refund.batch_approve',
          resourceType: 'refund',
        }),
      )
    })
  })

  // ========== POST /api/admin/users/batch-status ==========

  describe('POST /api/admin/users/batch-status', () => {
    it('成功更新全部用户 status', async () => {
      enqueue(
        [{ id: U1 }, { id: U2 }],
        [{ id: U1 }],
        [{ id: U2 }],
      )
      const res = await server.inject({
        method: 'POST',
        url: `${USER_PREFIX}/admin/users/batch-status`,
        payload: { ids: [U1, U2], status: 1 },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.updated).toBe(2)
      expect(body.data.failed).toEqual([])
    })

    it('Zod 校验:status=4 (max 3) → 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${USER_PREFIX}/admin/users/batch-status`,
        payload: { ids: [U1], status: 4 },
      })
      expect(res.statusCode).toBe(400)
    })

    it('Zod 校验:status=-1 (min 0) → 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${USER_PREFIX}/admin/users/batch-status`,
        payload: { ids: [U1], status: -1 },
      })
      expect(res.statusCode).toBe(400)
    })

    it('验证 logAction:action=user.batch_status', async () => {
      enqueue([{ id: U1 }], [{ id: U1 }])
      await server.inject({
        method: 'POST',
        url: `${USER_PREFIX}/admin/users/batch-status`,
        payload: { ids: [U1], status: 1 },
      })
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.batch_status',
          resourceType: 'user',
        }),
      )
    })
  })

  // ========== POST /api/admin/users/batch-review ==========

  describe('POST /api/admin/users/batch-review', () => {
    it('成功审核 status=0 用户', async () => {
      enqueue(
        [{ id: U1, status: 0 }, { id: U2, status: 0 }],
        [{ id: U1 }],
        [{ id: U2 }],
      )
      const res = await server.inject({
        method: 'POST',
        url: `${USER_PREFIX}/admin/users/batch-review`,
        payload: { ids: [U1, U2] },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.reviewed).toBe(2)
      expect(body.data.skipped).toEqual([])
    })

    it('跳过非 0 状态用户', async () => {
      enqueue(
        [
          { id: U1, status: 0 },
          { id: U2, status: 1 },
          { id: U3, status: 2 },
        ],
        [{ id: U1 }],
      )
      const res = await server.inject({
        method: 'POST',
        url: `${USER_PREFIX}/admin/users/batch-review`,
        payload: { ids: [U1, U2, U3] },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.reviewed).toBe(1)
      expect(body.data.skipped).toHaveLength(2)
      expect(body.data.skipped[0]).toEqual({ id: U2, reason: '状态 1 非待审核' })
      expect(body.data.skipped[1]).toEqual({ id: U3, reason: '状态 2 非待审核' })
    })

    it('Zod 校验:ids 空 → 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `${USER_PREFIX}/admin/users/batch-review`,
        payload: { ids: [] },
      })
      expect(res.statusCode).toBe(400)
    })

    it('验证 logAction:action=user.batch_review', async () => {
      enqueue(
        [{ id: U1, status: 0 }],
        [{ id: U1 }],
      )
      await server.inject({
        method: 'POST',
        url: `${USER_PREFIX}/admin/users/batch-review`,
        payload: { ids: [U1] },
      })
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.batch_review',
          resourceType: 'user',
        }),
      )
    })
  })
})
