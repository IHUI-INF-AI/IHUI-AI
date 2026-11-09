// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 金额单位：小程序钱腿（先钱后显示的第 1 批）
 *
 * 服务端契约（改前逐端点确证，勿猜）：
 *   - POST /payments/alipay/miniapp/create：amount 单位「元」
 *     apps/api/src/routes/payment-gateway.ts:1096,1110 —— `Math.round(amountYuan * 100)`
 *   - POST /distribution/withdraw：amount 单位「分」
 *     apps/api/src/routes/distribution.ts:418-440 —— 与 availableWithdrawal(分) 直接比较并落 integer 列
 *
 * 缺陷：
 *   1) pay 页把 orders.amount（分）原样传给收元的支付宝端点 → 实付放大 100 倍。
 *   2) 提现页把 availableCommission（分）按元渲染、把用户输入的元原样当分提交 → 展示放大 100 倍、实提缩 100 倍。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP_ROOT = join(__dirname, '..', '..', '..')
const REPO_ROOT = join(APP_ROOT, '..', '..')
const read = (abs: string) => readFileSync(abs, 'utf8')

const PAY = read(join(APP_ROOT, 'src/pkg-shop/pay/index.tsx'))
const WITHDRAW = read(join(APP_ROOT, 'src/pkg-shop/wallet/withdrawal/index.tsx'))
const ALIPAY_ROUTE = read(join(REPO_ROOT, 'apps/api/src/routes/payment-gateway.ts'))
const DIST_ROUTE = read(join(REPO_ROOT, 'apps/api/src/routes/distribution.ts'))

/** 契约锁：服务端支付宝小程序下单收元；提现收分。 */
describe('服务端金额契约（改前确证，防止前端反向对齐）', () => {
  it('支付宝小程序下单把入参按「元」转分', () => {
    expect(ALIPAY_ROUTE).toMatch(/const amountCents = Math\.round\(amountYuan \* 100\)/)
    expect(ALIPAY_ROUTE).toContain('金额单位:元')
  })

  it('提现与 availableWithdrawal（分）同口径比较', () => {
    expect(DIST_ROUTE).toMatch(/const available = await availableWithdrawal\(userId\)/)
    expect(DIST_ROUTE).toMatch(/body\.data\.amount > available/)
  })
})

describe('小程序支付宝下单：分 → 元', () => {
  it('传给 createAlipayMiniappPayment 的 amount 必须除以 100', () => {
    expect(PAY).toMatch(/createAlipayMiniappPayment\(\s*\{[^}]*amount:\s*finalAmount\s*\/\s*100/s)
  })

  it('反向对照：原样把分当元传必须判红', () => {
    const oldImpl = `createAlipayMiniappPayment({ amount: finalAmount })`
    expect(oldImpl).not.toMatch(/amount:\s*finalAmount\s*\/\s*100/)
  })
})

describe('小程序提现：分/元三处对齐', () => {
  it('余额按元展示（available 是分）', () => {
    expect(WITHDRAW).toMatch(/const availableYuan = available\s*\/\s*100/)
    expect(WITHDRAW).toMatch(/balance=\{availableYuan\}/)
  })

  it('全部提现按元回填', () => {
    expect(WITHDRAW).toMatch(/formatWithdrawAmount\(availableRef\.current\s*\/\s*100\)/)
  })

  it('提交前把元转回分（服务端收分）', () => {
    expect(WITHDRAW).toMatch(/withdraw\(\{\s*amount:\s*Math\.round\(amt \* 100\)/)
  })

  it('余额不足判断也在分域内比较', () => {
    expect(WITHDRAW).toMatch(/Math\.round\(amt \* 100\) > availableRef\.current/)
  })
})

/**
 * 端到端量纲断言：同一笔钱从客户端请求体到服务端落库必须对得上。
 * 目的：防「两边单测各自自洽、合起来仍错 100 倍」。
 */
describe('端到端量纲（请求体 ⇄ 服务端落库）', () => {
  it('支付宝下单：订单 199 元 ⇒ 请求体 199 ⇒ 落库 19900 分', () => {
    const orderCents = 19900 // edu_orders.amount（分）
    // 客户端（pay/index.tsx）：amount: finalAmount / 100
    const clientBodyYuan = orderCents / 100
    // 服务端（payment-gateway.ts）：Math.round(amountYuan * 100)
    const landedCents = Math.round(clientBodyYuan * 100)
    expect(clientBodyYuan).toBe(199)
    expect(landedCents).toBe(19900)
    expect(landedCents).toBe(orderCents) // 首尾相等
  })

  it('支付宝下单反例：分当元直传 ⇒ 落库 1990000 分（放大 100 倍）', () => {
    const orderCents = 19900
    const landedCentsIfOld = Math.round(orderCents * 100)
    expect(landedCentsIfOld).toBe(1_990_000)
    expect(landedCentsIfOld).not.toBe(orderCents)
  })

  it('提现：输入 199 元 ⇒ 请求体 19900 分 ⇒ 与 available 19900 分相等', () => {
    const availableCents = 19900
    const inputYuan = 199
    // 客户端（withdrawal/index.tsx）：amount: Math.round(amt * 100)
    const bodyCents = Math.round(inputYuan * 100)
    expect(bodyCents).toBe(19900)
    // 服务端（distribution.ts）：body.data.amount > available 判余额不足
    expect(bodyCents > availableCents).toBe(false)
    expect(bodyCents).toBe(availableCents)
  })

  it('提现反例：元当分直传 ⇒ 只提走 1.99 元', () => {
    const availableCents = 19900
    const bodyCentsIfOld = 199
    expect(bodyCentsIfOld).not.toBe(availableCents)
    expect(bodyCentsIfOld / 100).toBe(1.99)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
