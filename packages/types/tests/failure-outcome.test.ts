// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-01 票3:判别式 outcome 契约(types 权威面)。
 * FailureOutcomeSchema / isFailureOutcome / isFailureCategory / createFailureOutcome。
 * 判据:失败形态必须同时携带封闭 failureStage 与 errorCategory;
 * 只给 message 的伪造值必须判 false;未知字段判失败(strict 白面)。
 */
import { describe, it, expect } from 'vitest'
import {
  FAILURE_STAGES,
  createFailureOutcome,
  isFailureOutcome,
  isFailureCategory,
} from '../src/error-serialize.js'

describe('票3 · FailureOutcome(判别式 outcome)', () => {
  it('createFailureOutcome:同时携带 failureStage 与 errorCategory,归因保留', () => {
    const outcome = createFailureOutcome({
      failureStage: 'upstream_request',
      errorCategory: 'rate_limited',
      errorCode: 'RATE_LIMITED',
      message: '短信通道返回限流文案',
      attribution: 'carrier:sms',
    })
    expect(outcome.ok).toBe(false)
    expect(FAILURE_STAGES).toContain(outcome.failureStage)
    expect(outcome.errorCategory).toBe('rate_limited')
    expect(outcome.attribution).toBe('carrier:sms')
    // "限流"只能由 errorCategory 得出;message 不得携带状态数字
    expect(outcome.message).not.toMatch(/429/)
  })

  it('isFailureOutcome:三档 failureStage 全部可判', () => {
    for (const stage of FAILURE_STAGES) {
      const outcome = createFailureOutcome({ failureStage: stage, errorCategory: 'internal' })
      expect(isFailureOutcome(outcome)).toBe(true)
    }
  })

  it('负例:伪造 {message:"quota exceeded"} 但 errorCategory 缺失 → 必须 false', () => {
    expect(isFailureOutcome({ message: 'quota exceeded' })).toBe(false)
    expect(isFailureCategory({ message: 'quota exceeded' }, 'quota_exhausted')).toBe(false)
  })

  it('封闭联合:failureStage / errorCategory 越界值判 false', () => {
    expect(
      isFailureOutcome({ ok: false, failureStage: 'somewhere_else', errorCategory: 'internal' }),
    ).toBe(false)
    expect(
      isFailureOutcome({ ok: false, failureStage: 'local_persist', errorCategory: 'kind_of_bad' }),
    ).toBe(false)
  })

  it('strict 白面:未知字段判失败;ok:true 不冒充失败', () => {
    expect(
      isFailureOutcome({ ok: false, failureStage: 'local_persist', errorCategory: 'auth', junk: 1 }),
    ).toBe(false)
    expect(isFailureOutcome({ ok: true, failureStage: 'local_persist', errorCategory: 'auth' })).toBe(
      false,
    )
  })

  it('isFailureCategory:类别相等才 true,类别缺失即 false(不回退文本判)', () => {
    const outcome = createFailureOutcome({ failureStage: 'client_validation', errorCategory: 'validation' })
    expect(isFailureCategory(outcome, 'validation')).toBe(true)
    expect(isFailureCategory(outcome, 'rate_limited')).toBe(false)
    expect(isFailureCategory(undefined, 'validation')).toBe(false)
    expect(isFailureCategory('rate_limited', 'rate_limited')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
