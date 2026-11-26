// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LLM 积分换算单测(纯函数,不连库)。
 *
 * 口径:points = ceil(prompt/1000 × input_points_per_1k + completion/1000 × output_points_per_1k)
 * - 输入/输出分开计价,输出贵就用输出价;
 * - 有 token 就最少 1 积分,零 token 才 0;
 * - 不再有 0 倍率免费档。
 */
import { describe, expect, it } from 'vitest'
import { computeLlmPoints, readMaxCompletionTokens } from '../src/services/ai-points-billing.js'

describe('computeLlmPoints', () => {
  it('输入/输出分开计价并向上取整', () => {
    expect(
      computeLlmPoints({
        promptTokens: 1000,
        completionTokens: 0,
        inputPointsPer1k: 1,
        outputPointsPer1k: 30,
      }),
    ).toBe(1)
    expect(
      computeLlmPoints({
        promptTokens: 500,
        completionTokens: 500,
        inputPointsPer1k: 2,
        outputPointsPer1k: 4,
      }),
    ).toBe(3)
    expect(
      computeLlmPoints({
        promptTokens: 1500,
        completionTokens: 500,
        inputPointsPer1k: 10,
        outputPointsPer1k: 10,
      }),
    ).toBe(20)
  })

  it('输出比输入贵时不会被输入价稀释', () => {
    expect(
      computeLlmPoints({
        promptTokens: 1000,
        completionTokens: 4096,
        inputPointsPer1k: 17.82,
        outputPointsPer1k: 71.28,
      }),
    ).toBe(310) // 17.82 + 291.96 ≈ 309.78 → 310
  })

  it('有 token 至少 1 积分,零 token 才 0', () => {
    expect(
      computeLlmPoints({
        promptTokens: 1,
        completionTokens: 0,
        inputPointsPer1k: 0.1,
        outputPointsPer1k: 0.1,
      }),
    ).toBe(1)
    expect(
      computeLlmPoints({
        promptTokens: 0,
        completionTokens: 0,
        inputPointsPer1k: 30,
        outputPointsPer1k: 30,
      }),
    ).toBe(0)
  })

  it('负数 token 按 0 处理,不产生负积分', () => {
    expect(
      computeLlmPoints({
        promptTokens: -10,
        completionTokens: 0,
        inputPointsPer1k: 3,
        outputPointsPer1k: 3,
      }),
    ).toBe(0)
    expect(
      computeLlmPoints({
        promptTokens: 1000,
        completionTokens: -5,
        inputPointsPer1k: 3,
        outputPointsPer1k: 3,
      }),
    ).toBe(3)
  })

  it('非法费率不产生负积分', () => {
    expect(
      computeLlmPoints({
        promptTokens: 1000,
        completionTokens: 0,
        inputPointsPer1k: Number.NaN,
        outputPointsPer1k: Number.NaN,
      }),
    ).toBe(0)
    expect(
      computeLlmPoints({
        promptTokens: 1000,
        completionTokens: 0,
        inputPointsPer1k: -3,
        outputPointsPer1k: -3,
      }),
    ).toBe(0)
  })
})

describe('readMaxCompletionTokens', () => {
  it('兼容 max_tokens / max_completion_tokens / maxTokens / max_output_tokens', () => {
    expect(readMaxCompletionTokens({ max_tokens: 100 })).toBe(100)
    expect(readMaxCompletionTokens({ max_completion_tokens: 200 })).toBe(200)
    expect(readMaxCompletionTokens({ maxTokens: 300 })).toBe(300)
    expect(readMaxCompletionTokens({ max_output_tokens: 400 })).toBe(400)
  })

  it('缺省用 4096;非法/0/负数用 4096;超大值夹到 128K', () => {
    expect(readMaxCompletionTokens({})).toBe(4096)
    expect(readMaxCompletionTokens({ max_tokens: 0 })).toBe(4096)
    expect(readMaxCompletionTokens({ max_tokens: -1 })).toBe(4096)
    expect(readMaxCompletionTokens({ max_tokens: Number.NaN })).toBe(4096)
    expect(readMaxCompletionTokens({ max_tokens: 999_999 })).toBe(131_072)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
