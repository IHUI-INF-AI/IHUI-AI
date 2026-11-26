// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-203 / 2026-11-26: Crew 子 LLM 只扣 AI 积分,钱包不再直接支付 AI 调用。
 *
 * 本版钉住:
 * - 预检按 prompt + maxTokens 冻结,不是只算 prompt;
 * - 未定价模型 503,不能免费跑;
 * - 结算按真实 usage 多退少补,余额不足部分结算并留欠额。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = vi.hoisted(() => ({
  points: 0,
  settlements: [] as Array<{
    points: number
    deducted: number
    remaining: number
    shortfall: number
  }>,
  costs: [] as Array<{
    userId: string
    totalTokens: number
    requestType: string
    metadata?: string
  }>,
  usageQueue: [] as number[],
}))

const mocks = vi.hoisted(() => ({
  aiServiceFetch: vi.fn(),
  resolveAiCost: vi.fn(),
  recordAiCost: vi.fn(),
  reservePointsUsage: vi.fn(),
  releasePointsHold: vi.fn(async () => 0),
  quoteLlmPoints: vi.fn(),
  settleLlmPointsUsage: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  registerPoolTrackerCleanup: vi.fn(),
  db: {},
  dbRead: {},
}))
vi.mock('../src/config/index.js', () => ({
  config: { AI_SERVICE_URL: 'http://ai-service:8000' },
}))
vi.mock('../src/utils/retired-providers.js', () => ({
  resolveDefaultChatModel: () => 'agnes/default',
}))
vi.mock('../src/utils/ai-service-fetch.js', () => ({ aiServiceFetch: mocks.aiServiceFetch }))
vi.mock('../src/plugins/ai-cost.js', () => ({
  resolveAiCost: mocks.resolveAiCost,
  recordAiCost: mocks.recordAiCost,
}))
vi.mock('../src/services/ai-points-billing.js', () => ({
  quoteLlmPoints: mocks.quoteLlmPoints,
  settleLlmPointsUsage: mocks.settleLlmPointsUsage,
  DEFAULT_MAX_COMPLETION_TOKENS: 4096,
  MAX_COMPLETION_TOKENS: 131_072,
}))
vi.mock('../src/services/points-service.js', () => ({
  reservePointsUsage: mocks.reservePointsUsage,
  releasePointsHold: mocks.releasePointsHold,
}))
vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('fastify-plugin', () => ({ default: (fn: unknown) => fn }))
vi.mock('../src/plugins/auth.js', () => ({ authenticate: vi.fn() }))
vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../src/utils/response.js', () => ({ success: (data: unknown) => ({ data }) }))

const { callRealLlm } = await import('../src/services/crew-llm-adapter.js')

beforeEach(() => {
  store.points = 1000
  store.settlements.length = 0
  store.costs.length = 0
  store.usageQueue = [100, 150, 50]
  mocks.resolveAiCost.mockReset()
  mocks.resolveAiCost.mockImplementation(
    async (input: { promptTokens: number; completionTokens: number }) => ({
      cost: (input.promptTokens / 1000) * 300 + (input.completionTokens / 1000) * 600,
      currency: 'CNY',
      pricing: null,
      pricingKnown: true,
    }),
  )
  mocks.recordAiCost.mockReset()
  mocks.recordAiCost.mockImplementation(async (input) => {
    store.costs.push(input)
    return { cost: input.cost ?? 0, currency: 'CNY' }
  })
  mocks.quoteLlmPoints
    .mockReset()
    .mockImplementation(async (input: { promptTokens: number; completionTokens: number }) => ({
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.promptTokens + input.completionTokens,
      inputPointsPer1k: 1,
      outputPointsPer1k: 1,
      multiplier: 10,
      points: Math.ceil((input.promptTokens + input.completionTokens) / 2),
      pricingModelId: 'agnes/default',
      pricingSource: 'ai_pricing',
    }))
  mocks.reservePointsUsage.mockReset().mockImplementation(async (input: { amount: number }) => {
    const shortfall = Math.max(0, input.amount - store.points)
    return {
      shortfall,
      remaining: store.points,
      deducted: 0,
      alreadySettled: false,
      alreadyHeld: false,
    }
  })
  mocks.settleLlmPointsUsage
    .mockReset()
    .mockImplementation(async (input: { promptTokens: number; completionTokens: number }) => {
      const quote = await mocks.quoteLlmPoints(input)
      const deducted = Math.min(store.points, quote.points)
      const shortfall = quote.points - deducted
      store.points -= deducted
      store.settlements.push({
        points: quote.points,
        deducted,
        remaining: store.points,
        shortfall,
      })
      return { deducted, remaining: store.points, shortfall, alreadySettled: false, quote }
    })
  mocks.releasePointsHold.mockReset().mockResolvedValue(0)
  mocks.aiServiceFetch.mockReset()
  mocks.aiServiceFetch.mockImplementation(async () => ({
    ok: true,
    json: async () => {
      const total = store.usageQueue.shift() ?? 0
      return {
        content: 'ok',
        model: 'agnes/default',
        usage: { prompt_tokens: total * 0.4, completion_tokens: total * 0.6, total_tokens: total },
        stub: false,
      }
    },
  }))
})

describe('Crew 子 LLM 积分计费', () => {
  it('3 次调用按预检冻结+真实 usage 结算,平台成本记 ai_cost_records', async () => {
    for (let i = 0; i < 3; i++) {
      await callRealLlm({
        messages: [{ role: 'user', content: `第${i}次` }],
        userId: 'u1',
        sessionId: 's1',
        maxTokens: 100,
      })
    }

    expect(store.settlements).toHaveLength(3)
    expect(store.settlements.every((s) => s.deducted > 0)).toBe(true)
    expect(store.points).toBe(1000 - store.settlements.reduce((sum, s) => sum + s.deducted, 0))
    expect(store.costs.map((c) => c.totalTokens)).toEqual([100, 150, 50])
    expect(store.costs.map((c) => JSON.parse(c.metadata!).billing.billingShortfallPoints)).toEqual([
      0, 0, 0,
    ])
    // 预检金额 = prompt + maxTokens 的报价,写入 hold
    const reserveCalls = mocks.reservePointsUsage.mock.calls.map((c) => c[0] as { amount: number })
    expect(reserveCalls.length).toBe(3)
    expect(reserveCalls.every((c) => c.amount > 0)).toBe(true)
  })

  it('零积分:预检 402,不发起上游调用、不落成本', async () => {
    store.points = 0

    await expect(
      callRealLlm({
        messages: [{ role: 'user', content: '零积分' }],
        userId: 'u1',
        sessionId: 's1',
        maxTokens: 100,
      }),
    ).rejects.toMatchObject({ statusCode: 402, errorCode: 'INSUFFICIENT_POINTS' })

    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
    expect(store.costs).toHaveLength(0)
    expect(store.settlements).toHaveLength(0)
  })

  it('积分低于预检冻结额:同样 402,不发起上游调用', async () => {
    store.points = 10

    await expect(
      callRealLlm({
        messages: [{ role: 'user', content: '长'.repeat(100) }],
        userId: 'u1',
        sessionId: 's1',
        maxTokens: 4096,
      }),
    ).rejects.toMatchObject({ statusCode: 402, errorCode: 'INSUFFICIENT_POINTS' })

    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
    expect(store.points).toBe(10)
  })

  it('未定价模型 503,不能免费跑', async () => {
    mocks.quoteLlmPoints.mockResolvedValueOnce({
      promptTokens: 10,
      completionTokens: 100,
      totalTokens: 110,
      inputPointsPer1k: 30,
      outputPointsPer1k: 30,
      multiplier: 30,
      points: 4,
      pricingModelId: null,
      pricingSource: 'unknown_default',
    })

    await expect(
      callRealLlm({
        messages: [{ role: 'user', content: '未定价' }],
        userId: 'u1',
        sessionId: 's1',
        maxTokens: 100,
      }),
    ).rejects.toMatchObject({ statusCode: 503, errorCode: 'MODEL_PRICING_MISSING' })

    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
  })

  it('运行中积分耗尽:扣到 0,欠额入 ai_cost_records,后续被预检拒绝', async () => {
    store.points = 20
    store.usageQueue = [100]

    const first = await callRealLlm({
      messages: [{ role: 'user', content: '刚够一半' }],
      userId: 'u1',
      sessionId: 's1',
      maxTokens: 20,
    })

    expect(first.content).toBe('ok')
    expect(store.points).toBe(0)
    expect(store.settlements).toHaveLength(1)
    expect(store.settlements[0]!.shortfall).toBeGreaterThan(0)
    expect(store.costs).toHaveLength(1)
    const meta = JSON.parse(store.costs[0]!.metadata!)
    expect(meta.sessionId).toBe('s1')
    expect(meta.billing.billingShortfallPoints).toBe(store.settlements[0]!.shortfall)

    await expect(
      callRealLlm({
        messages: [{ role: 'user', content: '再来一次' }],
        userId: 'u1',
        sessionId: 's1',
        maxTokens: 20,
      }),
    ).rejects.toMatchObject({ statusCode: 402, errorCode: 'INSUFFICIENT_POINTS' })
    expect(mocks.aiServiceFetch).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
