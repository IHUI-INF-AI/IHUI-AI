// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-203 / 2026-11-26:Stock 分析只扣 AI 积分,钱包不再直接支付 AI 调用。
 *
 * 本版钉住:
 * - 预检按 prompt + 800 输出冻结,不再只判断“积分 > 0”;
 * - 未定价模型 503,不能免费跑;
 * - 成功后按真实 token 结算;降级/失败主动释放 hold。
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  quoteLlmPoints: vi.fn(),
  settleLlmPointsUsage: vi.fn(),
  reservePointsUsage: vi.fn(),
  releasePointsHold: vi.fn(async () => 0),
  resolveAiCost: vi.fn(),
  recordAiCost: vi.fn(),
}))

vi.mock('../src/services/ai-points-billing.js', () => ({
  quoteLlmPoints: mocks.quoteLlmPoints,
  settleLlmPointsUsage: mocks.settleLlmPointsUsage,
}))

vi.mock('../src/services/points-service.js', () => ({
  reservePointsUsage: mocks.reservePointsUsage,
  releasePointsHold: mocks.releasePointsHold,
}))

vi.mock('../src/plugins/ai-cost.js', () => ({
  resolveAiCost: mocks.resolveAiCost,
  recordAiCost: mocks.recordAiCost,
}))

import { executeStockAnalysis } from '../src/services/stock-service'

function quote(points: number) {
  return {
    promptTokens: 1,
    completionTokens: 800,
    totalTokens: 801,
    inputPointsPer1k: 30,
    outputPointsPer1k: 30,
    multiplier: 30,
    points,
    pricingModelId: 'stock-model',
    pricingSource: 'ai_pricing' as const,
  }
}

function okFetch() {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: 'AI 分析结果' } }],
      usage: { total_tokens: 1234 },
    }),
  }
}

describe('stock-service AI 积分计费', () => {
  beforeEach(() => {
    process.env.STOCK_API_KEY = 'test-key'
    process.env.STOCK_API_BASE = 'https://stock.test/v1'
    process.env.STOCK_MODEL_ID = 'stock-model'
    mocks.quoteLlmPoints.mockReset().mockResolvedValue(quote(49))
    mocks.reservePointsUsage.mockReset().mockResolvedValue({
      shortfall: 0,
      remaining: 951,
      deducted: 0,
      alreadySettled: false,
      alreadyHeld: false,
    })
    mocks.settleLlmPointsUsage.mockReset().mockResolvedValue({
      deducted: 49,
      remaining: 951,
      shortfall: 0,
      alreadySettled: false,
      quote: quote(49),
    })
    mocks.releasePointsHold.mockReset().mockResolvedValue(0)
    mocks.resolveAiCost.mockReset().mockResolvedValue({
      cost: 48.2,
      currency: 'CNY',
      pricing: null,
      pricingKnown: true,
    })
    mocks.recordAiCost.mockReset().mockResolvedValue({ cost: 49, currency: 'CNY' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  afterAll(() => {
    delete process.env.STOCK_API_KEY
    delete process.env.STOCK_API_BASE
    delete process.env.STOCK_MODEL_ID
  })

  it('调用前按 prompt + 800 冻结,成功后按真实 token 结算', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okFetch()),
    )

    const result = await executeStockAnalysis({ symbol: 'AAPL', question: 'abcd', userId: 'u1' })

    expect(mocks.quoteLlmPoints).toHaveBeenCalledWith({
      modelId: 'stock-model',
      promptTokens: 1,
      completionTokens: 800,
    })
    expect(mocks.reservePointsUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        amount: 49,
        source: 'stock_analysis',
        referenceId: expect.any(String),
      }),
    )
    expect(mocks.settleLlmPointsUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        modelId: 'stock-model',
        promptTokens: 1,
        completionTokens: 1233,
        source: 'stock_analysis',
        referenceId: expect.any(String),
        holdReferenceId: expect.any(String),
      }),
    )
    expect(mocks.recordAiCost).toHaveBeenCalled()
    expect(result.tokensUsed).toBe(1234)
  })

  it('冻结额不足时拒绝,不发起上游调用', async () => {
    const fetchMock = vi.fn(async () => okFetch())
    vi.stubGlobal('fetch', fetchMock)
    mocks.reservePointsUsage.mockResolvedValueOnce({
      shortfall: 39,
      remaining: 10,
      deducted: 0,
      alreadySettled: false,
      alreadyHeld: false,
    })

    await expect(
      executeStockAnalysis({ symbol: 'AAPL', question: 'abcd', userId: 'u1' }),
    ).rejects.toThrow(/积分不足: 需要 49 积分, 剩余 10 积分/)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.settleLlmPointsUsage).not.toHaveBeenCalled()
  })

  it('未定价模型 503,不发起上游调用', async () => {
    mocks.quoteLlmPoints.mockResolvedValueOnce({
      ...quote(4),
      pricingModelId: null,
      pricingSource: 'unknown_default',
    })
    const fetchMock = vi.fn(async () => okFetch())
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      executeStockAnalysis({ symbol: 'AAPL', question: 'abcd', userId: 'u1' }),
    ).rejects.toMatchObject({ statusCode: 503, errorCode: 'MODEL_PRICING_MISSING' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.reservePointsUsage).not.toHaveBeenCalled()
  })

  it('AI 调用失败降级为本地分析,不扣积分、不记成本、释放冻结', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('upstream down')
      }),
    )

    const result = await executeStockAnalysis({ symbol: 'AAPL', question: 'abcd', userId: 'u1' })

    expect(result.analysis).toContain('基础分析报告')
    expect(mocks.settleLlmPointsUsage).not.toHaveBeenCalled()
    expect(mocks.recordAiCost).not.toHaveBeenCalled()
    expect(mocks.releasePointsHold).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', source: 'stock_analysis' }),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
