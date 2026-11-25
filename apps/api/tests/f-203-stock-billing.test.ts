/**
 * F-203 / 2026-11-26:Stock 分析只扣 AI 积分,钱包不再直接支付 AI 调用。
 *
 * 旧行为:`estimatedTokens = ceil(chars/4)+800` 直接当钱包数量扣,钱包和积分两本账混在一起。
 * 现行为:调用前按模型倍率预估积分;成功后按真实 token 结算积分;
 * 平台真实成本另记 ai_cost_records,两本账分开。
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  quoteLlmPoints: vi.fn(),
  settleLlmPointsUsage: vi.fn(),
  getSpendableBalance: vi.fn(),
  resolveAiCost: vi.fn(),
  recordAiCost: vi.fn(),
}))

vi.mock('../src/services/ai-points-billing.js', () => ({
  quoteLlmPoints: mocks.quoteLlmPoints,
  settleLlmPointsUsage: mocks.settleLlmPointsUsage,
}))

vi.mock('../src/services/daily-credits.js', () => ({
  getSpendableBalance: mocks.getSpendableBalance,
}))

vi.mock('../src/plugins/ai-cost.js', () => ({
  resolveAiCost: mocks.resolveAiCost,
  recordAiCost: mocks.recordAiCost,
}))

import { executeStockAnalysis } from '../src/services/stock-service'

function quote(points: number) {
  return { promptTokens: 1, completionTokens: 800, totalTokens: 801, multiplier: 3, points }
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
    mocks.settleLlmPointsUsage.mockReset().mockResolvedValue({
      deducted: 49,
      remaining: 951,
      shortfall: 0,
      alreadySettled: false,
      quote: quote(49),
    })
    mocks.getSpendableBalance.mockReset().mockResolvedValue({ permanent: 1000, daily: 0, available: 1000 })
    mocks.resolveAiCost.mockReset().mockResolvedValue({ cost: 48.2, currency: 'CNY', pricing: null })
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

  it('调用前按倍率预估积分,成功后按真实 token 结算', async () => {
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
    expect(mocks.getSpendableBalance).toHaveBeenCalledWith('u1')
    expect(mocks.settleLlmPointsUsage).toHaveBeenCalledWith({
      userId: 'u1',
      modelId: 'stock-model',
      promptTokens: 1,
      completionTokens: 1233,
      source: 'stock_analysis',
      description: 'Stock AAPL',
    })
    expect(mocks.recordAiCost).toHaveBeenCalled()
    expect(result.tokensUsed).toBe(1234)
  })

  it('积分不足时拒绝,不发起上游调用', async () => {
    const fetchMock = vi.fn(async () => okFetch())
    vi.stubGlobal('fetch', fetchMock)
    mocks.getSpendableBalance.mockResolvedValue({ permanent: 10, daily: 0, available: 10 })

    await expect(
      executeStockAnalysis({ symbol: 'AAPL', question: 'abcd', userId: 'u1' }),
    ).rejects.toThrow(/积分不足: 需要 49 积分, 剩余 10 积分/)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.settleLlmPointsUsage).not.toHaveBeenCalled()
  })

  it('AI 调用失败降级为本地分析,不扣积分、不记成本', async () => {
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
  })
})
