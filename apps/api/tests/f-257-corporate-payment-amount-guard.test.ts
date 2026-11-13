// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-257 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/developer/enterprise/corporate-payments 的 amountCents 由客户端
 * 自填,确认时只校验凭证/订单状态 ⇒ 提交 amountCents:0 也能在管理员确认后按原价
 * completeOrder(orderNo) 标记 paid 并充值。
 *
 * 本文件锁:
 *   ① amountCents=0 提交被拒(400 语义的 success:false),不落库;
 *   ② 小于订单金额(1 分)/大于订单金额(溢缴)同样被拒;
 *   ③ 等于订单金额提交成功,且落库 amountCents 取订单金额(不信客户端值);
 *   ④ 记录被篡改后确认被拒,completeOrder 零调用、凭证状态不变;
 *   ⑤ 正常金额确认仍调用 completeOrder + activateOrderSubscription(行为未回归);
 *   ⑥ 源锁:confirmCorporatePayment 内金额比对出现在 completeOrder 之前。
 *
 * 只 mock db / 订单查询 / 订单服务 / logger,不触达真实 PG、Redis。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => {
  type Row = Record<string, unknown>
  const state = {
    voucherRow: null as Row | null,
    dupRows: [] as Row[],
    inserted: [] as Row[],
    updateSets: [] as Row[],
  }

  // 服务里的 select 链只有 select().from().where().limit(1):
  // 确认路径要凭证行,登记路径要重复凭证检查结果。
  const selectImpl = () => ({
    from: () => ({
      where: () => ({
        limit: async () => (state.voucherRow ? [state.voucherRow] : state.dupRows),
      }),
    }),
  })

  const insertImpl = () => ({
    values: (v: Row) => {
      const row: Row = { id: 'voucher-f257', status: 'pending', ...v }
      state.inserted.push(row)
      return { returning: async () => [row] }
    },
  })

  const updateImpl = () => ({
    set: (s: Row) => {
      state.updateSets.push(s)
      return { where: () => ({ returning: async () => [{ ...(state.voucherRow ?? {}), ...s }] }) }
    },
  })

  const db = {
    select: vi.fn(selectImpl),
    insert: vi.fn(insertImpl),
    update: vi.fn(updateImpl),
    delete: vi.fn(),
    execute: vi.fn(),
  }

  return { state, db }
})

const orderMocks = vi.hoisted(() => ({ findOrderByNo: vi.fn() }))

const orderServiceMocks = vi.hoisted(() => ({
  completeOrder: vi.fn(),
  activateOrderSubscription: vi.fn(),
}))

const loggerMocks = vi.hoisted(() => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../src/db/index.js', () => ({
  db: h.db,
  dbRead: { select: vi.fn(), execute: vi.fn() },
  dbClient: {},
}))

vi.mock('../src/db/payment-queries.js', () => ({
  findOrderByNo: orderMocks.findOrderByNo,
}))

vi.mock('../src/services/order-service.js', () => ({
  completeOrder: orderServiceMocks.completeOrder,
  activateOrderSubscription: orderServiceMocks.activateOrderSubscription,
}))

vi.mock('../src/utils/logger.js', () => loggerMocks)

import {
  registerCorporatePayment,
  confirmCorporatePayment,
} from '../src/services/relay-enterprise-service.js'

const USER_ID = 'user-f257'
const ORDER_NO = 'ORD-20261113-F257'
const ORDER_ID = '22222222-2222-4222-8222-222222222222'
const VOUCHER_ID = '11111111-1111-4111-8111-111111111111'
const PAYER = '示例科技有限公司'

const baseOrder = (overrides: Record<string, unknown> = {}) => ({
  id: ORDER_ID,
  orderNo: ORDER_NO,
  userId: USER_ID,
  status: 'pending',
  amount: 9900,
  orderType: 6,
  productId: null,
  ...overrides,
})

const baseVoucher = (overrides: Record<string, unknown> = {}) => ({
  id: VOUCHER_ID,
  userId: USER_ID,
  orderId: ORDER_ID,
  orderNo: ORDER_NO,
  amountCents: 9900,
  payerCompany: PAYER,
  voucherUrl: null,
  remark: null,
  status: 'pending',
  ...overrides,
})

const register = (amountCents?: number) =>
  registerCorporatePayment(USER_ID, {
    orderNo: ORDER_NO,
    ...(amountCents === undefined ? {} : { amountCents }),
    payerCompany: PAYER,
  })

beforeEach(() => {
  vi.clearAllMocks()
  h.state.voucherRow = null
  h.state.dupRows = []
  h.state.inserted.length = 0
  h.state.updateSets.length = 0
  orderMocks.findOrderByNo.mockResolvedValue(baseOrder())
  orderServiceMocks.completeOrder.mockImplementation(async (orderNo: string) => ({
    success: true,
    order: { ...baseOrder({ status: 'paid' }), orderNo },
  }))
  orderServiceMocks.activateOrderSubscription.mockResolvedValue(undefined)
})

describe('F-257 对公打款金额必须与订单应付金额对齐', () => {
  it('① amountCents=0 提交被拒且不落库', async () => {
    const r = await register(0)

    expect(r.success).toBe(false)
    if (!r.success) expect(r.reason).toContain('金额')
    expect(h.db.insert).not.toHaveBeenCalled()
    expect(loggerMocks.logger.warn).toHaveBeenCalledTimes(1)
    expect(loggerMocks.logger.warn.mock.calls[0]![1]).toMatchObject({
      orderNo: ORDER_NO,
      submittedAmountCents: 0,
      expectedAmountCents: 9900,
    })
  })

  it('② amountCents=1(少付 1 分)提交被拒', async () => {
    const r = await register(1)

    expect(r.success).toBe(false)
    if (!r.success) expect(r.reason).toContain('金额')
    expect(h.db.insert).not.toHaveBeenCalled()
  })

  it('②b 多于订单金额(溢缴)同样被拒:本系统无溢缴款记账通道', async () => {
    const r = await register(9901)

    expect(r.success).toBe(false)
    if (!r.success) expect(r.reason).toContain('金额')
    expect(h.db.insert).not.toHaveBeenCalled()
  })

  it('③ 等于订单金额提交成功,落库金额取订单金额', async () => {
    const r = await register(9900)

    expect(r.success).toBe(true)
    expect(h.db.insert).toHaveBeenCalledTimes(1)
    expect(h.state.inserted).toHaveLength(1)
    expect(h.state.inserted[0]!.amountCents).toBe(9900)
    expect(h.state.inserted[0]!.orderNo).toBe(ORDER_NO)
    expect(loggerMocks.logger.warn).not.toHaveBeenCalled()
  })

  it('③b 未填金额时也按订单金额入库(不接受客户端缺省为 0)', async () => {
    const r = await register()

    expect(r.success).toBe(true)
    expect(h.state.inserted[0]!.amountCents).toBe(9900)
  })

  it('④ 记录被篡改后确认被拒:completeOrder 零调用、凭证不更新', async () => {
    h.state.voucherRow = baseVoucher({ amountCents: 1 })

    const r = await confirmCorporatePayment(VOUCHER_ID, 'admin-f257')

    expect(r.success).toBe(false)
    if (!r.success) expect(r.reason).toContain('金额')
    expect(orderServiceMocks.completeOrder).not.toHaveBeenCalled()
    expect(orderServiceMocks.activateOrderSubscription).not.toHaveBeenCalled()
    expect(h.db.update).not.toHaveBeenCalled()
    expect(loggerMocks.logger.warn).toHaveBeenCalledTimes(1)
    expect(loggerMocks.logger.warn.mock.calls[0]![1]).toMatchObject({
      voucherId: VOUCHER_ID,
      orderNo: ORDER_NO,
      voucherAmountCents: 1,
      expectedAmountCents: 9900,
    })
  })

  it('⑤ 正常金额确认仍调用 completeOrder 并激活订阅(行为未回归)', async () => {
    h.state.voucherRow = baseVoucher()

    const r = await confirmCorporatePayment(VOUCHER_ID, 'admin-f257')

    expect(r.success).toBe(true)
    expect(orderServiceMocks.completeOrder).toHaveBeenCalledTimes(1)
    expect(orderServiceMocks.completeOrder).toHaveBeenCalledWith(
      ORDER_NO,
      `corporate:${VOUCHER_ID}`,
    )
    expect(orderServiceMocks.activateOrderSubscription).toHaveBeenCalledTimes(1)
    expect(h.db.update).toHaveBeenCalledTimes(1)
    expect(h.state.updateSets[0]).toMatchObject({ status: 'confirmed', confirmedBy: 'admin-f257' })
  })

  it('⑤b 已确认凭证重复确认仍按原状态拒绝(幂等语义不变)', async () => {
    h.state.voucherRow = baseVoucher({ status: 'confirmed' })

    const r = await confirmCorporatePayment(VOUCHER_ID, 'admin-f257')

    expect(r.success).toBe(false)
    if (!r.success) expect(r.reason).toContain('confirmed')
    expect(orderServiceMocks.completeOrder).not.toHaveBeenCalled()
  })

  it('⑥ 源锁:confirmCorporatePayment 的金额比对在 completeOrder 之前', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/services/relay-enterprise-service.ts', import.meta.url)),
      'utf8',
    )
    const start = src.indexOf('export async function confirmCorporatePayment')
    const end = src.indexOf('export async function rejectCorporatePayment')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)

    const body = src.slice(start, end)
    const guard = body.indexOf('voucher.amountCents !== order.amount')
    const call = body.indexOf('completeOrder(')
    expect(guard).toBeGreaterThan(-1)
    expect(call).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(call)
  })
})
