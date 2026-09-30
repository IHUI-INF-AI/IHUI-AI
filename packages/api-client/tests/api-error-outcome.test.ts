// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-01 票3:判别式 outcome + 稳定 code 跨进程可判 + 禁文本判流程。
 *
 * 票面验收口径落到 carrier/短信这类外部通道:
 *   ① 调用失败的返回对象必须同时含 failureStage ∈ {client_validation,
 *      upstream_request, local_persist} 与 errorCategory,且 message 不携带
 *      "429" 这类状态数字 —— "限流"判定只能由 errorCategory 得出;
 *   ② 负例:伪造 {message:'quota exceeded'} 但 errorCategory 缺失时,判定器必须
 *      返回 false(按文本判的实现会返回 true,测试即红)。
 */
import { describe, it, expect } from 'vitest'
import {
  ApiError,
  API_FAILURE_STAGES,
  createApiError,
  isApiError,
  isApiErrorCategory,
  isErrorCode,
} from '../src/api-error.js'

describe('票3 · carrier 类外部通道的失败形态', () => {
  it('失败对象同时含 failureStage 与 errorCategory;message 不携带 429 字样', () => {
    const err = createApiError({
      message: '短信通道返回限流文案',
      errorCategory: 'rate_limited',
      failureStage: 'upstream_request',
      errorCode: 'RATE_LIMITED',
      status: 429,
    })
    expect(isApiError(err)).toBe(true)
    expect(err.errorCategory).toBe('rate_limited')
    expect(API_FAILURE_STAGES).toContain(err.failureStage)
    // 限流判定只由 errorCategory 得出;message 只是文案,不得含状态数字
    expect(err.message).not.toMatch(/429/)
  })

  it('isApiErrorCategory 按封闭类别判:true / false 各一条', () => {
    const rateLimited = createApiError({
      message: 'rate limited',
      errorCategory: 'rate_limited',
      failureStage: 'upstream_request',
    })
    expect(isApiErrorCategory(rateLimited, 'rate_limited')).toBe(true)
    expect(isApiErrorCategory(rateLimited, 'quota_exhausted')).toBe(false)
  })

  it('负例:伪造 {message:"quota exceeded"} 且 errorCategory 缺失 → 判定器必须 false', () => {
    const fake = { message: 'quota exceeded' }
    expect(isApiErrorCategory(fake, 'quota_exhausted')).toBe(false)
    expect(isApiError(fake)).toBe(false)
  })

  it('老判定器不回归:isErrorCode 仍按稳定 code 字段比对', () => {
    const err = new ApiError('boom', 429, 'RATE_LIMITED')
    expect(isErrorCode(err, 'RATE_LIMITED')).toBe(true)
    expect(isErrorCode(err, 'OTHER')).toBe(false)
    expect(isErrorCode({ message: 'RATE_LIMITED' }, 'RATE_LIMITED')).toBe(false)
  })

  it('新建的 ApiError 未给类别时,类别判定不得误真', () => {
    const bare = new ApiError('boom')
    expect(isApiErrorCategory(bare, 'internal')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
