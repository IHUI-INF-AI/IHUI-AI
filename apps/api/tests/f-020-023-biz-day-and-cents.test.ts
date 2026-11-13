// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-20 / F-23 回归:两处"口径不一致"的资金/统计缺陷。
 *
 * F-20(业务日区间):`points-tasks.ts` 的 `dayBounds` 用 `new Date(today + 'T00:00:00Z')`
 * 把**上海日键**当 UTC 日界。后果:00:00–08:00(北京时间)之间查到的是前一天的边界,
 * 今日任务进度恒 0;08:00 之后才"翻页"。本文件钉住"日界 = 上海 00:00"。
 *
 * F-23(退款金额):`payment-gateway.ts` 用 `amountYuan * 100 < order.amount` 直接比浮点,
 * 199.99 * 100 = 19999.999999999996 ⇒ 恰好等额的合法退款被判"小于",用户怎么填都不对。
 * 本文件钉住"比较前先取整成"分",且同文件不再有第二套换算"。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const POINTS = readFileSync(path.resolve(__dirname, '../src/routes/points-tasks.ts'), 'utf8')
const PAY = readFileSync(path.resolve(__dirname, '../src/routes/payment-gateway.ts'), 'utf8')

describe('F-20 业务日区间按上海日界', () => {
  it('dayBounds 不再把日键当 UTC 日界拼接', () => {
    // 只看函数体:文件别处(周起点 / 注释里的"修前形状")按 UTC 日历算周是合理的
    const block = POINTS.slice(
      POINTS.indexOf('function dayBounds('),
      POINTS.indexOf('function dayBounds(') + 1200,
    )
    expect(block).not.toMatch(/new Date\(today \+ 'T00:00:00Z'\)/)
    expect(block).not.toMatch(/new Date\(shiftDate\(today, 1\) \+ 'T00:00:00Z'\)/)
  })

  it('dayBounds 用 UTC 毫秒减去 8 小时得到上海 00:00', () => {
    const block = POINTS.slice(
      POINTS.indexOf('function dayBounds('),
      POINTS.indexOf('function dayBounds(') + 1200,
    )
    expect(block).toMatch(/Date\.UTC\(/)
    expect(block).toMatch(/8 \* 3600 \* 1000/)
  })

  it('区间右界是"次日 00:00"(左闭右开),不是当日 23:59:59', () => {
    const block = POINTS.slice(
      POINTS.indexOf('function dayBounds('),
      POINTS.indexOf('function dayBounds(') + 1200,
    )
    // 用 d + 1 推进到次日,而不是拼 23:59:59
    expect(block).toMatch(/d \+ 1/)
    expect(block).not.toMatch(/23:59/)
  })
})

describe('F-23 退款金额比较先取整成"分"', () => {
  it('比较表达式中不再有裸 amountYuan * 100', () => {
    expect(PAY).not.toMatch(/if \(amountYuan \* 100 [<>]/)
  })

  it('比较用的是取整后的分值', () => {
    expect(PAY).toMatch(/const refundCents = Math\.round\(amountYuan \* 100\)/)
    expect(PAY).toMatch(/if \(refundCents [<>] order\.amount\)/)
  })

  it('浮点陷阱用例:19.99 元的裸乘结果小于 1999 分,取整后才相等', () => {
    // 复现缺陷:19.99 * 100 = 1998.9999999999998 < 1999 ⇒ 等额退款被判"小于"
    expect(19.99 * 100).toBeLessThan(1999)
    expect(Math.round(19.99 * 100)).toBe(1999)
    // 同族:0.29 * 100 = 28.999999999999996
    expect(0.29 * 100).toBeLessThan(29)
    expect(Math.round(0.29 * 100)).toBe(29)
  })

  it('风控上报金额复用同一分值,不再二次换算', () => {
    const block = PAY.slice(
      PAY.indexOf('const refundCents'),
      PAY.indexOf('const refundCents') + 2500,
    )
    expect(block).toMatch(/amount: refundCents/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
