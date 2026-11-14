// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-550 回归锁(2026-11-13)。
 *
 * 病灶:对账 buildDiff 只用 orderNo 做集合差,远端账单解析出来的 amount / tradeStatus
 * 从不参与比较 ⇒ 少付、费率差、退款/关闭单一律判「已对上」,资金口径长期不一致。
 *
 * 本文件锁:
 *   ① 金额不一致(分口径)必须进 amount_mismatch,不能被沉默;
 *   ② 交易状态非成功(退款/关闭)必须进 status_mismatch,且退款单独标 reason;
 *   ③ 单号、金额、状态三项全一致时不得误报;
 *   ④ 差异明细有上限,但 stats 计数是全量。
 *
 * 订单与账单全部走桩替身,不连真实 PG / 支付宝 / 微信。
 */
import type * as AlipayModuleForMock from '../src/services/alipay.js'
import type * as WechatPayModuleForMock from '../src/services/wechat-pay.js'
import type * as OrderServiceModuleForMock from '../src/services/order-service.js'
import type { Order } from '@ihui/database'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

const stub = vi.hoisted(() => ({
  orders: [] as unknown[],
  alipayCsv: '',
  wechatCsv: '',
}))

vi.mock('../src/services/alipay.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AlipayModuleForMock>()
  return {
    ...actual,
    downloadBillUrl: vi.fn(async () => 'https://stub.invalid/alipay-bill.csv'),
  }
})

vi.mock('../src/services/wechat-pay.js', async (importOriginal) => {
  const actual = await importOriginal<typeof WechatPayModuleForMock>()
  return {
    ...actual,
    downloadBill: vi.fn(async () => stub.wechatCsv),
  }
})

vi.mock('../src/services/order-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof OrderServiceModuleForMock>()
  return {
    ...actual,
    findPaidOrdersByDate: vi.fn(async () => stub.orders as Order[]),
    findExpiredOrders: vi.fn(async () => []),
  }
})

import { reconcileAlipay, reconcileWechat } from '../src/services/reconciliation-service.js'

const BILL_DATE = '2026-11-12'

/** 本地已付订单:amount 单位为分。 */
const order = (orderNo: string, amount: number, over: Partial<Order> = {}): Order =>
  ({ orderNo, amount, currency: 'CNY', status: 'paid', ...over }) as Order

/** 支付宝明细段:账务流水号,商户订单号,交易金额,交易状态,备注,费率 —— 6 列以满足解析器。 */
const alipayCsv = (rows: Array<{ orderNo: string; amount: string; status: string }>): string =>
  [
    '#支付宝业务明细查询',
    '账务流水号,商户订单号,交易金额,交易状态,备注,费率',
    ...rows.map((r, i) => `2026111200${i},${r.orderNo},${r.amount},${r.status},,0.6`),
  ].join('\n')

/**
 * 微信账单:解析器按 V3 固定索引兜底(6=商户订单号,9=交易状态,12=应结订单金额),
 * 数据行 13 列。表头行以「交易时间」开头,解析器会跳过。
 */
const wechatCsv = (rows: Array<{ orderNo: string; amount: string; status: string }>): string =>
  [
    '微信支付账单明细',
    '交易时间,公众账号ID,商户号,特约商户号,设备号,微信订单号,商户订单号,用户标识,交易类型,交易状态,付款银行,货币种类,应结订单金额',
    ...rows.map((r) =>
      [
        '2026-11-12 10:00:00',
        'wx-app',
        '4200001',
        '',
        '',
        '4200000001',
        r.orderNo,
        'openid',
        '支付',
        r.status,
        '招商银行',
        'CNY',
        r.amount,
      ].join(','),
    ),
  ].join('\n')

const fetchMock = vi.fn<typeof fetch>()

describe('F-550 对账必须同时校验单号 / 金额 / 交易状态', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    stub.orders = []
    stub.alipayCsv = ''
    stub.wechatCsv = ''
    fetchMock.mockReset()
    fetchMock.mockImplementation(
      async () =>
        new Response(stub.alipayCsv, {
          status: 200,
          headers: { 'Content-Type': 'text/csv' },
        }),
    )
  })

  it('① 金额不一致(12.34 元 vs 本地 12.00 元)必须报 amount_mismatch', async () => {
    stub.orders = [order('F550-AMOUNT', 1200)]
    stub.alipayCsv = alipayCsv([{ orderNo: 'F550-AMOUNT', amount: '12.34', status: 'TRADE_SUCCESS' }])

    const result = await reconcileAlipay(BILL_DATE)

    expect(result.diff.stats).toMatchObject({ matched: 0, amountMismatch: 1, statusMismatch: 0 })
    expect(result.diff.amountMismatch).toHaveLength(1)
    expect(result.diff.amountMismatch[0]).toMatchObject({
      type: 'amount_mismatch',
      orderNo: 'F550-AMOUNT',
      localAmount: 1200,
      remoteAmount: '12.34',
      remoteAmountFen: 1234,
      reason: 'amount_diff',
    })
    // 金额差不是「本地缺失」,不得混入 missing_in_gateway
    expect(result.diff.missingInGateway).toEqual([])
  })

  it('② 交易状态非成功(退款单)必须报 status_mismatch 并标注 refund', async () => {
    stub.orders = [order('F550-REFUND', 1234)]
    stub.wechatCsv = wechatCsv([{ orderNo: 'F550-REFUND', amount: '12.34', status: 'REFUND' }])

    const result = await reconcileWechat(BILL_DATE)

    expect(result.error).toBeUndefined()
    expect(result.remoteCount).toBe(1)
    expect(result.diff.stats).toMatchObject({ matched: 0, statusMismatch: 1, amountMismatch: 0 })
    expect(result.diff.statusMismatch).toHaveLength(1)
    expect(result.diff.statusMismatch[0]).toMatchObject({
      type: 'status_mismatch',
      orderNo: 'F550-REFUND',
      tradeStatus: 'REFUND',
      reason: 'refund',
    })
  })

  it('③ 单号 / 金额 / 状态全一致时不得误报', async () => {
    stub.orders = [order('F550-OK', 1234)]
    stub.alipayCsv = alipayCsv([{ orderNo: 'F550-OK', amount: '12.34', status: 'TRADE_SUCCESS' }])

    const result = await reconcileAlipay(BILL_DATE)

    expect(result.diff.stats).toEqual({
      matched: 1,
      missingInGateway: 0,
      amountMismatch: 0,
      statusMismatch: 0,
      onlyRemote: 0,
    })
    expect(result.diff.missingInGateway).toEqual([])
    expect(result.diff.amountMismatch).toEqual([])
    expect(result.diff.statusMismatch).toEqual([])
    expect(result.diff.onlyLocal).toEqual([])
  })

  it('④ 差异明细封顶 50 条,但 stats 计数是全量', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => {
      const orderNo = `F550-BULK-${i}`
      return { orderNo, amount: '99.99', status: 'TRADE_SUCCESS' }
    })
    stub.orders = rows.map((r) => order(r.orderNo, 1234))
    stub.alipayCsv = alipayCsv(rows)

    const result = await reconcileAlipay(BILL_DATE)

    expect(result.diff.stats.amountMismatch).toBe(60)
    expect(result.diff.amountMismatch).toHaveLength(50)
  })
})
