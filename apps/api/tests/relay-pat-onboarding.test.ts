// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PAT 引导层的行为锁(2026-11-18 立)。
 *
 * P1 形态判据:空 / 含空白 / 过短 / 含非法字符 逐条拒;正常票过。
 * P2 引导计划:缺生成入口要 warn(不是悄悄跳过),步骤恒为 4 条。
 * P3 生效判据:只有 2xx 算 valid;401/403 算 invalid;429/5xx/非鉴权码一律 unjudged。
 * P4 不判死  :没状态码 = unjudged,不许当无效。
 */
import { describe, it, expect } from 'vitest'
import { inspectPatShape, planPatOnboarding, judgePatProbeResult } from '../src/services/relay-pat-onboarding.js'

describe('relay-pat-onboarding', () => {
  it('P1 空票 / 含空白 / 过短 / 非法字符 均判不过', () => {
    expect(inspectPatShape('').looksValid).toBe(false)
    expect(inspectPatShape(' abc').reason).toContain('空白')
    expect(inspectPatShape('short').reason).toContain('偏短')
    expect(inspectPatShape('a b c d e f g h i j').reason).toContain('空白')
    expect(inspectPatShape('bad token with 中文').looksValid).toBe(false)
  })

  it('P1b 正常形态通过且提示"形态≠有效"', () => {
    const r = inspectPatShape('pt_' + 'a'.repeat(30))
    expect(r.looksValid).toBe(true)
    expect(r.reason).toContain('不等于有效')
  })

  it('P2 引导计划恒 4 步;缺生成入口要 warn', () => {
    const noUrl = planPatOnboarding({ pastedToken: 'pt_' + 'a'.repeat(30) })
    expect(noUrl.steps).toHaveLength(4)
    expect(noUrl.steps[0]!.state).toBe('warn')
    expect(noUrl.issuanceUrl).toBeNull()
    expect(noUrl.verdict).toContain('缺生成入口')

    const withUrl = planPatOnboarding({ issuanceUrl: 'https://x', pastedToken: 'pt_' + 'a'.repeat(30) })
    expect(withUrl.steps[0]!.state).toBe('done')
    expect(withUrl.verdict).toContain('验证')
  })

  it('P3 只有 2xx 算 valid,401/403 算 invalid', () => {
    expect(judgePatProbeResult({ httpStatus: 200 }).state).toBe('valid')
    expect(judgePatProbeResult({ httpStatus: 401 }).state).toBe('invalid')
    expect(judgePatProbeResult({ httpStatus: 403 }).state).toBe('invalid')
  })

  it('P3b 429 / 5xx / 其它码一律 unjudged', () => {
    expect(judgePatProbeResult({ httpStatus: 429 }).state).toBe('unjudged')
    expect(judgePatProbeResult({ httpStatus: 503 }).state).toBe('unjudged')
    expect(judgePatProbeResult({ httpStatus: 418, bodyText: 'teapot' }).state).toBe('unjudged')
  })

  it('P4 没状态码 = unjudged,不当无效', () => {
    const r = judgePatProbeResult({ httpStatus: null })
    expect(r.state).toBe('unjudged')
    expect(r.reason).toContain('不能判')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
