// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'

import { toUserFriendlyMessage } from '@ihui/shared/utils'

/**
 * 消费侧契约:HTTP 失败带 status 时,**绝不**把上游正文念给用户。
 *
 * 链路两端各测一半(本包能同时看到两端,所以放这里):
 *  - `packages/api-client/tests/http-error-meta.test.ts` 测 fetchRaw/fetchText 有没有挂上 status;
 *  - 这里测挂上之后 `toUserFriendlyMessage` 是否真的因此避开"原样返回正文"那一支。
 *
 * 背景:fetchRaw/fetchText 曾只抛 `Error("<status>: <raw body>")`。TTS 等调用方把
 * e.message 丢给 toUserFriendlyMessage 进 toast 时,该函数 errorCode / status 两步
 * 都取不到值,会退到第 4 步"已是中文就原样返回 / 否则英文关键词匹配 / 兜底",
 * 于是 nginx 429 的整页 HTML 有机会直接显示在手机上。
 */

function httpLikeError(status: number, body: string): Error {
  // 与 api-client 抛出的形状保持一致:message 里带正文,元信息挂在属性上。
  const error = new Error(`${status}: ${body}`) as Error & { status?: number }
  error.status = status
  return error
}

const NGINX_429_PAGE =
  '<html>\r\n<head><title>503 Service Temporarily Unavailable</title></head>\r\n' +
  '<body bgcolor="white"><center><h1>503 Service Temporarily Unavailable</h1></center></body>\r\n</html>'

describe('带 status 的 HTTP 错误不外泄正文', () => {
  it('429 + 整页 HTML → 返回状态码文案,不含标签、不含 "nginx"', () => {
    const out = toUserFriendlyMessage(httpLikeError(429, NGINX_429_PAGE))
    expect(out).not.toContain('<')
    expect(out).not.toContain('html')
    expect(out).not.toContain('Service Temporarily Unavailable')
    expect(out.length).toBeLessThan(40)
  })

  it('status 命中映射表时优先于正文(第 2 步早于第 4 步)', () => {
    const withStatus = toUserFriendlyMessage(httpLikeError(429, '请求频率过高 xyz'))
    const withoutStatus = toUserFriendlyMessage(new Error('429: 请求频率过高 xyz'))
    expect(withStatus).not.toBe(withoutStatus)
    expect(withStatus).not.toContain('xyz')
  })

  it('errorCode 比 status 更优先(业务码文案更精确)', () => {
    const error = httpLikeError(429, 'ignored') as Error & { errorCode?: string }
    error.errorCode = 'BUDGET_EXHAUSTED'
    const out = toUserFriendlyMessage(error)
    expect(out).not.toContain('ignored')
    expect(out.length).toBeGreaterThan(0)
  })

  it('无 status 无 errorCode 且正文是英文 → 落到安全兜底,不回显原文', () => {
    expect(toUserFriendlyMessage(new Error('429: upstream throttled the request'))).not.toContain(
      'upstream throttled',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
