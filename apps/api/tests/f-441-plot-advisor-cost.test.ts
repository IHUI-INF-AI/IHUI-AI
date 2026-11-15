// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-441 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/drama/scripts/:id/enhance 单请求串行 4 次真实 LLM
 * (consistency → pacing → outline,而 outline 内又调一次 pacing),且 callRealLlm
 * 未传 userId ⇒ 全程不落 ai_cost,成本不可归因、不可限额。
 *
 * 本文件锁:
 *   ① 每条真实 LLM 调用都触发一次成本记录(记录次数 == 上游调用次数);
 *   ② 并发化 + pacing 复用后,响应结构与直接串行调用逐字段一致(防语义漂移),
 *      且两条独立分支确实并发(同时在飞 >= 2);
 *   ③ 单条调用失败被隔离:其余两条结果照常,失败那条落 status='error' 审计记录;
 *   ④ 不重复计费:成功路径每条上游调用只记一次,不出现包装层二次记账。
 *
 * 隔离:mock 上游 aiServiceFetch、成本记录 recordAiCost/resolveAiCost、钱包服务、
 * auth、logger、模型解析;不触达真实 ai-service / PG / Redis。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

type CostInput = {
  userId?: string
  model: string
  provider: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost?: number
  requestType?: string
  status?: string
  metadata?: string
}

type CostRecord = CostInput & { status?: string }

const store = vi.hoisted(() => ({
  costs: [] as CostRecord[],
  inFlight: 0,
  maxInFlight: 0,
  /** 按场景指定上游行为:down = HTTP 非 2xx */
  failScene: '' as '' | 'consistency' | 'pacing' | 'outline',
  lastOutlinePayload: null as Record<string, unknown> | null,
}))

const mocks = vi.hoisted(() => ({
  aiServiceFetch: vi.fn(),
  recordAiCost: vi.fn(),
  resolveAiCost: vi.fn(),
  getWalletBalance: vi.fn(),
  settleWalletUsage: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: Record<string, unknown>) => {
    request.userId = 'f441-user'
  }),
}))

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('../src/config/index.js', () => ({
  config: { AI_SERVICE_URL: 'http://ai-service.test' },
}))
vi.mock('../src/utils/retired-providers.js', () => ({
  resolveDefaultChatModel: () => 'mock/model',
}))
vi.mock('../src/services/context-manager-service.js', () => ({
  estimateTokens: (text: string) => Math.max(1, Math.ceil(text.length / 2)),
}))
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mocks.aiServiceFetch,
}))
vi.mock('../src/plugins/ai-cost.js', () => ({
  recordAiCost: mocks.recordAiCost,
  resolveAiCost: mocks.resolveAiCost,
}))
vi.mock('../src/plugins/token-balance-service.js', () => ({
  getWalletBalance: mocks.getWalletBalance,
  settleWalletUsage: mocks.settleWalletUsage,
}))

import { dramaRoutes } from '../src/routes/drama.js'
import {
  createStory,
  checkConsistency,
  analyzePacing,
  suggestChapterOutline,
} from '../src/services/ai/plot-advisor-service.js'

/** 三个 prompt 的系统提示词 → 场景判据(与 service 内文案一致)。 */
function sceneOf(messages: Array<{ role: string; content: string }>): string {
  const system = messages.find((m) => m.role === 'system')?.content ?? ''
  if (system.includes('剧情一致性检查专家')) return 'consistency'
  if (system.includes('情节节奏分析专家')) return 'pacing'
  if (system.includes('章节大纲顾问')) return 'outline'
  return 'unknown'
}

const SUCCESS_CONTENT: Record<string, string> = {
  consistency: JSON.stringify([
    { type: 'unresolved_foreshadow', message: '伏笔未回收', severity: 'warning' },
  ]),
  pacing: JSON.stringify({ score: 77, suggestions: ['节奏建议A'] }),
  outline: JSON.stringify(['大纲建议A', '大纲建议B']),
}

function installUpstreamMock(): void {
  mocks.aiServiceFetch.mockReset()
  mocks.aiServiceFetch.mockImplementation(
    async (
      _request: unknown,
      _path: string,
      init: { body?: string },
    ): Promise<{
      ok: boolean
      status: number
      text: () => Promise<string>
      json: () => Promise<unknown>
    }> => {
      const body = JSON.parse(init.body ?? '{}') as {
        messages: Array<{ role: string; content: string }>
      }
      const scene = sceneOf(body.messages)
      if (scene === 'outline') {
        store.lastOutlinePayload = JSON.parse(body.messages[1]!.content) as Record<string, unknown>
      }

      store.inFlight++
      store.maxInFlight = Math.max(store.maxInFlight, store.inFlight)
      // 留出一个微任务/定时器窗口,便于观察并发在飞数
      await new Promise((r) => setTimeout(r, 5))
      store.inFlight--

      if (store.failScene === scene) {
        return { ok: false, status: 503, text: async () => 'upstream down', json: async () => ({}) }
      }
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          content: SUCCESS_CONTENT[scene] ?? '[]',
          model: 'mock/model',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          stub: false,
        }),
      }
    },
  )
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(dramaRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

beforeEach(() => {
  store.costs.length = 0
  store.inFlight = 0
  store.maxInFlight = 0
  store.failScene = ''
  store.lastOutlinePayload = null

  installUpstreamMock()

  mocks.recordAiCost.mockReset()
  mocks.recordAiCost.mockImplementation(async (input: CostRecord) => {
    store.costs.push(input)
    return { cost: input.cost ?? 1, currency: 'CNY' }
  })
  mocks.resolveAiCost.mockReset()
  mocks.resolveAiCost.mockImplementation(async () => ({
    cost: 1,
    currency: 'CNY',
    pricing: null,
  }))
  mocks.getWalletBalance.mockReset()
  mocks.getWalletBalance.mockImplementation(async () => 1_000_000)
  mocks.settleWalletUsage.mockReset()
  mocks.settleWalletUsage.mockImplementation(async (input: { amount: number }) => ({
    deducted: input.amount,
    remaining: 1_000_000 - input.amount,
    shortfall: 0,
  }))
})

describe('F-441 /drama/scripts/:id/enhance 计费与并发', () => {
  it('① 每条 LLM 调用都触发一次成本记录(记录次数 = 上游调用次数)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/drama/scripts/f441-always-cost/enhance',
      payload: {},
    })
    await app.close()

    expect(res.statusCode).toBe(200)
    expect(mocks.aiServiceFetch).toHaveBeenCalledTimes(3)
    expect(mocks.recordAiCost).toHaveBeenCalledTimes(3)
    expect(store.costs).toHaveLength(3)
    for (const c of store.costs) {
      expect(c.userId).toBe('f441-user')
      expect(c.model).toBe('mock/model')
      expect(c.totalTokens).toBe(15)
      expect(c.status).toBeUndefined()
    }
  })

  it('② 并发化后响应结构与直接串行调用一致,且 pacing 只算一次', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/drama/scripts/f441-parallel/enhance',
      payload: {},
    })
    const routeCalls = mocks.aiServiceFetch.mock.calls.length
    const routeMaxInFlight = store.maxInFlight
    await app.close()

    expect(res.statusCode).toBe(200)
    // 两条独立分支并发:同时在飞 ≥ 2;总调用数 3(不再有 outline 内的二次 pacing)
    expect(routeMaxInFlight).toBeGreaterThanOrEqual(2)
    expect(routeCalls).toBe(3)

    // 同一份 fixture 走直接串行调用,逐字段对照
    store.costs.length = 0
    store.maxInFlight = 0
    store.inFlight = 0
    createStory('f441-direct', '直接调用')
    const directPacing = await analyzePacing('f441-direct', 'f441-user')
    const directConsistency = await checkConsistency('f441-direct', 'f441-user')
    const directOutline = await suggestChapterOutline('f441-direct', 1, 'f441-user', directPacing)

    const body = res.json() as {
      code: number
      data: { consistency: unknown; pacing: unknown; outline: unknown }
    }
    expect(body.data).toEqual({
      consistency: directConsistency,
      pacing: directPacing,
      outline: directOutline,
    })

    // 大纲用的是路由层那份 pacing(score 77),不是重新算的规则分
    expect(store.lastOutlinePayload!.pacingScore).toBe(77)
    expect(store.lastOutlinePayload!.byType).toEqual(directPacing.byType)
  })

  it('③ 单条调用失败被隔离:其余结果照常,失败那条落 error 审计记录', async () => {
    store.failScene = 'consistency'
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/drama/scripts/f441-failure/enhance',
      payload: {},
    })
    await app.close()

    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: {
        consistency: Array<{ type: string }>
        pacing: { score: number; suggestions: string[] }
        outline: string[]
      }
    }
    // 一致性降级为规则检查(空故事 → []),节奏/大纲仍取自 LLM
    expect(body.data.consistency).toEqual([])
    expect(body.data.pacing.score).toBe(77)
    expect(body.data.pacing.suggestions).toEqual(['节奏建议A'])
    expect(body.data.outline).toEqual(['大纲建议A', '大纲建议B'])

    expect(mocks.aiServiceFetch).toHaveBeenCalledTimes(3)
    expect(store.costs).toHaveLength(3)
    const failed = store.costs.filter((c) => c.status === 'error')
    expect(failed).toHaveLength(1)
    expect(failed[0]).toMatchObject({
      userId: 'f441-user',
      model: 'mock/model',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      requestType: 'plot-advisor',
    })
    expect(JSON.parse(failed[0]!.metadata!).scene).toBe('consistency')
    // 其余两条仍是成功记账
    expect(store.costs.filter((c) => c.status === undefined)).toHaveLength(2)
  })

  it('④ 不重复计费:成功路径每条上游调用只记一次(无包装层二次记账)', async () => {
    const app = await buildApp()
    await app.inject({
      method: 'POST',
      url: '/api/drama/scripts/f441-no-double/enhance',
      payload: {},
    })
    await app.close()

    expect(store.costs).toHaveLength(mocks.aiServiceFetch.mock.calls.length)
    // 每条记录都是该次上游的真实 usage,而非被外层再乘/再加一次
    expect(store.costs.map((c) => c.totalTokens)).toEqual([15, 15, 15])
    expect(store.costs.map((c) => c.cost)).toEqual([1, 1, 1])
  })
})
