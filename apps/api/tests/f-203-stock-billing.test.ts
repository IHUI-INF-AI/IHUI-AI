// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-203 口径 B:stock-service 的预扣/退还也必须按成本(分),不能扣 token 估算数。
 *
 * 旧行为:`estimatedTokens = ceil(chars/4)+800` 直接当钱包数量扣 —— 钱包单位是分,
 * 一次股票分析会按「token 数」而不是「钱」扣费,与 ai_pricing 完全脱节。
 * 现行为:先 resolveAiCost 折算成分(预扣、失败退还同额),余额校验也按分比较。
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveAiCost: vi.fn(),
}))

vi.mock('../src/plugins/ai-cost.js', () => ({
  resolveAiCost: mocks.resolveAiCost,
}))

import { executeStockAnalysis } from '../src/services/stock-service'
import type { TokenBalanceService } from '../src/plugins/token-balance-service'

function makeWallet(balance: number) {
  const wallet = {
    getBalance: vi.fn(async () => ({
      userId: 'u1',
      balance,
      vipLevel: 0,
      monthlyQuota: 0,
      discountRate: 1,
      isPromotionPeriod: false,
    })),
    deductTokens: vi.fn(async () => ({ success: true, remaining: balance - 49 })),
    rechargeTokens: vi.fn(async () => ({ success: true, balance })),
  }
  return { wallet, tokenBalance: wallet as unknown as TokenBalanceService }
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

describe('stock-service 计费口径 B(分)', () => {
  beforeEach(() => {
    process.env.STOCK_API_KEY = 'test-key'
    process.env.STOCK_API_BASE = 'https://stock.test/v1'
    process.env.STOCK_MODEL_ID = 'stock-model'
    mocks.resolveAiCost.mockReset()
    mocks.resolveAiCost.mockResolvedValue({ cost: 48.2, currency: 'CNY', pricing: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  afterAll(() => {
    delete process.env.STOCK_API_KEY
    delete process.env.STOCK_API_BASE
    delete process.env.STOCK_MODEL_ID
  })

  it('预扣按定价折算的分(ceil 49),不是 801 token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okFetch()),
    )
    const { wallet, tokenBalance } = makeWallet(1000)

    const result = await executeStockAnalysis(
      { symbol: 'AAPL', question: 'abcd', userId: 'u1' },
      tokenBalance,
    )

    // question 4 字符 → ceil(4/4)+800 = 801 token 参与预估
    expect(mocks.resolveAiCost).toHaveBeenCalledWith({
      model: 'stock-model',
      promptTokens: 801,
      completionTokens: 0,
    })
    expect(wallet.deductTokens).toHaveBeenCalledWith('u1', 49, 'stock_analysis:AAPL')
    expect(result.tokensUsed).toBe(1234)
  })

  it('余额按分比较:余额 10 < 预估 49 时拒绝,不发起上游调用', async () => {
    const fetchMock = vi.fn(async () => okFetch())
    vi.stubGlobal('fetch', fetchMock)
    const { wallet, tokenBalance } = makeWallet(10)

    await expect(
      executeStockAnalysis({ symbol: 'AAPL', question: 'abcd', userId: 'u1' }, tokenBalance),
    ).rejects.toThrow(/余额不足: 需要 49 分, 剩余 10 分/)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wallet.deductTokens).not.toHaveBeenCalled()
  })

  it('AI 调用失败降级时退还同一笔分(49 分)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('upstream down')
      }),
    )
    const { wallet, tokenBalance } = makeWallet(1000)

    const result = await executeStockAnalysis(
      { symbol: 'AAPL', question: 'abcd', userId: 'u1' },
      tokenBalance,
    )

    expect(wallet.deductTokens).toHaveBeenCalledWith('u1', 49, 'stock_analysis:AAPL')
    // 退款是 fire-and-forget,等一个 tick 让 catch 里的 promise 落地
    await new Promise((r) => setTimeout(r, 0))
    expect(wallet.rechargeTokens).toHaveBeenCalledWith(
      'u1',
      49,
      expect.stringMatching(/^stock_refund:AAPL:/),
    )
    expect(result.analysis).toContain('基础分析报告')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
