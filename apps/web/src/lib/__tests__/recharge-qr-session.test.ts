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
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
