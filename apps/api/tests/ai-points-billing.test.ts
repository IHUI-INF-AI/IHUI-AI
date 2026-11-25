/**
 * LLM 积分换算单测(纯函数,不连库)。
 *
 * 口径:ceil((prompt + completion) / 1000 × 倍率);0 倍率/0 token 恒为 0。
 */
import { describe, expect, it } from 'vitest'
import { computeLlmPoints } from '../src/services/ai-points-billing.js'

describe('computeLlmPoints', () => {
  it('按千 token × 倍率向上取整', () => {
    expect(computeLlmPoints({ promptTokens: 1000, completionTokens: 0, multiplier: 1 })).toBe(1)
    expect(computeLlmPoints({ promptTokens: 500, completionTokens: 500, multiplier: 3 })).toBe(3)
    expect(computeLlmPoints({ promptTokens: 1, completionTokens: 0, multiplier: 10 })).toBe(1)
    expect(computeLlmPoints({ promptTokens: 1500, completionTokens: 500, multiplier: 10 })).toBe(20)
  })

  it('0 倍率 / 0 token 不扣分', () => {
    expect(computeLlmPoints({ promptTokens: 5000, completionTokens: 5000, multiplier: 0 })).toBe(0)
    expect(computeLlmPoints({ promptTokens: 0, completionTokens: 0, multiplier: 30 })).toBe(0)
  })

  it('负数 token 与非法倍率按 0 处理,不产生负积分', () => {
    expect(computeLlmPoints({ promptTokens: -10, completionTokens: 0, multiplier: 3 })).toBe(0)
    expect(computeLlmPoints({ promptTokens: 1000, completionTokens: 0, multiplier: Number.NaN })).toBe(0)
    expect(computeLlmPoints({ promptTokens: 1000, completionTokens: 0, multiplier: -3 })).toBe(0)
  })
})
