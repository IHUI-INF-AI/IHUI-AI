// F-203 / 2026-11-26:Crew 子 LLM 只扣 AI 积分,钱包不再直接支付 AI 调用。
//
// 两本账分开:
// - 用户积分按模型倍率扣(user_points);
// - 平台真实成本按 ai_pricing 记 ai_cost_records。
//
// 本夹具 mock 倍率结算:100 token ⇒ 50 积分,150 ⇒ 75,50 ⇒ 25。

import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = vi.hoisted(() => ({
  points: 0,
  settlements: [] as Array<{ points: number; deducted: number; remaining: number; shortfall: number }>,
  costs: [] as Array<{
    userId: string
    totalTokens: number
    requestType: string
    cost?: number
    metadata?: string
  }>,
  usageQueue: [] as number[],
}))

const mocks = vi.hoisted(() => ({
  aiServiceFetch: vi.fn(),
  resolveAiCost: vi.fn(),
  recordAiCost: vi.fn(),
  getSpendableBalance: vi.fn(),
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
vi.mock('../src/services/daily-credits.js', () => ({
  getSpendableBalance: mocks.getSpendableBalance,
}))
vi.mock('../src/services/ai-points-billing.js', () => ({
  quoteLlmPoints: mocks.quoteLlmPoints,
  settleLlmPointsUsage: mocks.settleLlmPointsUsage,
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
    }),
  )
  mocks.recordAiCost.mockReset()
  mocks.recordAiCost.mockImplementation(async (input) => {
    store.costs.push(input)
    return { cost: input.cost ?? 0, currency: 'CNY' }
  })
  mocks.getSpendableBalance.mockReset().mockImplementation(async () => ({
    permanent: store.points,
    daily: 0,
    available: store.points,
  }))
  mocks.quoteLlmPoints.mockReset().mockImplementation(
    async (input: { promptTokens: number; completionTokens: number }) => ({
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.promptTokens + input.completionTokens,
      multiplier: 10,
      points: Math.ceil((input.promptTokens + input.completionTokens) / 2),
    }),
  )
  mocks.settleLlmPointsUsage.mockReset().mockImplementation(
    async (input: { promptTokens: number; completionTokens: number }) => {
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
    },
  )
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
  it('3 次调用按倍率扣积分,平台成本记 ai_cost_records', async () => {
    for (let i = 0; i < 3; i++) {
      await callRealLlm({
        messages: [{ role: 'user', content: `第${i}次` }],
        userId: 'u1',
        sessionId: 's1',
      })
    }

    expect(store.settlements.map((s) => s.points)).toEqual([50, 75, 25])
    expect(store.settlements.map((s) => s.remaining)).toEqual([950, 875, 850])
    expect(store.points).toBe(850)
    // 平台成本与用户积分不是同一个数
    expect(store.costs.map((c) => c.cost)).toEqual([48, 72, 24])
    expect(store.costs.map((c) => c.totalTokens)).toEqual([100, 150, 50])
    expect(store.costs.map((c) => JSON.parse(c.metadata!).billing.billingShortfallPoints)).toEqual([
      0, 0, 0,
    ])
  })

  it('零积分:预检 402,不发起上游调用、不落成本', async () => {
    store.points = 0

    await expect(
      callRealLlm({
        messages: [{ role: 'user', content: '零积分' }],
        userId: 'u1',
        sessionId: 's1',
      }),
    ).rejects.toMatchObject({ statusCode: 402, errorCode: 'INSUFFICIENT_POINTS' })

    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
    expect(store.costs).toHaveLength(0)
    expect(store.settlements).toHaveLength(0)
  })

  it('积分低于预估:同样 402(阈值是预估积分,不是 > 0)', async () => {
    store.points = 10
    const longMessage = '长'.repeat(100)

    await expect(
      callRealLlm({
        messages: [{ role: 'user', content: longMessage }],
        userId: 'u1',
        sessionId: 's1',
      }),
    ).rejects.toMatchObject({ statusCode: 402, errorCode: 'INSUFFICIENT_POINTS' })

    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
    expect(store.points).toBe(10)
  })

  it('运行中积分耗尽:扣到 0,欠额入 ai_cost_records,后续被预检拒绝', async () => {
    store.points = 20
    store.usageQueue = [100]

    const first = await callRealLlm({
      messages: [{ role: 'user', content: '刚够一半' }],
      userId: 'u1',
      sessionId: 's1',
    })

    expect(first.content).toBe('ok')
    expect(store.points).toBe(0)
    expect(store.settlements).toEqual([
      { points: 50, deducted: 20, remaining: 0, shortfall: 30 },
    ])
    expect(store.costs).toHaveLength(1)
    expect(store.costs[0]!.cost).toBe(48)
    const meta = JSON.parse(store.costs[0]!.metadata!)
    expect(meta.sessionId).toBe('s1')
    expect(meta.billing).toEqual({
      pointsDeducted: 20,
      pointsBalanceAfter: 0,
      billingShortfallPoints: 30,
      pointsQuote: 50,
      pointsMultiplier: 10,
    })

    await expect(
      callRealLlm({
        messages: [{ role: 'user', content: '再来一次' }],
        userId: 'u1',
        sessionId: 's1',
      }),
    ).rejects.toMatchObject({ statusCode: 402, errorCode: 'INSUFFICIENT_POINTS' })
    expect(mocks.aiServiceFetch).toHaveBeenCalledTimes(1)
  })
})
