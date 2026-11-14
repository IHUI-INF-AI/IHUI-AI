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
            return reply
              .status(statusCode)
              .send({ code: statusCode, message: (e as Error).message || 'Authentication required' })
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

  it('① career-advice 额度充足:放行并计量(成本记账 + 钱包扣同一个数)', async () => {
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

    // 扣费:钱包扣的与记账同一个数(分)
    expect(mocks.deductTokens).toHaveBeenCalledWith('f157-user', 1, 'ai_career_advice')
  })

  it('② career-advice 余额不足:402 且不发起上游调用', async () => {
    mocks.getBalance.mockResolvedValue({
      userId: 'f157-user',
      balance: 0,
      vipLevel: 0,
      monthlyQuota: 1000,
      discountRate: 1,
      isPromotionPeriod: false,
    })

    const res = await callCareerAdvice()
    expect(res.statusCode).toBe(402)
    const body = res.json() as { code: number; errorCode?: string }
    expect(body.code).toBe(402)
    expect(body.errorCode).toBe('INSUFFICIENT_BALANCE')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.recordAiCost).not.toHaveBeenCalled()
    expect(mocks.deductTokens).not.toHaveBeenCalled()
  })

  it('③ career-advice 日配额用尽:402 且不发起上游调用', async () => {
    mocks.checkBudget.mockResolvedValue({ allowed: false, reason: '日 token 预算已用尽' })

    const res = await callCareerAdvice()
    expect(res.statusCode).toBe(402)
    const body = res.json() as { code: number; errorCode?: string }
    expect(body.code).toBe(402)
    expect(body.errorCode).toBe('DAILY_QUOTA_EXHAUSTED')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.getBalance).not.toHaveBeenCalled()
  })

  it('④ capabilities/invoke 额度充足:放行并计量(余额预检 + 结算 + 记账)', async () => {
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
    expect(mocks.getWalletBalance).toHaveBeenCalledWith('f157-user')
    expect(mocks.settleWalletUsage).toHaveBeenCalledTimes(1)
    expect(mocks.recordAiCost).toHaveBeenCalledTimes(1)
    expect((mocks.recordAiCost.mock.calls[0]![0] as { userId: string }).userId).toBe('f157-user')
  })

  it('⑤ capabilities/invoke 余额不足:402 且不发起上游调用', async () => {
    mocks.getWalletBalance.mockResolvedValue(0)

    const res = await callCapability()
    expect(res.statusCode).toBe(402)
    const body = res.json() as { code: number; errorCode?: string }
    expect(body.code).toBe(402)
    expect(body.errorCode).toBe('INSUFFICIENT_BALANCE')
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
    expect(mocks.getWalletBalance).not.toHaveBeenCalled()
    expect(mocks.recordAiCost).not.toHaveBeenCalled()
  })
})
