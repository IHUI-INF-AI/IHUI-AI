// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-203 夹具:Crew 子 LLM 调用必须走真实扣费链路(user_margins + token_flows),
// 与 ai_cost_records 的调用次数/用量一一对应。
//
// 改前:callRealLlm 只 recordAiCost 落统计表,不扣钱包 —— Crew 里循环 3 次 llm_generate,
// 余额一分不动,token_flows 0 条。
// 改后:每次返回真实 usage 后,按 totalTokens 原子扣 user_margins.token_quantity 并写流水。

import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = vi.hoisted(() => ({
  wallet: 0,
  flows: [] as Array<{ amount: number; balanceAfter: number }>,
  costs: [] as Array<{ userId: string; totalTokens: number; requestType: string }>,
  usageQueue: [] as number[],
}))

const mocks = vi.hoisted(() => ({
  aiServiceFetch: vi.fn(),
  recordAiCost: vi.fn(),
}))

const TX = {
  select: () => ({
    from: () => ({
      where: () => ({ limit: async () => [{ tokenQuantity: store.wallet }] }),
    }),
  }),
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
vi.mock('../src/plugins/ai-cost.js', () => ({ recordAiCost: mocks.recordAiCost }))
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
  mocks.recordAiCost.mockReset()
  mocks.recordAiCost.mockImplementation(async (input) => {
    store.costs.push(input)
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

describe('F-203 Crew 子 LLM 计费', () => {
  it('循环 3 次 llm_generate:按量扣钱包并写 3 条流水,与 ai_cost_records 对齐', async () => {
    for (let i = 0; i < 3; i++) {
      await callRealLlm({
        messages: [{ role: 'user', content: `第${i}次` }],
        userId: 'u1',
        sessionId: 's1',
      })
    }

    // 100 + 150 + 50 = 300
    expect(store.wallet).toBe(700)
    expect(store.flows).toHaveLength(3)
    expect(store.flows.map((f) => f.amount)).toEqual([100, 150, 50])
    expect(store.flows.map((f) => f.balanceAfter)).toEqual([900, 750, 700])
    // 统计表与扣费逐次对齐(3 次调用 = 3 条 cost + 3 条流水)
    expect(store.costs.map((c) => c.totalTokens)).toEqual([100, 150, 50])
    expect(store.costs).toHaveLength(store.flows.length)
    // 改前 wallet 仍为 1000、flows 为 0 ⇒ 前两条断言红。
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
