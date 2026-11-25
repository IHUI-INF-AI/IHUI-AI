// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上游错误消息打码单测(2026-11-25 审计点名):
 * 审计确认"无已证实外泄",但点名 qoder 错误面与 TraeAuthFailureError 只截断不打码。
 * 本文件把"消息里不许出现上游回传的凭据原文"钉成判据,防止回归。
 */
import { describe, it, expect } from 'vitest'
import {
  TraeAuthFailureError,
  TraeUpstreamError,
} from '../src/services/upstream-adapters/trae-adapter.js'
import { QoderUpstreamError } from '../src/services/upstream-adapters/qoder-adapter.js'

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.c2lnbmature_dummy_payload'
const BEARER_TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789'

describe('上游错误消息打码', () => {
  it('TraeAuthFailureError:键值 token/cookie 不原样进 message', () => {
    const e = new TraeAuthFailureError(
      401,
      'body={"access_token":"tok-abc-12345678","cookie":"sid=deadbeefcafe"}',
    )
    expect(e.statusCode).toBe(401)
    expect(e.message).toContain('HTTP 401')
    expect(e.message).not.toContain('tok-abc-12345678')
    expect(e.message).not.toContain('deadbeefcafe')
  })

  it('TraeAuthFailureError:裸 JWT / Bearer 也被盖住', () => {
    const e = new TraeAuthFailureError(403, `auth=Bearer ${BEARER_TOKEN} jwt=${JWT}`)
    expect(e.message).toContain('HTTP 403')
    expect(e.message).not.toContain(BEARER_TOKEN)
    expect(e.message).not.toContain(JWT)
  })

  it('TraeUpstreamError:同一出口打码后截断', () => {
    const e = new TraeUpstreamError(500, `upstream echo: {"token":"${JWT}"}`)
    expect(e.statusCode).toBe(500)
    expect(e.message).not.toContain(JWT)
    expect(e.message.length).toBeLessThanOrEqual(500)
  })

  it('QoderUpstreamError:上游回传 token 不原样进 message', () => {
    const e = new QoderUpstreamError(502, `bridge echo: {"access_token":"${JWT}"}`)
    expect(e.statusCode).toBe(502)
    expect(e.message).not.toContain(JWT)
    expect(e.message.length).toBeLessThanOrEqual(500)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
