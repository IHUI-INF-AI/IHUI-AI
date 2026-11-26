// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const mocks = vi.hoisted(() => ({
  getWalletBalance: vi.fn(),
  settleWalletUsage: vi.fn(),
  resolveAiCost: vi.fn(),
  recordAiCost: vi.fn(),
  checkBudget: vi.fn(),
  getBalance: vi.fn(),
  deductTokens: vi.fn(),
  getSpendableBalance: vi.fn(),
  quoteLlmPoints: vi.fn(),
  settleLlmPointsUsage: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { headers: Record<string, unknown>; userId?: string }) => {
    const auth = request.headers.authorization
    if (!auth) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = 'f157-user'
  }),
}))

vi.mock('../src/db/index.js', () => ({
  registerPoolTrackerCleanup: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

// 钱包/成本模块全部替身:零 DB、零 Redis、零上游。
vi.mock('../src/plugins/token-balance-service.js', () => ({
  getWalletBalance: mocks.getWalletBalance,
  settleWalletUsage: mocks.settleWalletUsage,
}))

vi.mock('../src/plugins/ai-cost.js', () => ({
  resolveAiCost: mocks.resolveAiCost,
  recordAiCost: mocks.recordAiCost,
}))

vi.mock('../src/services/daily-credits.js', () => ({
  getSpendableBalance: mocks.getSpendableBalance,
}))

vi.mock('../src/services/ai-points-billing.js', () => ({
  DEFAULT_MAX_COMPLETION_TOKENS: 4096,
  MAX_COMPLETION_TOKENS: 131_072,
  quoteLlmPoints: mocks.quoteLlmPoints,
  settleLlmPointsUsage: mocks.settleLlmPointsUsage,
  ensureLlmPointsBalance: async (
    _request: unknown,
    reply: { status: (code: number) => { send: (body: unknown) => void } },
    modelId: string,
    promptTokens: number,
    completionTokens = 0,
  ) => {
    const quote = await mocks.quoteLlmPoints({ modelId, promptTokens, completionTokens })
    const balance = await mocks.getSpendableBalance()
    if (quote.points > balance.available) {
      reply.status(402).send({
        code: 402,
        message: '积分不足,请充值或兑换积分后重试',
        data: { balance: balance.available, required: quote.points },
      })
      return false
    }
    return true
  },
}))

vi.mock('../src/services/points-service.js', () => ({
  reservePointsUsage: vi.fn(async (input: { userId: string; amount: number }) => {
    const balance = await mocks.getSpendableBalance(input.userId)
    return {
      shortfall: Math.max(0, input.amount - balance.available),
      remaining: balance.available,
      deducted: 0,
      alreadySettled: false,
      alreadyHeld: false,
    }
  }),
  releasePointsHold: vi.fn(async () => 0),
}))

vi.mock('../src/services/context-manager-service.js', () => ({
  estimateTokens: (text: string) => Math.ceil(text.length / 4),
}))

vi.mock('../src/utils/retired-providers.js', () => ({
  resolveDefaultChatModel: () => 'agnes/agnes-2.5-flash',
}))

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import aiCapabilitiesRoutes from '../src/routes/user/ai-capabilities-routes.js'
import aiModulesRoutes from '../src/routes/user/ai-modules-routes.js'

const USER_TOKEN = 'Bearer f157-user-token'

const CAPABILITY_PAYLOAD = { capability_id: 'chat', input: '你好,介绍一下你自己' }

const CAREER_PAYLOAD = {
  school: '示例中学',
  classLevel: '高一',
  scoreRange: '中等偏上',
  languageDifficulty: '文言文阅读偏弱',
  scienceCharacteristics: '物理实验兴趣浓',
  learningObstacle: '做题速度慢',
  hobbies: '机器人社团',
  target: '计算机相关专业',
}

describe('F-157 平台 Key 大模型调用必须计量并受用户额度约束', () => {
  let app: FastifyInstance
  const fetchMock = vi.fn<typeof fetch>()

  beforeAll(async () => {
    vi.stubGlobal('fetch', fetchMock)
    app = Fastify({ logger: false })
    // 与生产 server.ts 同构:tokenBalance / aiCost 插件已 decorate 到根实例,
    // 路由通过 server.tokenBalance / server.aiCost 走同一份计量/配额服务。
    app.decorate('aiCost', {
      checkBudget: mocks.checkBudget,
    } as unknown as FastifyInstance['aiCost'])
    app.decorate('tokenBalance', {
      getBalance: mocks.getBalance,
      deductTokens: mocks.deductTokens,
    } as unknown as FastifyInstance['tokenBalance'])
    await app.register(
      async (server) => {
        server.addHook('preHandler', async (request, reply) => {
          try {
            await (await import('../src/plugins/auth.js')).authenticate(request)
          } catch (e) {
            const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
            return reply.status(statusCode).send({
              code: statusCode,
              message: (e as Error).message || 'Authentication required',
            })
          }
        })
        await server.register(aiModulesRoutes)
        await server.register(aiCapabilitiesRoutes)
      },
      { prefix: '/api' },
    )
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    fetchMock.mockReset()
    mocks.getWalletBalance.mockReset().mockResolvedValue(100_000)
    mocks.settleWalletUsage
      .mockReset()
      .mockResolvedValue({ deducted: 1, remaining: 99_999, shortfall: 0 })
    mocks.resolveAiCost.mockReset().mockResolvedValue({ cost: 1, currency: 'CNY', pricing: null })
    mocks.recordAiCost.mockReset().mockResolvedValue({ cost: 1, currency: 'CNY' })
    mocks.checkBudget.mockReset().mockResolvedValue({ allowed: true })
    mocks.getBalance.mockReset().mockResolvedValue({
      userId: 'f157-user',
      balance: 100_000,
      vipLevel: 0,
      monthlyQuota: 1000,
      discountRate: 1,
      isPromotionPeriod: false,
    })
    mocks.deductTokens.mockReset().mockResolvedValue({ success: true, remaining: 99_999 })
    mocks.getSpendableBalance.mockReset().mockResolvedValue({
      permanent: 100_000,
      daily: 0,
      available: 100_000,
    })
    mocks.quoteLlmPoints.mockReset().mockResolvedValue({
      promptTokens: 1,
      completionTokens: 0,
      totalTokens: 1,
      multiplier: 10,
      points: 1,
      pricingModelId: 'agnes/agnes-2.5-flash',
      pricingSource: 'ai_pricing',
    })
    mocks.settleLlmPointsUsage.mockReset().mockResolvedValue({
      deducted: 1,
      remaining: 99_999,
      shortfall: 0,
      alreadySettled: false,
      quote: {
        promptTokens: 20,
        completionTokens: 30,
        totalTokens: 50,
        multiplier: 10,
        points: 1,
      },
    })
  })

  const upstreamJson = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  const callCareerAdvice = () =>
    app.inject({
      method: 'POST',
      url: '/api/ai/career-advice',
      headers: { authorization: USER_TOKEN },
      payload: CAREER_PAYLOAD,
    })

  const callCapability = () =>
    app.inject({
      method: 'POST',
      url: '/api/v1/ai/capabilities/invoke',
      headers: { authorization: USER_TOKEN },
      payload: CAPABILITY_PAYLOAD,
    })

  it('① career-advice 额度充足:放行并计量(平台成本 + 用户积分两本账)', async () => {
    fetchMock.mockResolvedValueOnce(
      upstreamJson({
        content: '个性化生涯建议正文',
        model: 'agnes/agnes-2.5-flash',
        usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
      }),
    )

    const res = await callCareerAdvice()
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { content: '个性化生涯建议正文' },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mocks.checkBudget).toHaveBeenCalledWith('user', 'f157-user')

    // 计量:ai_cost_records 按真实 usage 记账(喂用户日配额)
    expect(mocks.recordAiCost).toHaveBeenCalledTimes(1)
    const record = mocks.recordAiCost.mock.calls[0]![0] as {
      userId: string
      promptTokens: number
      completionTokens: number
      totalTokens: number
      requestType: string
    }
    expect(record.userId).toBe('f157-user')
    expect(record.promptTokens).toBe(20)
    expect(record.completionTokens).toBe(30)
    expect(record.totalTokens).toBe(50)
    expect(record.requestType).toBe('career-advice')

    // 用户积分按倍率扣;平台真实成本另记 ai_cost_records
    expect(mocks.settleLlmPointsUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'f157-user',
        modelId: 'agnes/agnes-2.5-flash',
        promptTokens: 20,
        completionTokens: 30,
        source: 'ai_career_advice',
      }),
    )
    expect(mocks.deductTokens).not.toHaveBeenCalled()
  })

  it('② career-advice 积分不足:402 且不发起上游调用', async () => {
    mocks.getSpendableBalance.mockResolvedValue({ permanent: 0, daily: 0, available: 0 })

    const res = await callCareerAdvice()
    expect(res.statusCode).toBe(402)
    const body = res.json() as { code: number; errorCode?: string }
    expect(body.code).toBe(402)
    expect(body.errorCode).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.recordAiCost).not.toHaveBeenCalled()
    expect(mocks.settleLlmPointsUsage).not.toHaveBeenCalled()
  })

  it('③ career-advice 日配额用尽:402 且不发起上游调用', async () => {
    mocks.checkBudget.mockResolvedValue({ allowed: false, reason: '日 token 预算已用尽' })

    const res = await callCareerAdvice()
    expect(res.statusCode).toBe(402)
    const body = res.json() as { code: number; errorCode?: string }
    expect(body.code).toBe(402)
    expect(body.errorCode).toBe('DAILY_QUOTA_EXHAUSTED')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.getSpendableBalance).not.toHaveBeenCalled()
  })

  it('④ capabilities/invoke 额度充足:放行并计量(积分预检 + 结算 + 成本记账)', async () => {
    fetchMock.mockResolvedValueOnce(
      upstreamJson({
        content: '真实能力结果',
        model: 'agnes/agnes-2.5-flash',
        usage: { prompt_tokens: 12, completion_tokens: 24, total_tokens: 36 },
        stub: false,
      }),
    )

    const res = await callCapability()
    expect(res.statusCode).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mocks.checkBudget).toHaveBeenCalledWith('user', 'f157-user')
    expect(mocks.getSpendableBalance).toHaveBeenCalledWith('f157-user')
    expect(mocks.settleLlmPointsUsage).toHaveBeenCalledTimes(1)
    expect(mocks.recordAiCost).toHaveBeenCalledTimes(1)
    expect((mocks.recordAiCost.mock.calls[0]![0] as { userId: string }).userId).toBe('f157-user')
  })

  it('⑤ capabilities/invoke 积分不足:402 且不发起上游调用', async () => {
    mocks.getSpendableBalance.mockResolvedValue({ permanent: 0, daily: 0, available: 0 })

    const res = await callCapability()
    expect(res.statusCode).toBe(402)
    const body = res.json() as { code: number; errorCode?: string }
    expect(body.code).toBe(402)
    expect(body.errorCode).toBe('INSUFFICIENT_POINTS')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.recordAiCost).not.toHaveBeenCalled()
  })

  it('⑥ capabilities/invoke 日配额用尽:402 且不发起上游调用', async () => {
    mocks.checkBudget.mockResolvedValue({ allowed: false, reason: '日成本预算已用尽' })

    const res = await callCapability()
    expect(res.statusCode).toBe(402)
    const body = res.json() as { code: number; errorCode?: string }
    expect(body.code).toBe(402)
    expect(body.errorCode).toBe('DAILY_QUOTA_EXHAUSTED')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.getSpendableBalance).not.toHaveBeenCalled()
    expect(mocks.recordAiCost).not.toHaveBeenCalled()
  })
})
