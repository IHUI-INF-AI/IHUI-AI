// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-635 回归锁(2026-11-13)。
 *
 * 病灶:下单入口本地订单按 `Math.round(amount*100)` 取分,网关金额串按 `amount.toFixed(2)`
 * 取元,两者在半分/浮点边界分叉(0.015 → 本地 2 分而网关 "0.01"),回调金额校验不符导致
 * 订单不置成功;若放宽校验则 1 分买到 2 分额度。
 *
 * 本文件锁:
 *   ① `yuanToCents` 是唯一取整口径,本地分值与网关串由同一整数互相还原;
 *   ② 覆盖 0.015 / 0.005 / 19.999 / 0.1+0.2 等半分与浮点边界;
 *   ③ 源锁:两条下单入口都调用 yuanToCents,网关串由 amountCents 派生,
 *      回退到裸 Math.round / body.amount.toFixed 即变红。
 *
 * 只 mock 数据库/网关/鉴权模块,不触达 PG、Redis、支付宝。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/plugins/auth.js', () => ({ authenticate: vi.fn() }))
vi.mock('../src/db/fund-queries.js', () => ({
  findFunds: vi.fn(),
  findFundByCode: vi.fn(),
  findFundNetValues: vi.fn(),
}))
vi.mock('../src/db/order-queries.js', () => ({ findOrderByOrderNo: vi.fn() }))
vi.mock('../src/db/payment-queries.js', () => ({ createOrder: vi.fn() }))
vi.mock('../src/services/alipay.js', () => ({
  isAlipayConfigured: vi.fn(),
  buildSignedUrl: vi.fn(),
}))

import { yuanToCents } from '../src/routes/user/fund-routes.js'

/** 网关金额串的唯一派生方式:由整数分还原元,固定两位小数。 */
const gatewayAmount = (cents: number): string => (cents / 100).toFixed(2)

/** 元 → 分 → 网关串 → 分,必须回到同一个整数。 */
function assertRoundTrip(amount: number, expectedCents: number): void {
  const cents = yuanToCents(amount)
  expect(cents).toBe(expectedCents)
  const gateway = gatewayAmount(cents)
  expect(yuanToCents(Number(gateway))).toBe(cents)
  expect(gateway).toBe(gatewayAmount(expectedCents))
}

describe('F-635 yuanToCents:元 → 分 唯一口径', () => {
  it('半分/浮点边界:0.015、0.005、19.999、0.1+0.2', () => {
    // 缺陷成因:裸 toFixed(2) 与 Math.round(*100) 在 0.015 上分叉
    expect((0.015).toFixed(2)).toBe('0.01')
    assertRoundTrip(0.015, 2)
    assertRoundTrip(0.005, 1)
    assertRoundTrip(19.999, 2000)
    assertRoundTrip(0.1 + 0.2, 30)
  })

  it('常规金额:分值稳定,网关串可反解回同一分', () => {
    assertRoundTrip(0.01, 1)
    assertRoundTrip(19.99, 1999)
    assertRoundTrip(100.5, 10050)
    assertRoundTrip(1_000_000, 100_000_000)
  })

  it('网关串一律两位小数,且与分值同源', () => {
    for (const amount of [0.015, 0.005, 19.999, 0.1 + 0.2, 19.99, 100.5]) {
      expect(gatewayAmount(yuanToCents(amount))).toMatch(/^\d+\.\d{2}$/)
    }
    expect(gatewayAmount(yuanToCents(0.015))).toBe('0.02')
    expect(gatewayAmount(yuanToCents(0.005))).toBe('0.01')
    expect(gatewayAmount(yuanToCents(19.999))).toBe('20.00')
    expect(gatewayAmount(yuanToCents(0.1 + 0.2))).toBe('0.30')
  })
})

describe('F-635 源锁:两条入口同源装车', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/routes/user/fund-routes.ts', import.meta.url)),
    'utf8',
  )

  it('两条下单入口都用 yuanToCents 取整,不再裸算浮点', () => {
    expect(source.match(/const amountCents = yuanToCents\(body\.amount\)/g)).toHaveLength(2)
    expect(source).not.toContain('Math.round(body.amount * 100)')
  })

  it('网关金额串由 amountCents 派生,不再直接取 body.amount', () => {
    expect(source.match(/total_amount: \(amountCents \/ 100\)\.toFixed\(2\)/g)).toHaveLength(2)
    expect(source).not.toContain('body.amount.toFixed(2)')
  })
})
