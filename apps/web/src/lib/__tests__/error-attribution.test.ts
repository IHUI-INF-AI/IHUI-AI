// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-937980 错误归因证据强度阶梯单测。
 * 三条票面验收:401+quota 文案⇒auth_failed(弱文案不得覆盖);
 * EPIPE⇒network_error;不可信 providerId 的 1308⇒不判 quota_exhausted。
 */
import { describe, expect, it } from 'vitest'

import { resolveErrorAttribution } from '@/lib/error-attribution'

describe('resolveErrorAttribution — 票面验收(G-937980)', () => {
  it('401 + quota 字样 ⇒ auth_failed(强证据 HTTP status 优先,弱文案不得覆盖)', () => {
    expect(
      resolveErrorAttribution({
        statusCode: 401,
        message: 'Request failed: quota exceeded, 额度已用尽',
      }),
    ).toEqual({ errorSource: 'provider', failureReason: 'auth_failed' })
  })

  it('401 + quota 仅出现在裸文案中(无结构化 status 字段)⇒ auth_failed(弱文案层内 auth 先于 quota)', () => {
    expect(
      resolveErrorAttribution({
        message: 'Error: 401 Unauthorized — usage limit reached',
      }),
    ).toEqual({ errorSource: 'provider', failureReason: 'auth_failed' })
  })

  it('EPIPE ⇒ network_error(稳定传输码是比 provider source 更强的传输证据)', () => {
    expect(resolveErrorAttribution({ errorCode: 'EPIPE', message: 'write EPIPE' })).toEqual({
      errorSource: 'network',
      failureReason: 'network_error',
    })
  })

  it('message 中的 EPIPE(无 errorCode 字段)⇒ network_error', () => {
    expect(resolveErrorAttribution({ message: 'Error: write EPIPE while streaming' })).toEqual({
      errorSource: 'network',
      failureReason: 'network_error',
    })
  })

  it('不可信 providerId 的 1308 ⇒ 不判 quota_exhausted(业务码表不采信)', () => {
    const result = resolveErrorAttribution({
      providerId: 'custom-vendor-x',
      providerErrorCode: '1308',
      message: 'provider error',
    })
    expect(result.failureReason).not.toBe('quota_exhausted')
    expect(result).toEqual({ errorSource: '', failureReason: 'unknown' })
  })

  it('providerId 缺席的 1308 同样不判 quota_exhausted(缺身份即不可信)', () => {
    expect(
      resolveErrorAttribution({ providerErrorCode: '1308', message: 'provider error' }),
    ).toEqual({ errorSource: '', failureReason: 'unknown' })
  })

  it('可信 providerId 的 1308 ⇒ quota_exhausted(业务码表只对可信身份生效)', () => {
    expect(
      resolveErrorAttribution({
        providerId: 'zhipu',
        providerErrorCode: '1308',
        message: 'provider error',
      }),
    ).toEqual({ errorSource: 'provider', failureReason: 'quota_exhausted' })
  })
})

describe('resolveErrorAttribution — 阶梯排序', () => {
  it('结构化 reason 无歧义(network)⇒ 直接定桶,不被传输码/文案反超', () => {
    expect(
      resolveErrorAttribution({
        reason: 'network_error',
        errorCode: 'EPIPE',
        message: 'quota exceeded',
      }),
    ).toEqual({ errorSource: 'network', failureReason: 'network_error' })
  })

  it('结构化 reason 歧义(rate_limited)且缺双证据 ⇒ 保持 reason 不改写 quota', () => {
    expect(
      resolveErrorAttribution({
        reason: 'rate_limited',
        providerId: 'zhipu',
        providerErrorCode: '1308',
        message: 'busy',
      }),
    ).toEqual({ errorSource: '', failureReason: 'rate_limited' })
  })

  it('quota 终态改写需要双证据:rate_limited + 可信 providerId + retryable===false', () => {
    expect(
      resolveErrorAttribution({
        reason: 'rate_limited',
        retryable: false,
        providerId: 'ihui_relay',
        providerErrorCode: '1308',
        message: 'busy',
      }),
    ).toEqual({ errorSource: 'provider', failureReason: 'quota_exhausted' })
    // retryable 缺席 ⇒ 双证据不成立,保持 rate_limited
    expect(
      resolveErrorAttribution({
        reason: 'rate_limited',
        providerId: 'ihui_relay',
        providerErrorCode: '1308',
        message: 'busy',
      }).failureReason,
    ).toBe('rate_limited')
  })

  it('ETIMEDOUT ⇒ timeout(比笼统 network_error 更窄)', () => {
    expect(resolveErrorAttribution({ errorCode: 'ETIMEDOUT', message: 'request failed' })).toEqual({
      errorSource: 'network',
      failureReason: 'timeout',
    })
  })

  it('429 ⇒ rate_limited;5xx ⇒ server_error;408/504 ⇒ timeout(network)', () => {
    expect(resolveErrorAttribution({ statusCode: 429, message: '' }).failureReason).toBe(
      'rate_limited',
    )
    expect(resolveErrorAttribution({ statusCode: 502, message: '' }).failureReason).toBe(
      'server_error',
    )
    expect(resolveErrorAttribution({ statusCode: 504, message: '' })).toEqual({
      errorSource: 'network',
      failureReason: 'timeout',
    })
  })

  it('message 中的状态码提取是 keyword-gated:无 http/status 前缀的 401 不提', () => {
    // "quota exceeded (code 401)" 没有 keyword 前缀 ⇒ 不当状态码,落到 quota 文案
    expect(resolveErrorAttribution({ message: 'quota exceeded (code 401)' }).failureReason).toBe(
      'quota_exhausted',
    )
    // "status 401" 有 keyword 前缀 ⇒ 强证据 auth_failed
    expect(resolveErrorAttribution({ message: 'status 401: quota exceeded' }).failureReason).toBe(
      'auth_failed',
    )
  })

  it('legacy 三段 envelope:code 走码表,1234 ⇒ network_error 不误标 provider', () => {
    expect(
      resolveErrorAttribution({
        message: '[1234][zhipu][upstream disconnected] (request id: abc)',
      }),
    ).toEqual({ errorSource: 'network', failureReason: 'network_error' })
  })

  it('无任何证据 ⇒ unknown 兜底(不猜桶)', () => {
    expect(resolveErrorAttribution({ message: 'something happened' })).toEqual({
      errorSource: '',
      failureReason: 'unknown',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
