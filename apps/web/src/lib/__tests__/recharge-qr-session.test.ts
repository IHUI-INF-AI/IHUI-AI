// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearRechargeQr,
  formatOrderAmount,
  normalizePaymentMethod,
  readRechargeQr,
  saveRechargeQr,
} from '../recharge-qr-session'

describe('充值扫码凭据会话暂存(W-07)', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('按 orderNo 保存并读取二维码凭据', () => {
    saveRechargeQr('NO-1', {
      codeUrl: 'weixin://wxpay/bizpayurl?pr=abc',
      payUrl: 'https://openapi.alipay.com/gateway.do?x=1',
    })
    expect(readRechargeQr('NO-1')).toEqual({
      codeUrl: 'weixin://wxpay/bizpayurl?pr=abc',
      payUrl: 'https://openapi.alipay.com/gateway.do?x=1',
    })
    expect(readRechargeQr('NO-2')).toBeNull()
  })

  it('拒绝 javascript:/data: 等危险二维码内容', () => {
    saveRechargeQr('NO-1', {
      codeUrl: 'javascript:alert(1)',
      payUrl: 'data:text/html,<script>alert(1)</script>',
    })
    expect(readRechargeQr('NO-1')).toBeNull()
  })

  it('损坏的 JSON / 非对象返回 null', () => {
    sessionStorage.setItem('ihui:recharge:qr:NO-1', '{not-json')
    expect(readRechargeQr('NO-1')).toBeNull()
    sessionStorage.setItem('ihui:recharge:qr:NO-2', '"str"')
    expect(readRechargeQr('NO-2')).toBeNull()
  })

  it('clearRechargeQr 移除对应订单的凭据', () => {
    saveRechargeQr('NO-1', { codeUrl: 'weixin://wxpay/bizpayurl?pr=abc' })
    clearRechargeQr('NO-1')
    expect(readRechargeQr('NO-1')).toBeNull()
  })

  it('支付方式只做白名单映射,未知值不展示', () => {
    expect(normalizePaymentMethod('wechat_native')).toBe('wechat')
    expect(normalizePaymentMethod('wechat')).toBe('wechat')
    expect(normalizePaymentMethod('alipay')).toBe('alipay')
    expect(normalizePaymentMethod('unknown')).toBeNull()
    expect(normalizePaymentMethod(null)).toBeNull()
  })

  it('订单金额从分转元展示', () => {
    expect(formatOrderAmount(100)).toBe('1.00')
    expect(formatOrderAmount(1)).toBe('0.01')
    expect(formatOrderAmount(undefined)).toBeNull()
    expect(formatOrderAmount(-1)).toBeNull()
  })

  // 行为级钉子:成功页金额/二维码唯一可信源 = 服务端订单(order)与同源 sessionStorage,
  // 不接受 URL query 里的 amount / codeUrl / payUrl / method(否则可构造链接做支付钓鱼)。
  it('成功页不读取 URL 里的金额/二维码/支付方式参数,只读 orderNo', () => {
    const fs = require('node:fs')
    const path = require('node:path')
    const success = fs.readFileSync(
      path.resolve(__dirname, '../../../app/(main)/wallet/recharge/success/PageClient.tsx'),
      'utf8',
    )
    expect(success).toContain("searchParams.get('orderNo')")
    for (const untrusted of ['amount', 'method', 'codeUrl', 'payUrl']) {
      expect(success).not.toContain(`searchParams.get('${untrusted}')`)
      expect(success).not.toContain(`searchParams.get("${untrusted}")`)
    }
  })

  it('URL 伪造的金额与二维码不被采信:展示金额与二维码只来自服务端/同源数据', () => {
    const fs = require('node:fs')
    const path = require('node:path')
    const success = fs.readFileSync(
      path.resolve(__dirname, '../../../app/(main)/wallet/recharge/success/PageClient.tsx'),
      'utf8',
    )
    // 展示金额 = 服务端订单金额(分→元),不接受 URL 传入的明文 amount 字符串
    expect(success).toMatch(/formatOrderAmount\(order\?\.amount\)/)
    // 支付方式 = 服务端订单字段白名单映射,不接受 URL method
    expect(success).toMatch(/normalizePaymentMethod\(order\?\.paymentMethod\)/)
    // 二维码内容 = 下单页写入 sessionStorage 的同源凭据(readRechargeQr),不接受 URL codeUrl/payUrl
    expect(success).toMatch(/readRechargeQr\(orderNo\)/)
    expect(success).toMatch(/method === 'alipay' \? qr\?\.payUrl : method === 'wechat' \? qr\?\.codeUrl/)
  })

  it('下单页只把 orderNo 写进 URL,二维码凭据不进 URL query', () => {
    const fs = require('node:fs')
    const path = require('node:path')
    for (const rel of [
      '../../../app/(main)/wallet/recharge/page.tsx',
      '../../../app/(main)/purchase/TopupTab.tsx',
    ]) {
      const src = fs.readFileSync(path.resolve(__dirname, rel), 'utf8')
      expect(src).toContain('saveRechargeQr')
      expect(src).not.toContain("params.set('codeUrl'")
      expect(src).not.toContain("params.set('payUrl'")
      expect(src).not.toContain("params.set('amount'")
      expect(src).toMatch(/wallet\/recharge\/success\?orderNo=/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
