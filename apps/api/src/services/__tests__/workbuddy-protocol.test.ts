// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 钉住 classifyUpstreamFailure 的 11140 判序(2026-11-18 实测口径):
 * 上游把「账号被平台限制」和「模型侧限流」都包在 HTTP 403 里,若 403 先归 auth,
 * 承载层只会收敛 tokenExpiresAt(刷新救不回),健康探测读 profile 又判 healthy,
 * 号就永远在调度里每次 403、只堆 consecFail 不退出。故 11140 必须优先于 401/403 判。
 */
import { describe, it, expect } from 'vitest'
import { classifyUpstreamFailure } from '../upstream-adapters/workbuddy-protocol'

const RESTRICTED_BODY = JSON.stringify({
  code: 11140,
  msg: 'request illegal',
  requestId: 'fbf2c7ab-de74-4feb-8c0a-cf7a81e7198e',
  retry_policy: { retry: false },
  displayMsg: {
    en: 'Your account has been restricted due to unusual activity',
    zh: '账号存在异常行为，已被限制使用',
  },
  displayTips: { zh: '系统检测到该账号存在异常使用行为，如需申诉请提交反馈' },
  actions: ['EDIT_INPUT', 'SUBMIT_FEEDBACK'],
})

describe('classifyUpstreamFailure · workbuddy 11140 判序', () => {
  it('403 + 账号被限制文案 ⇒ risk(冷却+降级,不永久摘除)', () => {
    expect(classifyUpstreamFailure(403, RESTRICTED_BODY)).toBe('risk')
  })

  it('403 + 11140 但文案是 provider 限流 ⇒ rate', () => {
    const body = JSON.stringify({ code: 11140, msg: 'the model provider is rate-limiting' })
    expect(classifyUpstreamFailure(403, body)).toBe('rate')
  })

  it('403 无 11140 ⇒ 仍归 auth(回归:真凭据失效不能被改判)', () => {
    expect(classifyUpstreamFailure(403, JSON.stringify({ code: 1001, msg: 'unauthorized' }))).toBe(
      'auth',
    )
  })

  it('401 ⇒ auth(回归)', () => {
    expect(classifyUpstreamFailure(401, '{}')).toBe('auth')
  })

  it('402 ⇒ credit(回归)', () => {
    expect(classifyUpstreamFailure(402, '{}')).toBe('credit')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
