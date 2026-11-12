// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-30 回归夹具:Crew 计费必须按「单次执行的用量单元」结算,不能按会话恒定。
 *
 * 原缺陷:计费挂在终态事件 + 幂等键写死 `crew:<sessionId>` ⇒
 *   ① 已完成会话可无限重跑,第二次起不再扣费;
 *   ② 取消/断连走 error 分支,路由只认 complete ⇒ 已发生的模型调用不扣费。
 *
 * 现口径(F-203 口径 B 定案后):结算点已从「路由终态事件」下移到
 * `crew-llm-adapter.callRealLlm` 的**每次真实调用**——这本身就是「用量发生单元」,
 * 所以这里直接驱动真实的 orchestrator + adapter,用假钱包记录结算流水来钉语义:
 *   - 新 runId ⇒ 新的一批真实调用 ⇒ 再结算一次(①);
 *   - 同一 runId 的终态事件只是报告,不产生额外结算(②);
 *   - 取消前已发生的调用照常结算,取消后不再发起调用(③);
 *   - 取消且一次调用都没发生 ⇒ 零结算(④)。
 *
 * 边界:adapter 结算失败(或上游中断且未上报 usage)时无金额可结,属已知不可结算面。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CrewStreamEvent } from '../src/services/crew-orchestrator.js'

const store = vi.hoisted(() => ({
  sessionStatus: 'pending',
  terminalWrites: [] as string[],
  settles: [] as Array<{ userId: string; amount: number; reason?: string; idempotencyKey?: string }>,
  costs: [] as Array<{ totalTokens: number; requestType: string }>,
  usageQueue: [] as number[],
  upstreamCalls: 0,
}))

const mocks = vi.hoisted(() => ({
  aiServiceFetch: vi.fn(),
  resolveAiCost: vi.fn(),
  recordAiCost: vi.fn(),
  settleWalletUsage: vi.fn(),
  getWalletBalance: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  eq: () => ({}),
  and: () => ({}),
  ne: () => ({}),
  desc: () => ({}),
  sql: Object.assign(() => ({}), { raw: (s: string) => s }),
}))

vi.mock('@ihui/database', () => ({
  crewSession: 'crewSession',
  crewTask: 'crewTask',
  crewMessage: 'crewMessage',
  crewArtifact: 'crewArtifact',
}))

vi.mock('../src/db/index.js', () => {
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: 's-1',
              userId: 'user-u',
              title: '夹具会话',
              status: store.sessionStatus,
              inputMessage: '拆解一下任务',
              outputMessage: null,
              config: {},
              createdAt: new Date(),
              completedAt: null,
            },
          ],
        }),
        orderBy: () => ({ limit: async () => [] }),
      }),
    }),
    update: (table: string) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          // 抢占 running 的条件写(第一条语句)
          returning: async () => {
            if (table === 'crewSession' && values.status === 'running') {
              if (store.sessionStatus === 'running') return []
              store.sessionStatus = 'running'
              return [{ id: 's-1' }]
            }
            return []
          },
          // 终态写 / 任务状态写:await 落到这里
          then: (resolve: (v: unknown) => void) => {
            if (table === 'crewSession' && typeof values.status === 'string') {
              store.sessionStatus = values.status
              store.terminalWrites.push(values.status)
            }
            resolve(undefined)
          },
        }),
      }),
    }),
    insert: () => ({ values: async () => undefined }),
  }
  return { db, dbRead: db }
})

vi.mock('../src/services/crew-agent-registry.js', () => ({
  agentRegistry: {
    getRole: (role: string) => ({ role, goal: 'g', backstory: 'b' }),
    listRoles: () => [],
  },
}))

vi.mock('../src/services/knowledge-rag-service.js', () => ({
  knowledgeRagService: { getRagContext: async () => '' },
}))

vi.mock('../src/services/crew-tools.js', () => ({
  getCrewToolDefinitions: () => [],
  executeCrewTool: async () => ({ success: true, output: '' }),
}))

// ---- crew-llm-adapter 的下游依赖(结算边界在这里) ----
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
vi.mock('../src/plugins/token-balance-service.js', () => ({
  getWalletBalance: mocks.getWalletBalance,
  settleWalletUsage: mocks.settleWalletUsage,
}))
vi.mock('../src/services/context-manager-service.js', () => ({
  estimateTokens: () => 10,
}))
vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const { crewOrchestrator } = await import('../src/services/crew-orchestrator.js')

/** 每次调用取一个固定用量,便于按金额反推「结算了几次」。 */
function nextUsage(): number {
  return store.usageQueue.length > 0 ? store.usageQueue.shift()! : 100
}

beforeEach(() => {
  store.sessionStatus = 'pending'
  store.terminalWrites.length = 0
  store.settles.length = 0
  store.costs.length = 0
  store.usageQueue = [100, 120, 140, 160, 180]
  store.upstreamCalls = 0

  mocks.getWalletBalance.mockResolvedValue(1_000_000)
  mocks.settleWalletUsage.mockImplementation(
    async (input: { userId: string; amount: number; reason?: string; idempotencyKey?: string }) => {
      store.settles.push(input)
      return { deducted: input.amount, remaining: 1_000_000, shortfall: 0 }
    },
  )
  // 折算规则与 F-203 夹具同形:1 token = 0.1 分,金额可精确断言
  mocks.resolveAiCost.mockImplementation(
    async (input: { promptTokens: number; completionTokens: number }) => ({
      cost: (input.promptTokens + input.completionTokens) / 10,
      currency: 'CNY',
      pricing: null,
    }),
  )
  mocks.recordAiCost.mockImplementation(async (input: { totalTokens: number; requestType: string }) => {
    store.costs.push({ totalTokens: input.totalTokens, requestType: input.requestType })
    return { cost: 0, currency: 'CNY' }
  })
  mocks.aiServiceFetch.mockImplementation(async () => {
    const total = nextUsage()
    store.upstreamCalls++
    return {
      ok: true,
      json: async () => ({
        content: `ok-${total}`,
        model: 'agnes/default',
        usage: {
          prompt_tokens: total * 0.4,
          completion_tokens: total * 0.6,
          total_tokens: total,
        },
        stub: false,
      }),
    }
  })
})

describe('SDB-30 计费幂等键按「单次执行的用量单元」而非 session', () => {
  it('① 同一 session 第二次执行(新 runId)⇒ 再扣一次', async () => {
    const first = await crewOrchestrator.executeSession('s-1')
    expect(first.success).toBe(true)
    expect(first.usage?.calls).toBe(5)
    const firstRunSettles = [...store.settles]
    expect(firstRunSettles).toHaveLength(5)

    // completed 会话允许重跑(DB 条件写只拦 running),这正是原缺陷的入口
    const second = await crewOrchestrator.executeSession('s-1')
    expect(second.success).toBe(true)
    expect(second.runId).not.toBe(first.runId)

    // 两次执行各 5 次真实调用 ⇒ 各 5 笔结算,第二次不再被会话级幂等键吃掉
    expect(store.settles).toHaveLength(10)
    expect(store.settles.slice(0, 5).map((s) => s.amount)).toEqual([10, 12, 14, 16, 18])
    expect(store.settles.slice(5).map((s) => s.amount)).toEqual([10, 10, 10, 10, 10])
    expect(store.settles.every((s) => s.userId === 'user-u')).toBe(true)
  })

  it('② 同一 runId 的用量只结算一次:结算次数恒等于真实调用次数,终态事件不追加', async () => {
    const events: CrewStreamEvent[] = []
    for await (const evt of crewOrchestrator.executeSessionStreaming('s-1')) events.push(evt)

    const complete = events.at(-1)!
    expect(complete.type).toBe('complete')
    expect(complete.runId).toBeTruthy()
    expect(complete.usage?.calls).toBe(5)

    // 结算发生在每次真实调用处:一次执行 5 次调用 = 5 笔,终态事件本身不再结算
    expect(store.upstreamCalls).toBe(5)
    expect(store.settles).toHaveLength(5)
    expect(store.costs).toHaveLength(5)
    // 每条成本记录都归属这次 run 的会话,没有被 session 级去重合并成一条
    expect(store.costs.map((c) => c.totalTokens)).toEqual([100, 120, 140, 160, 180])
  })

  it('③ 取消但已产生用量 ⇒ 已发生的调用照常结算,后续 step 不再发起调用', async () => {
    const events: CrewStreamEvent[] = []
    for await (const evt of crewOrchestrator.executeSessionStreaming('s-1')) {
      events.push(evt)
      // planner 跑完(第一笔用量已发生)后取消:等价于客户端断连/上游 abort
      if (evt.type === 'task_complete') crewOrchestrator.cancel('s-1')
    }

    const last = events.at(-1)!
    expect(last.type).toBe('error')
    expect(last.content).toContain('已取消')
    // 取消分支的 usage 是这次 run 的 partial usage,不是 undefined
    expect(last.usage?.calls).toBe(1)
    expect(last.usage?.totalTokens).toBe(100)
    expect(last.runId).toBeTruthy()

    expect(store.upstreamCalls).toBe(1)
    expect(store.settles).toHaveLength(1)
    expect(store.settles[0]!.amount).toBe(10) // 100 token × 0.1 分
    expect(store.terminalWrites.at(-1)).toBe('cancelled')
  })

  it('④ 取消且零用量 ⇒ 不扣费(不硬造金额)', async () => {
    const events: CrewStreamEvent[] = []
    for await (const evt of crewOrchestrator.executeSessionStreaming('s-1')) {
      events.push(evt)
      // 计划刚产出、第一条 LLM 调用尚未发起就取消
      if (evt.type === 'plan') crewOrchestrator.cancel('s-1')
    }

    const last = events.at(-1)!
    expect(last.type).toBe('error')
    expect(last.usage?.calls).toBe(0)
    expect(last.usage?.totalTokens).toBe(0)

    expect(store.upstreamCalls).toBe(0)
    expect(store.settles).toHaveLength(0)
    expect(store.costs).toHaveLength(0)
    expect(store.terminalWrites.at(-1)).toBe('cancelled')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
