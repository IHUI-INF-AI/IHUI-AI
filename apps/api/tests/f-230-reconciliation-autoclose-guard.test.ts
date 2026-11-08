// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-230 夹具:自动关单必须用条件 UPDATE 抢占 pending,不得覆盖已支付订单。

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

const { mockFindExpiredOrders, mockUpdateOrderStatus, mockAliCloseOrder, mockWxCloseOrder } =
  vi.hoisted(() => ({
    mockFindExpiredOrders: vi.fn(),
    mockUpdateOrderStatus: vi.fn(),
    mockAliCloseOrder: vi.fn(),
    mockWxCloseOrder: vi.fn(),
  }))

vi.mock('../src/services/alipay.js', () => ({
  downloadBillUrl: vi.fn(),
  closeOrder: mockAliCloseOrder,
}))

vi.mock('../src/services/wechat-pay.js', () => ({
  downloadBill: vi.fn(),
  closeOrder: mockWxCloseOrder,
}))

vi.mock('../src/services/order-service.js', () => ({
  findPaidOrdersByDate: vi.fn(),
  findExpiredOrders: mockFindExpiredOrders,
}))

vi.mock('../src/db/payment-queries.js', () => ({
  updateOrderStatus: mockUpdateOrderStatus,
}))

import { autoCloseExpiredOrders } from '../src/services/reconciliation-service.js'

describe('F-230 autoCloseExpiredOrders 状态守卫', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('以 pending 为前置状态做条件更新,已支付订单不计入 closed', async () => {
    mockFindExpiredOrders.mockResolvedValue([
      { orderNo: 'ORDER-PAID', paymentMethod: 'alipay' },
      { orderNo: 'ORDER-PENDING', paymentMethod: 'wechat' },
    ])
    // 第一单在关渠道单期间被用户支付成功 → 条件 UPDATE 影响 0 行
    mockUpdateOrderStatus.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      orderNo: 'ORDER-PENDING',
      status: 'cancelled',
    })

    const result = await autoCloseExpiredOrders()

    expect(mockUpdateOrderStatus).toHaveBeenNthCalledWith(1, 'ORDER-PAID', 'cancelled', 'pending')
    expect(mockUpdateOrderStatus).toHaveBeenNthCalledWith(
      2,
      'ORDER-PENDING',
      'cancelled',
      'pending',
    )
    expect(result.closed).toEqual(['ORDER-PENDING'])
    // 变异自证:去掉第三参 'pending' 后,第一条调用断言翻红;
    // 把 `if (updated)` 去掉后,ORDER-PAID 会被计入 closed,第二条断言翻红。
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
