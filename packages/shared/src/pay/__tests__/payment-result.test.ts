// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * I-08 支付结果三态契约夹具（2026-11-27）。
 * 三端（Web 充值结果页 / RN PayResultScreen / 小程序 pay/result 壳）共用同一映射，
 * 任何未知状态都不得被判成 paid。
 */
import { describe, expect, it } from 'vitest'
import {
  isPaymentResultTerminal,
  normalizePaymentResultStatus,
  PAYMENT_RESULT_MAX_POLLS,
  PAYMENT_RESULT_POLL_INTERVAL_MS,
} from '../payment-result'

describe('normalizePaymentResultStatus — 三端结果页三态', () => {
  it('paid 只认字面量 paid', () => {
    expect(normalizePaymentResultStatus('paid')).toBe('paid')
  })

  it('pending/processing 保持等待', () => {
    expect(normalizePaymentResultStatus('pending')).toBe('pending')
    expect(normalizePaymentResultStatus('processing')).toBe('pending')
  })

  it('取消/关闭/退款/失败/空值一律 failed，不冒充成功', () => {
    for (const status of ['cancelled', 'closed', 'refunded', 'failed', '', null, undefined, 'unknown']) {
      expect(normalizePaymentResultStatus(status)).toBe('failed')
    }
  })

  it('终态判定与轮询契约', () => {
    expect(isPaymentResultTerminal('pending')).toBe(false)
    expect(isPaymentResultTerminal('paid')).toBe(true)
    expect(isPaymentResultTerminal('failed')).toBe(true)
    expect(PAYMENT_RESULT_POLL_INTERVAL_MS).toBe(2000)
    expect(PAYMENT_RESULT_MAX_POLLS).toBe(30)
  })
})
