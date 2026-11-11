// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-21 回归:学费入账业务日键必须是上海日,不能用 UTC 日。
 *
 * 原缺陷:order-service 的 applyEduTuitionOrder 用 `new Date().toISOString().slice(0,10)`
 * 写 edu_payment_record.payment_date(上海业务日列),上海 00:00–08:00 的支付会被记到
 * 前一天(月初 1 日直接落到上月),与 edu-ledger 的 todayIso()(bizDayKey)口径分叉。
 *
 * 不连 DB:日键纯函数边界用例 + 源码形状断言 + mock db 的行为用例。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order } from '@ihui/database'
import { bizDayKey } from '../src/utils/biz-day.js'

type Row = Record<string, unknown>

const mocks = vi.hoisted(() => ({
  findOrderByNo: vi.fn<(orderNo: string) => Promise<Order | undefined>>(),
  updateOrderStatus:
    vi.fn<(orderNo: string, status: string, fromStatus?: string) => Promise<Order | undefined>>(),
  recordPayment: vi.fn<(input: Record<string, unknown>) => Promise<void>>(),
  selectQueue: [] as Row[][],
}))

function chain(rows: Row[]): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  for (const method of ['from', 'where', 'limit', 'orderBy', 'set', 'values', 'returning']) {
    c[method] = () => c
  }
  c.then = (resolve: (value: Row[]) => unknown) => Promise.resolve(resolve(rows))
  return c
}

vi.mock('../src/db/index.js', () => {
  const stub: Record<string, unknown> = {
    select: () => chain(mocks.selectQueue.shift() ?? []),
    insert: () => chain([]),
    update: () => chain([]),
    delete: () => chain([]),
    execute: async () => [],
  }
  stub.transaction = async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => fn(stub)
  return { db: stub, dbRead: stub }
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/db/payment-queries.js', () => ({
  createOrder: vi.fn(),
  findOrderByNo: mocks.findOrderByNo,
  updateOrderStatus: mocks.updateOrderStatus,
  queryPendingOrders: vi.fn(),
  listPaidOrdersByDate: vi.fn(),
}))

vi.mock('../src/db/commission-queries.js', () => ({
  rechargeToken: vi.fn(),
  deductToken: vi.fn(),
  refundTokenDeduct: vi.fn(),
}))

vi.mock('../src/services/points-service.js', () => ({
  earnPoints: vi.fn(),
  spendPoints: vi.fn(),
}))

vi.mock('../src/utils/outbox.js', () => ({
  writeToOutbox: vi.fn(),
}))

vi.mock('../src/services/topup-discount-service.js', () => ({
  calculateTopupBonus: vi.fn(),
}))

vi.mock('../src/services/edu-ledger.js', () => ({
  recordPayment: mocks.recordPayment,
}))

vi.mock('../src/services/sms-notify.js', () => ({
  sendNoticeSmsToUser: vi.fn(),
}))

import { completeOrder } from '../src/services/order-service.js'

const USER_ID = '00000000-0000-4000-8000-0000000000a1'
const ENROLLMENT_ID = '00000000-0000-4000-8000-0000000000c1'

function tuitionOrder(): Order {
  const now = new Date('2026-11-10T10:00:00.000Z')
  return {
    id: '00000000-0000-4000-8000-0000000000b1',
    orderNo: 'ORD-F21-1',
    userId: USER_ID,
    planId: null,
    amount: 9900,
    currency: 'CNY',
    status: 'pending',
    paymentMethod: 'wechat',
    orderType: 9,
    productId: ENROLLMENT_ID,
    targetId: null,
    targetTitle: null,
    quantity: 1,
    originalPrice: 9900,
    discountAmount: 0,
    paidAt: null,
    cancelTime: null,
    refundTime: null,
    expiresAt: null,
    remark: null,
    createdBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
  }
}

function stageTuition(order: Order): void {
  let current = order
  mocks.findOrderByNo.mockImplementation(async (orderNo: string) =>
    orderNo === current.orderNo ? { ...current } : undefined,
  )
  mocks.updateOrderStatus.mockImplementation(
    async (orderNo: string, status: string, fromStatus?: string) => {
      if (orderNo !== current.orderNo) return undefined
      if (fromStatus !== undefined && current.status !== fromStatus) return undefined
      current = { ...current, status }
      return { ...current }
    },
  )
  // 第一次 select = receipt_no 查重(空);第二次 = edu_enrollment 归属校验。
  mocks.selectQueue.push(
    [],
    [{ id: ENROLLMENT_ID, studentId: USER_ID, classId: '00000000-0000-4000-8000-0000000000c2' }],
  )
}

beforeEach(() => {
  mocks.findOrderByNo.mockReset()
  mocks.updateOrderStatus.mockReset()
  mocks.recordPayment.mockReset()
  mocks.recordPayment.mockResolvedValue(undefined)
  mocks.selectQueue.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('bizDayKey 上海日界边界', () => {
  it('上海 00:30(UTC 前一日 16:30)落上海的当天,而不是 UTC 前一天', () => {
    expect(bizDayKey(new Date('2026-11-10T16:30:00.000Z'))).toBe('2026-11-11')
  })

  it('上海 23:30(UTC 同日 15:30)仍落上海的当天', () => {
    expect(bizDayKey(new Date('2026-11-11T15:30:00.000Z'))).toBe('2026-11-11')
  })
})

describe('学费订单入账写上海业务日', () => {
  it('上海 00:30 的支付,paymentDate 记当日(2026-11-11)而非 UTC 的 2026-11-10', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T16:30:00.000Z'))
    stageTuition(tuitionOrder())

    const result = await completeOrder('ORD-F21-1')

    expect(result.success).toBe(true)
    expect(mocks.recordPayment).toHaveBeenCalledTimes(1)
    expect(mocks.recordPayment.mock.calls[0]![0]!.paymentDate).toBe('2026-11-11')
    expect(mocks.recordPayment.mock.calls[0]![0]!.receiptNo).toBe('ORD-F21-1')
  })

  it('上海 23:30 的支付,paymentDate 仍记当日(2026-11-11)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-11T15:30:00.000Z'))
    stageTuition(tuitionOrder())

    const result = await completeOrder('ORD-F21-1')

    expect(result.success).toBe(true)
    expect(mocks.recordPayment).toHaveBeenCalledTimes(1)
    expect(mocks.recordPayment.mock.calls[0]![0]!.paymentDate).toBe('2026-11-11')
  })
})

describe('order-service 源码形状', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/services/order-service.ts', import.meta.url)),
    'utf8',
  )

  it('不再用 UTC 日键 toISOString().slice(0,10) 写业务日', () => {
    // 只查代码,注释里描述旧写法不算
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/toISOString\(\)\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/)
  })

  it('复用 utils/biz-day 的唯一出口 bizDayKey()', () => {
    expect(source).toMatch(/import\s*\{\s*bizDayKey\s*\}\s*from\s*'\.\.\/utils\/biz-day\.js'/)
    expect(source).toMatch(/const today = bizDayKey\(\)/)
    expect(source).toMatch(/paymentDate:\s*today/)
  })
})
