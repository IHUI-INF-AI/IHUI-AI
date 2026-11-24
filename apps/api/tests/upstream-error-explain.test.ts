// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上游失败中文解释(2026-11-17)。
 *
 * 重点钉住两件容易做错的事:
 * ① 审核拒绝常被上游包成 403,判序必须先 audit 后 auth —— 否则用户被引去"重新登录";
 * ② 审核/参数类必须明确**不罚号**,即 penalizes_account=false(这是给用户的承诺)。
 */
import { describe, expect, it } from 'vitest'
import { explainUpstreamError } from '../src/services/upstream-error-explain.js'

describe('上游失败中文解释', () => {
  it('E1 403 + 审核词 ⇒ audit,且不罚号', () => {
    const r = explainUpstreamError(403, '{"error":"content_filter triggered"}')
    expect(r.category).toBe('audit')
    expect(r.penalizes_account).toBe(false)
    expect(r.message_zh).toContain('审核')
  })

  it('E2 403 无审核词 ⇒ auth(不能因为 403 就判审核)', () => {
    const r = explainUpstreamError(403, '{"error":"invalid token"}')
    expect(r.category).toBe('auth')
    expect(r.penalizes_account).toBe(true)
  })

  it('E3 中文审核措辞同样命中', () => {
    const r = explainUpstreamError(400, '内容包含敏感词,已被拦截')
    expect(r.category).toBe('audit')
  })

  it('E4 额度不足 ⇒ quota 且可重试', () => {
    const r = explainUpstreamError(429, '{"error":"insufficient credit"}')
    expect(r.category).toBe('quota')
    expect(r.retryable).toBe(true)
    expect(r.penalizes_account).toBe(true)
  })

  it('E5 纯限流 ⇒ rate', () => {
    const r = explainUpstreamError(429, '{"error":"rate limit exceeded"}')
    expect(r.category).toBe('rate')
  })

  it('E6 413 ⇒ too_large,不罚号不重试', () => {
    const r = explainUpstreamError(413, 'payload too large')
    expect(r.category).toBe('too_large')
    expect(r.penalizes_account).toBe(false)
    expect(r.retryable).toBe(false)
  })

  it('E7 400 无关键词 ⇒ invalid_request,不罚号', () => {
    const r = explainUpstreamError(400, '{"error":"unsupported parameter"}')
    expect(r.category).toBe('invalid_request')
    expect(r.penalizes_account).toBe(false)
  })

  it('E8 无状态(连接失败) ⇒ network 且可重试;5xx ⇒ server', () => {
    expect(explainUpstreamError(0, 'ECONNRESET').category).toBe('network')
    expect(explainUpstreamError(502, 'bad gateway').category).toBe('server')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
