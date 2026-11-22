// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流内信封错误判据(2026-11-17)。
 *
 * 钉住三件事:
 * ① 三种桥形态(error 字段 / statusCodeValue / code)都能认出来;
 * ② 只有瞬时档(408/418/425/429/5xx)算可重试,4xx 业务错永不重试;
 * ③ 判不出状态码时 retryable=false —— 宁可换号也不白等 4 秒。
 */
import { describe, expect, it } from 'vitest'
import {
  detectEnvelopeError,
  isRetryableEnvelopeStatus,
} from '../src/services/upstream-envelope-error.js'

describe('信封错误判据', () => {
  it('E1 statusCodeValue=418 数字形态 ⇒ 判出状态并标记可重试', () => {
    const r = detectEnvelopeError({ statusCodeValue: 418, errorMessage: 'upstream overloaded' })
    expect(r).not.toBeNull()
    expect(r?.status).toBe(418)
    expect(r?.retryable).toBe(true)
    expect(r?.source).toBe('status_code_value')
    expect(r?.detail).toContain('overloaded')
  })

  it('E2 statusCodeValue 字符串形态同样认', () => {
    const r = detectEnvelopeError({ statusCodeValue: '503', message: 'busy' })
    expect(r?.status).toBe(503)
    expect(r?.retryable).toBe(true)
  })

  it('E3 code=429 且带 message ⇒ 判可重试;纯业务码不认', () => {
    expect(detectEnvelopeError({ code: 429, message: 'rate limited' })?.retryable).toBe(true)
    expect(detectEnvelopeError({ code: 1001, message: 'biz code' })).toBeNull()
    expect(detectEnvelopeError({ code: 40401, message: 'biz code' })).toBeNull()
  })

  it('E4 官方 error 信封但无状态码 ⇒ 认得出,但不可重试', () => {
    const r = detectEnvelopeError({ error: { message: 'model not found' } })
    expect(r?.status).toBeNull()
    expect(r?.retryable).toBe(false)
    expect(r?.source).toBe('error_field')
  })

  it('E5 error 内嵌 status 可判档位', () => {
    const r = detectEnvelopeError({ error: { status: 500, message: 'boom' } })
    expect(r?.status).toBe(500)
    expect(r?.retryable).toBe(true)
  })

  it('E6 正常数据帧不误判', () => {
    expect(detectEnvelopeError({ choices: [{ delta: { content: 'hi' } }] })).toBeNull()
    expect(detectEnvelopeError({ usage: { total_tokens: 3 } })).toBeNull()
    expect(detectEnvelopeError(null)).toBeNull()
    expect(detectEnvelopeError('text')).toBeNull()
  })

  it('E7 瞬时档集合准确', () => {
    expect(isRetryableEnvelopeStatus(408)).toBe(true)
    expect(isRetryableEnvelopeStatus(418)).toBe(true)
    expect(isRetryableEnvelopeStatus(425)).toBe(true)
    expect(isRetryableEnvelopeStatus(429)).toBe(true)
    expect(isRetryableEnvelopeStatus(502)).toBe(true)
    expect(isRetryableEnvelopeStatus(599)).toBe(true)
    expect(isRetryableEnvelopeStatus(401)).toBe(false)
    expect(isRetryableEnvelopeStatus(403)).toBe(false)
    expect(isRetryableEnvelopeStatus(404)).toBe(false)
    expect(isRetryableEnvelopeStatus(400)).toBe(false)
    expect(isRetryableEnvelopeStatus(null)).toBe(false)
  })

  it('E8 statusCodeValue 越界(2xx/3xx)不当作故障', () => {
    expect(detectEnvelopeError({ statusCodeValue: 200, message: 'ok' })).toBeNull()
    expect(detectEnvelopeError({ statusCodeValue: 302 })).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
