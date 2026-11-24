// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-465 回归锁(2026-11-13)。
 *
 * 病灶:PUT /admin/orders/:id 把 status 当普通字段裸写 —— refunded→paid、pending→paid/
 * refunded 都能直接落库,pay_time/refund_time 与 orders.paid_at/refund_time 恒为 NULL,
 * completeOrder / 退款服务从未被调用(履约链旁路)。
 *
 * 本文件锁:
 *   ① pending→paid 走 completeOrder,响应里的时间戳由同源状态机写入(非 NULL);
 *   ② paid→refunded 走 refundOrder,refundTime 落库;
 *   ③ 非法迁移(refunded→paid、paid→pending、pending→refunded、cancelled→*、paid→cancelled)
 *      一律 409,且不调用履约服务、不写任何一张表;
 *   ④ 同状态重复提交不触发履约服务;
 *   ⑤ 履约服务失败时如实 409,不落库;
 *   ⑥ 非状态字段仍可单独更新(edu_orders + orders 两表)。
 *
 * 只桩替身 db / requireAdmin / order-service,不连真实 PG。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    writes: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  }
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => state.selectQueue.shift() ?? [],
        }),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        state.writes.push({ table, values })
        return { where: async () => undefined }
      },
    }),
  }
  return {
    state,
    db,
    completeOrder: vi.fn(),
    cancelOrder: vi.fn(),
    refundOrder: vi.fn(),
  }
})

vi.mock('../src/db/index.js', () => ({ db: h.db }))
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => undefined,
}))
vi.mock('../src/db/commission-queries.js', () => ({
  approveWithdrawal: vi.fn(),
  rejectWithdrawal: vi.fn(),
}))
vi.mock('../src/services/audit-service.js', () => ({ logAction: vi.fn() }))
vi.mock('../src/services/order-service.js', () => ({
  completeOrder: h.completeOrder,
  cancelOrder: h.cancelOrder,
  refundOrder: h.refundOrder,
}))

import { orderRoutes } from '../src/routes/admin-extended/order-routes.js'

const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const ORDER_NO = 'IHUI20261113001'

interface ApiBody {
  code: number
  message: string
  data: Record<string, unknown>
}

function orderRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ORDER_ID,
    orderNo: ORDER_NO,
    status: 'pending',
    payTime: null,
    refundTime: null,
    ...overrides,
  }
}

let app: FastifyInstance

beforeEach(async () => {
  h.state.selectQueue.length = 0
  h.state.writes.length = 0
  h.completeOrder.mockReset()
  h.cancelOrder.mockReset()
  h.refundOrder.mockReset()
  app = Fastify()
  await app.register(orderRoutes)
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

describe('F-465:后台改单必须走状态机与履约链', () => {
  it('pending→paid 调 completeOrder,并把状态机写入的时间戳返回', async () => {
    const paidAt = new Date('2026-11-13T02:00:00.000Z')
    h.state.selectQueue.push([{ status: 'pending', orderNo: ORDER_NO }])
    h.completeOrder.mockImplementation(async (orderNo: string) => {
      const row = orderRow({ orderNo, status: 'paid', payTime: paidAt })
      h.state.selectQueue.push([row])
      return { success: true, order: row }
    })

    const res = await app.inject({
      method: 'PUT',
      url: `/admin/orders/${ORDER_ID}`,
      payload: { status: 'paid' },
    })

    expect(res.statusCode).toBe(200)
    expect(h.completeOrder).toHaveBeenCalledWith(ORDER_NO)
    const body = res.json() as ApiBody
    expect(body.data.status).toBe('paid')
    expect(body.data.payTime).toBe(paidAt.toISOString())
    // 路由不再裸写 status(时间戳由 updateOrderStatus 在同一状态迁移内写两张表)
    expect(h.state.writes).toHaveLength(0)
  })

  it('paid→refunded 调 refundOrder,refundTime 非空', async () => {
    const refundTime = new Date('2026-11-13T03:00:00.000Z')
    h.state.selectQueue.push([{ status: 'paid', orderNo: ORDER_NO }])
    h.refundOrder.mockImplementation(async (orderNo: string) => {
      const row = orderRow({ orderNo, status: 'refunded', refundTime })
      h.state.selectQueue.push([row])
      return { success: true, order: row }
    })

    const res = await app.inject({
      method: 'PUT',
      url: `/admin/orders/${ORDER_ID}`,
      payload: { status: 'refunded' },
    })

    expect(res.statusCode).toBe(200)
    expect(h.refundOrder).toHaveBeenCalledWith(ORDER_NO)
    expect(h.completeOrder).not.toHaveBeenCalled()
    const body = res.json() as ApiBody
    expect(body.data.status).toBe('refunded')
    expect(body.data.refundTime).toBe(refundTime.toISOString())
    expect(h.state.writes).toHaveLength(0)
  })

  it('pending→cancelled 调 cancelOrder', async () => {
    h.state.selectQueue.push([{ status: 'pending', orderNo: ORDER_NO }])
    h.cancelOrder.mockImplementation(async (orderNo: string) => {
      const row = orderRow({ orderNo, status: 'cancelled', cancelTime: new Date() })
      h.state.selectQueue.push([row])
      return { success: true, order: row }
    })

    const res = await app.inject({
      method: 'PUT',
      url: `/admin/orders/${ORDER_ID}`,
      payload: { status: 'cancelled' },
    })

    expect(res.statusCode).toBe(200)
    expect(h.cancelOrder).toHaveBeenCalledWith(ORDER_NO)
    expect(h.state.writes).toHaveLength(0)
  })

  it.each([
    ['refunded', 'paid'],
    ['paid', 'pending'],
    ['pending', 'refunded'],
    ['cancelled', 'paid'],
    ['paid', 'cancelled'],
  ])('非法迁移 %s→%s 返回 409 且零写库', async (from, to) => {
    h.state.selectQueue.push([{ status: from, orderNo: ORDER_NO }])

    const res = await app.inject({
      method: 'PUT',
      url: `/admin/orders/${ORDER_ID}`,
      payload: { status: to },
    })

    expect(res.statusCode).toBe(409)
    expect(h.completeOrder).not.toHaveBeenCalled()
    expect(h.cancelOrder).not.toHaveBeenCalled()
    expect(h.refundOrder).not.toHaveBeenCalled()
    expect(h.state.writes).toHaveLength(0)
  })

  it('同状态重复提交不触发履约服务', async () => {
    h.state.selectQueue.push([{ status: 'paid', orderNo: ORDER_NO }])
    h.state.selectQueue.push([orderRow({ status: 'paid' })])

    const res = await app.inject({
      method: 'PUT',
      url: `/admin/orders/${ORDER_ID}`,
      payload: { status: 'paid' },
    })

    expect(res.statusCode).toBe(200)
    expect(h.completeOrder).not.toHaveBeenCalled()
    expect(h.refundOrder).not.toHaveBeenCalled()
  })

  it('履约服务失败时 409,不写库', async () => {
    h.state.selectQueue.push([{ status: 'pending', orderNo: ORDER_NO }])
    h.completeOrder.mockResolvedValue({ success: false, reason: '订单状态不可完成' })

    const res = await app.inject({
      method: 'PUT',
      url: `/admin/orders/${ORDER_ID}`,
      payload: { status: 'paid' },
    })

    expect(res.statusCode).toBe(409)
    expect(h.state.writes).toHaveLength(0)
  })

  it('仅改非状态字段时两表同步(不触发状态机)', async () => {
    h.state.selectQueue.push([{ status: 'pending', orderNo: ORDER_NO }])
    h.state.selectQueue.push([orderRow({ remark: '后台备注' })])

    const res = await app.inject({
      method: 'PUT',
      url: `/admin/orders/${ORDER_ID}`,
      payload: { remark: '后台备注', payType: 'wechat' },
    })

    expect(res.statusCode).toBe(200)
    expect(h.completeOrder).not.toHaveBeenCalled()
    expect(h.state.writes).toHaveLength(2)
    expect(h.state.writes[0]?.values).toMatchObject({ remark: '后台备注', payType: 'wechat' })
    expect(h.state.writes[1]?.values).toMatchObject({
      remark: '后台备注',
      paymentMethod: 'wechat',
    })
  })

  it('订单不存在 404', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/admin/orders/${ORDER_ID}`,
      payload: { status: 'paid' },
    })

    expect(res.statusCode).toBe(404)
    expect(h.completeOrder).not.toHaveBeenCalled()
  })
})
