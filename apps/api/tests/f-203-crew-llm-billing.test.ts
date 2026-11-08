// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-203 夹具(口径 B:按真实成本折算后扣费)。
//
// 钱包 user_margins.token_quantity 的单位是「分」。一条 5000 token 的回复不能扣 5000 分(¥50),
// 必须先经 ai_pricing(分/千 token)折算成成本,再扣同一个数进钱包与 ai_cost_records。
//
// 本夹具 mock 定价: prompt 300 分/千 token、completion 600 分/千 token。
// 改前(把 token 当分):usage 100 ⇒ 扣 100 分;改后:usage 100(40/60) ⇒ 48 分。

import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = vi.hoisted(() => ({
  wallet: 0,
  flows: [] as Array<{ amount: number; balanceAfter: number }>,
  costs: [] as Array<{ userId: string; totalTokens: number; requestType: string; cost?: number; metadata?: string }>,
  usageQueue: [] as number[],
}))

const mocks = vi.hoisted(() => ({
  aiServiceFetch: vi.fn(),
  resolveAiCost: vi.fn(),
  recordAiCost: vi.fn(),
}))

const selectChain = () => {
  const rows = [{ tokenQuantity: store.wallet }]
  const p = Promise.resolve(rows)
  const chain: Record<string, unknown> = {}
  chain.from = () => chain
  chain.where = () => chain
  // 同时支持 await limit(1) 与 limit(1).for('update')(settleWalletUsage 走行锁)
  chain.limit = () => ({ then: p.then.bind(p), for: () => p })
  return chain
}

const TX = {
  select: selectChain,
  update: () => ({
    set: (values: Record<string, unknown>) => ({
      where: () => ({
        returning: async () => {
          const vals = (values.tokenQuantity as { vals?: unknown[] } | undefined)?.vals ?? []
          const amount = Number(vals.find((v) => typeof v === 'number') ?? 0)
          if (store.wallet < amount) return []
          store.wallet -= amount
          return [{ tokenQuantity: store.wallet }]
        },
      }),
    }),
  }),
  execute: (q: { vals?: unknown[] }) => {
    const nums = (q.vals ?? []).filter((v): v is number => typeof v === 'number')
    // op_type=1 是模板字面量,占位参数顺序: userId, quantity, balanceAfter, remark, relatedOrderNo
    store.flows.push({ amount: nums[0] ?? 0, balanceAfter: nums[1] ?? 0 })
    return Promise.resolve([])
  },
}

vi.mock('../src/db/index.js', () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(TX),
    select: TX.select,
    update: TX.update,
    execute: TX.execute,
  },
  dbRead: { select: TX.select, execute: TX.execute },
}))

vi.mock('@ihui/database', () => ({
  userMargins: 'userMargins',
  users: 'users',
  tokenFlows: 'tokenFlows',
}))

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({ sql: strings.join('?'), vals }),
    { raw: (s: string) => s },
  ),
  and: (...xs: unknown[]) => ({ op: 'and', xs }),
  eq: (col: unknown, val: unknown) => ({ op: 'eq', col, val }),
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
  store.wallet = 1000
  store.flows.length = 0
  store.costs.length = 0
  store.usageQueue = [100, 150, 50]
  // 定价:prompt 300 分/千 token,completion 600 分/千 token
  mocks.resolveAiCost.mockReset()
  mocks.resolveAiCost.mockImplementation(async (input: { promptTokens: number; completionTokens: number }) => ({
    cost: (input.promptTokens / 1000) * 300 + (input.completionTokens / 1000) * 600,
    currency: 'CNY',
    pricing: null,
  }))
  mocks.recordAiCost.mockReset()
  mocks.recordAiCost.mockImplementation(async (input) => {
    store.costs.push(input)
    return { cost: input.cost ?? 0, currency: 'CNY' }
  })
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

describe('F-203 Crew 子 LLM 计费(按成本折算,单位分)', () => {
  it('3 次调用:按 ai_pricing 折算成本扣钱包,流水与 ai_cost_records 同一个数', async () => {
    for (let i = 0; i < 3; i++) {
      await callRealLlm({ messages: [{ role: 'user', content: `第${i}次` }], userId: 'u1', sessionId: 's1' })
    }

    // 100/150/50 token ⇒ 48/72/24 分(不再是 100/150/50)
    expect(store.flows.map((f) => f.amount)).toEqual([48, 72, 24])
    expect(store.flows.map((f) => f.balanceAfter)).toEqual([952, 880, 856])
    expect(store.wallet).toBe(856)
    // 扣费与账本同源:钱包扣的 == ai_cost_records.cost
    expect(store.costs.map((c) => c.cost)).toEqual([48, 72, 24])
    expect(store.costs.map((c) => c.cost)).toEqual(store.flows.map((f) => f.amount))
    expect(store.costs.map((c) => c.totalTokens)).toEqual([100, 150, 50])
    expect(
      store.costs.map((c) => JSON.parse(c.metadata!).billing.billingShortfallCents),
    ).toEqual([0, 0, 0])
  })

  it('零余额:预检 402,不发起上游调用、不落成本/流水', async () => {
    store.wallet = 0

    await expect(
      callRealLlm({ messages: [{ role: 'user', content: '零余额' }], userId: 'u1', sessionId: 's1' }),
    ).rejects.toMatchObject({ statusCode: 402, errorCode: 'INSUFFICIENT_BALANCE' })

    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
    expect(store.costs).toHaveLength(0)
    expect(store.flows).toHaveLength(0)
  })

  it('余额 > 0 但低于预估成本:同样 402(阈值是预估成本,不是 > 0)', async () => {
    store.wallet = 10 // 预估:100 个中文字 ≈ 100 token ⇒ 30 分
    const longMessage = '长'.repeat(100)

    await expect(
      callRealLlm({ messages: [{ role: 'user', content: longMessage }], userId: 'u1', sessionId: 's1' }),
    ).rejects.toMatchObject({ statusCode: 402, errorCode: 'INSUFFICIENT_BALANCE' })

    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
    expect(store.wallet).toBe(10)
  })

  it('运行中耗尽:按成本扣到 0,欠额入 ai_cost_records,后续被预检拒绝', async () => {
    store.wallet = 20
    store.usageQueue = [100] // 实际成本 48 分 > 余额 20 分

    const first = await callRealLlm({
      messages: [{ role: 'user', content: '刚够一半' }],
      userId: 'u1',
      sessionId: 's1',
    })

    expect(first.content).toBe('ok')
    expect(store.wallet).toBe(0)
    expect(store.flows).toEqual([{ amount: 20, balanceAfter: 0 }])

    // 欠额不是只打日志:整笔成本与差额都在可审计的成本记录里
    expect(store.costs).toHaveLength(1)
    expect(store.costs[0]!.cost).toBe(48)
    const meta = JSON.parse(store.costs[0]!.metadata!)
    expect(meta.sessionId).toBe('s1')
    expect(meta.billing).toEqual({
      walletDeductedCents: 20,
      walletBalanceAfterCents: 0,
      billingShortfallCents: 28,
    })

    // 第二次:余额 0,预检 402,上游调用数仍为 1
    store.usageQueue = [10]
    await expect(
      callRealLlm({ messages: [{ role: 'user', content: '再来一次' }], userId: 'u1', sessionId: 's1' }),
    ).rejects.toMatchObject({ statusCode: 402, errorCode: 'INSUFFICIENT_BALANCE' })
    expect(mocks.aiServiceFetch).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
