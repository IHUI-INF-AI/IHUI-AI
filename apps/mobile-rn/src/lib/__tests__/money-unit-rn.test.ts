// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 金额单位：RN 支付确认弹窗与订单详情（先钱后显示第 3 批，属「用户看到错数字 / 功能不可用」）
 *
 * 服务端契约（改前确证）：
 *   - GET /payments/me → payAmount 为「元」（apps/api/src/db/payment-queries.ts:98 centsToYuanString）
 *   - POST /payments/wechat/create → amount 为「分」（payment-gateway.ts 微信统一下单）
 *   - GET /orders/:no → 返回 edu_orders 原始行，只有 payAmount（元），没有 amount（order.ts:486-494）
 *   - POST /orders/:id/refund → refundAmount 必须是数字字符串（order.ts:136-139 priceSchema）
 *
 * 缺陷：
 *   1) PaymentScreen 把已是「元」的 pendingPurchase.amount 再 /100 给弹窗 ⇒ 显示 1/100。
 *   2) OrderDetailScreen 映射不存在的 res.data.amount ⇒ amount=undefined：
 *      详情金额空白、立即支付 NaN、退款体字段被丢弃（或传 number 被 schema 拒）。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP_ROOT = join(__dirname, '..', '..', '..')
const read = (abs: string) => readFileSync(abs, 'utf8')

const PAYMENT = read(join(APP_ROOT, 'src/screens/PaymentScreen.tsx'))
const ORDER_DETAIL = read(join(APP_ROOT, 'src/screens/OrderDetailScreen.tsx'))

describe('RN 支付确认弹窗：元不得再除 100', () => {
  it('弹窗价格直接用元值', () => {
    expect(PAYMENT).toMatch(/\bprice:\s*\(?pendingPurchase\.amount \?\? 0\)?\s*,/)
    expect(PAYMENT).not.toMatch(/\bprice:\s*\(pendingPurchase\.amount \?\? 0\)\s*\/\s*100/)
  })

  it('发起微信支付仍把元转分（服务端收分）', () => {
    expect(PAYMENT).toMatch(/amount:\s*Math\.round\(\(order\.amount \?\? 0\) \* 100\)/)
  })
})

describe('RN 订单详情：映射 payAmount（元）且退款传字符串', () => {
  it('详情金额取 payAmount', () => {
    expect(ORDER_DETAIL).toMatch(/Number\(row\.payAmount \?\? row\.amount \?\? 0\)/)
    expect(ORDER_DETAIL).not.toMatch(/amount:\s*res\.data\.amount,/s)
  })

  it('退款金额按后端 priceSchema 传两位小数字符串', () => {
    expect(ORDER_DETAIL).toMatch(/refundAmount:\s*order\.amount\.toFixed\(2\)/)
  })
})
