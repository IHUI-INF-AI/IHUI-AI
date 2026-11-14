// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-678 回归锁(2026-11-13)。
 *
 * 病灶:ForwardResult.lastHttpStatus 只写不读 —— 上游 400/401/404/429 经渠道腿与
 * 账号池腿后都被压成 ok:false,v1-public 固定回 503,客户端无法区分参数错/鉴权错/
 * 未知模型/限流与网关不可用,重试策略失效。
 *
 * 锁定消费侧判据 mapForwardFailureToHttp:
 *   ① 4xx 原样映射同状态码(400/401/404/429);
 *   ② 429 且上游给了 Retry-After 时原样透传,没给则不伪造;
 *   ③ 无 lastHttpStatus(无可用上游 / 网络错)与 5xx 保持 503。
 * 任一条被改回「一律 503」,本文件的 ①② 用例即变红。
 */
import { describe, expect, it } from 'vitest'
import { mapForwardFailureToHttp } from '../src/services/relay-forward-failure.js'

describe('F-678 转发失败 → 对外 HTTP 状态映射', () => {
  it('上游 400(参数错)原样映射 400,不再压成 503', () => {
    expect(mapForwardFailureToHttp({ lastHttpStatus: 400 })).toEqual({ status: 400 })
  })

  it('上游 401(鉴权错)原样映射 401', () => {
    expect(mapForwardFailureToHttp({ lastHttpStatus: 401 })).toEqual({ status: 401 })
  })

  it('上游 404(未知模型/路径)原样映射 404', () => {
    expect(mapForwardFailureToHttp({ lastHttpStatus: 404 })).toEqual({ status: 404 })
  })

  it('上游 429(限流)映射 429 并透传上游给的 Retry-After', () => {
    expect(mapForwardFailureToHttp({ lastHttpStatus: 429, retryAfter: '30' })).toEqual({
      status: 429,
      retryAfter: '30',
    })
  })

  it('429 但上游未给 Retry-After:映射 429 且不伪造该头', () => {
    expect(mapForwardFailureToHttp({ lastHttpStatus: 429 })).toEqual({ status: 429 })
  })

  it('无 lastHttpStatus(无可用上游 / 网络错)保持 503', () => {
    expect(mapForwardFailureToHttp(null)).toEqual({ status: 503 })
    expect(mapForwardFailureToHttp(undefined)).toEqual({ status: 503 })
    expect(mapForwardFailureToHttp({})).toEqual({ status: 503 })
  })

  it('上游 5xx 保持 503(网关侧上游不可用)', () => {
    expect(mapForwardFailureToHttp({ lastHttpStatus: 500 })).toEqual({ status: 503 })
    expect(mapForwardFailureToHttp({ lastHttpStatus: 502 })).toEqual({ status: 503 })
    expect(mapForwardFailureToHttp({ lastHttpStatus: 503 })).toEqual({ status: 503 })
  })

  it('非 2xx/4xx 的异常状态码同样保持 503(只映射 4xx)', () => {
    expect(mapForwardFailureToHttp({ lastHttpStatus: 302 })).toEqual({ status: 503 })
  })
})
