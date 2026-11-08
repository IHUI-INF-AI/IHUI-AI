// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-02 夹具：验证 createOrder / updateOrderStatus 在收到外层 tx 时
 * 不再自行开启独立事务（重复入账/半提交的根因）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const order = {
    id: 'order-uuid',
    orderNo: 'WX_TEST_0001',
    userId: 'user-1',
    amount: 9900,
    status: 'pending',
    orderType: 1,
    paymentMethod: 'wechat',
  }
  const returning = vi.fn(async () => [order])
  const values = vi.fn(() => {
    const p = Promise.resolve(undefined) as Promise<unknown> & { returning?: typeof returning }
    p.returning = returning
    return p
  })
  const where = vi.fn(() => {
    const p = Promise.resolve(undefined) as Promise<unknown> & { returning?: typeof returning }
    p.returning = returning
    return p
  })
  const tx = {
    insert: vi.fn(() => ({ values })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where })) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => [order]) })),
      })),
    })),
  }
  const db = {
    transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    insert: tx.insert,
    update: tx.update,
    select: tx.select,
  }
  return { order, returning, values, where, tx, db }
})

vi.mock('../src/db/index.js', () => ({ db: h.db, dbRead: h.db }))

describe('DB-02 下单/完成订单可加入外层事务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createOrder(outerTx) 不开启独立事务', async () => {
    const { createOrder } = await import('../src/db/payment-queries.js')
    const order = await createOrder(
      { userId: 'user-1', amount: 9900, orderType: 1, payType: 'wechat' },
      null,
      h.tx as never,
    )
    expect(order.orderNo).toBe('WX_TEST_0001')
    expect(h.db.transaction).not.toHaveBeenCalled()
    // orders + edu_orders 双写都落在传入的 tx 上
    expect(h.tx.insert).toHaveBeenCalledTimes(2)
  })

  it('updateOrderStatus(outerTx)（pending→paid）不开启独立事务', async () => {
    const { updateOrderStatus } = await import('../src/db/payment-queries.js')
    const updated = await updateOrderStatus('WX_TEST_0001', 'paid', 'pending', null, h.tx as never)
    expect(updated?.status).toBe('pending')
    expect(h.db.transaction).not.toHaveBeenCalled()
    // orders 状态 + edu_orders 同步都落在传入的 tx 上
    expect(h.tx.update).toHaveBeenCalledTimes(2)
  })

  it('未传 outerTx 时保持原行为（自开事务）', async () => {
    const { createOrder } = await import('../src/db/payment-queries.js')
    await createOrder({ userId: 'user-1', amount: 9900, orderType: 1, payType: 'wechat' }, null)
    expect(h.db.transaction).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
