// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LLM 结算按预扣快照费率，不在冻结窗口内跟着后台调价走。
 * 纯单测，mock 掉积分账与实时费率读取。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  settlePointsUsage: vi.fn(),
  getPointsHoldPricingSnapshot: vi.fn(),
  getLlmPointsRates: vi.fn(),
  recordAiCost: vi.fn(),
}))

vi.mock('../src/services/points-service.js', () => ({
  settlePointsUsage: mocks.settlePointsUsage,
  getPointsHoldPricingSnapshot: mocks.getPointsHoldPricingSnapshot,
  reservePointsUsage: vi.fn(),
}))

vi.mock('../src/services/llm-points-pricing.js', () => ({
  LLM_COST_MARKUP: 3,
  LLM_UNKNOWN_POINTS_PER_1K: 30,
  getLlmPointsRates: mocks.getLlmPointsRates,
}))

vi.mock('../src/plugins/ai-cost.js', () => ({
  recordAiCost: mocks.recordAiCost,
}))

import { settleLlmPointsUsage } from '../src/services/ai-points-billing.js'

describe('settleLlmPointsUsage 定价快照', () => {
  beforeEach(() => {
    mocks.settlePointsUsage.mockReset().mockResolvedValue({
      deducted: 40,
      remaining: 0,
      shortfall: 0,
      alreadySettled: false,
    })
    mocks.getPointsHoldPricingSnapshot.mockReset().mockResolvedValue(null)
    mocks.recordAiCost.mockReset().mockResolvedValue({ cost: 0, currency: 'CNY' })
    mocks.getLlmPointsRates.mockReset().mockResolvedValue({
      inputPointsPer1k: 999,
      outputPointsPer1k: 999,
      pricingModelId: 'test/model',
      inputCostPer1k: 333,
      outputCostPer1k: 333,
      costBasis: 'config',
      displayMultiplier: 999,
    })
  })

  it('有快照时按快照费率结算，不读实时高价', async () => {
    mocks.getPointsHoldPricingSnapshot.mockResolvedValueOnce({
      inputPointsPer1k: 10,
      outputPointsPer1k: 30,
      pricingSource: 'ai_pricing',
    })
    const result = await settleLlmPointsUsage({
      userId: 'u-1',
      modelId: 'test/model',
      promptTokens: 1000,
      completionTokens: 1000,
      source: 'llm_chat',
      referenceId: 'conv:msg',
    })

    expect(result.quote.points).toBe(40)
    expect(mocks.settlePointsUsage).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 40, referenceId: 'conv:msg' }),
    )
    expect(mocks.recordAiCost).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test/model',
        requestType: 'llm_chat',
        costStatus: 'priced',
        cost: 666,
      }),
    )
  })

  it('无快照时回退当前费率', async () => {
    const result = await settleLlmPointsUsage({
      userId: 'u-1',
      modelId: 'test/model',
      promptTokens: 1000,
      completionTokens: 0,
      source: 'llm_chat',
      referenceId: 'conv:msg-2',
    })

    expect(result.quote.points).toBe(999)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
