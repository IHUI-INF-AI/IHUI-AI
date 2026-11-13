// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-130 回归锁(2026-11-13)。
 *
 * 病灶:DELETE /api/admin/orders/:id 先 delete(eduOrders) 再 delete(orders),不看支付状态;
 * payments.order_id / edu_payments.order_id 均 onDelete: 'cascade' ⇒ 一次删除把已支付订单
 * 连同网关原始响应一起抹掉,财务对账/退款/发票与审计证据不可恢复,且无审计。
 *
 * 本文件锁:
 *   ① status=paid / refunded:409,且不触发任何 delete、不写审计;
 *   ② status=pending / cancelled(未产生资金流):仍按原行为删除两张表并返回 200;
 *   ③ 删除成功必须调用 logAction 留痕(action=order.delete、resourceId=订单 id);
 *   ④ 订单不存在:404,不删除、不写审计。
 *
 * 只 mock requireAdmin / db / logAction,不触达真实 PG。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const selectQueue: unknown[][] = []
const deleteQueue: unknown[][] = []

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(deleteQueue.shift() ?? [])),
      })),
    })),
  },
  dbRead: {},
  dbClient: {},
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: { userId?: string }) => {
    request.userId = 'f130-admin'
  },
}))

vi.mock('../src/services/audit-service.js', () => ({
  logAction: vi.fn(async () => {}),
}))

import { db } from '../src/db/index.js'
import { logAction } from '../src/services/audit-service.js'
import { orderRoutes } from '../src/routes/admin-extended/order-routes.js'

const UUID = '00000000-0000-4000-8000-000000000130'
const DELETE_URL = `/api/admin/orders/${UUID}`

describe('F-130 已支付/已退款订单禁止物理删除', () => {
  let app: FastifyInstance

  const deleteMock = () => db.delete as unknown as ReturnType<typeof vi.fn>
  const logMock = () => logAction as unknown as ReturnType<typeof vi.fn>

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(orderRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    selectQueue.length = 0
    deleteQueue.length = 0
    vi.clearAllMocks()
  })

  for (const status of ['paid', 'refunded']) {
    it(`① status=${status} ⇒ 409,且不触发任何删除`, async () => {
      selectQueue.push([{ status }])

      const res = await app.inject({ method: 'DELETE', url: DELETE_URL })

      expect(res.statusCode).toBe(409)
      const body = res.json() as { code: number; message: string }
      expect(body.code).toBe(409)
      expect(body.message).toContain('禁止物理删除')
      expect(body.message).toContain(status)
      expect(deleteMock()).not.toHaveBeenCalled()
      expect(logMock()).not.toHaveBeenCalled()
    })
  }

  for (const status of ['pending', 'cancelled']) {
    it(`② status=${status} ⇒ 200,两张表都删且留审计`, async () => {
      selectQueue.push([{ status }])
      deleteQueue.push([{ id: UUID }])

      const res = await app.inject({ method: 'DELETE', url: DELETE_URL })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        code: 0,
        message: 'success',
        data: { id: UUID, deleted: true },
      })
      // edu_orders + orders 两张表各删一次,原行为不变
      expect(deleteMock()).toHaveBeenCalledTimes(2)
      expect(logMock()).toHaveBeenCalledTimes(1)
      const arg = logMock().mock.calls[0]![0] as {
        action: string
        resourceType: string
        resourceId: string
        userId: string
        details: { status: string }
      }
      expect(arg).toMatchObject({
        action: 'order.delete',
        resourceType: 'order',
        resourceId: UUID,
        userId: 'f130-admin',
        details: { status },
      })
    })
  }

  it('④ 订单不存在 ⇒ 404,不删除、不写审计', async () => {
    const res = await app.inject({ method: 'DELETE', url: DELETE_URL })

    expect(res.statusCode).toBe(404)
    expect(deleteMock()).not.toHaveBeenCalled()
    expect(logMock()).not.toHaveBeenCalled()
  })
})
