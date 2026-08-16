/**
 * prompt cache 折扣计费单测(P0-5b,2026-07-31 立)。
 *
 * 覆盖点:
 * - calculateCost 无 cache(回归,与原价相同)
 * - calculateCost 全部 cache hit(cacheReadTokens = promptTokens,input cost = 10% 原价)
 * - calculateCost 全部 cache creation(cacheCreationTokens = promptTokens,input cost = 125% 原价)
 * - calculateCost 混合(普通 + cache hit + cache creation)
 * - calculateCost output 不受 cache 影响
 * - calculateCost 边界:cacheReadTokens + cacheCreationTokens > promptTokens(clamp)
 * - calculateCost 边界:cacheReadTokens = 0 / cacheCreationTokens = 0(默认值)
 * - recordCall 写入 cache_read_tokens / cache_creation_tokens
 * - recordCall 总成本 = 普通 + cache read + cache creation + output
 * - recordCall 未传 cache 字段时默认 0(回归)
 *
 * 测试模式:vi.mock 掉 db / @ihui/database(对齐 relay-billing-service.test.ts)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * 构建链式 mock:dbRead.select(...).from(...).where(...).limit() / .orderBy().limit()
 * 返回值是 dbRead.select() 的返回值(即 { from: fn }),从 from 开始链式调用。
 */
function chain(limitReturn: unknown[]) {
  const limit = vi.fn().mockResolvedValue(limitReturn)
  const orderBy = vi.fn().mockReturnValue({ limit })
  const where = vi.fn().mockReturnValue({ limit, orderBy })
  const from = vi.fn().mockReturnValue({ where })
  return { from }
}

const { mockDbReadSelect, mockDbInsert, mockDbUpdate } = vi.hoisted(() => ({
  mockDbReadSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
  dbRead: {
    select: mockDbReadSelect,
  },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  developerApiKeys: {
    id: 'id',
    userId: 'user_id',
    status: 'status',
    tokenBalance: 'token_balance',
    costBalanceCents: 'cost_balance_cents',
    tokenUsedTotal: 'token_used_total',
    costUsedTotalCents: 'cost_used_total_cents',
    updatedAt: 'updated_at',
  },
  llmCallLogs: { id: 'id' },
  aiPricing: {
    modelId: 'model_id',
    inputTokenPrice: 'input_token_price',
    outputTokenPrice: 'output_token_price',
    effectiveAt: 'effective_at',
    expiresAt: 'expires_at',
  },
  aiModelConfigModels: {
    id: 'id',
    modelId: 'model_id',
    configId: 'config_id',
    inputPricePer1k: 'input_price_per_1k',
    outputPricePer1k: 'output_price_per_1k',
    relayPriceMultiplier: 'relay_price_multiplier',
    isRelayPublic: 'is_relay_public',
    enabled: 'enabled',
  },
  aiModelConfig: {
    id: 'id',
    ownerUuid: 'owner_uuid',
    providerCode: 'provider_code',
    enabled: 'enabled',
    byokCommissionRate: 'byok_commission_rate',
  },
  apiKeyGroups: { id: 'id' },
}))

// Mock 外部 service(避免真实调用消耗 dbRead.select mock 队列 / .innerJoin 不支持)
vi.mock('../src/services/api-key-group-service.js', () => ({
  getKeyGroup: vi.fn().mockResolvedValue(null),
}))
vi.mock('../src/services/user-billing-group-service.js', () => ({
  getUserModelMultiplier: vi.fn().mockResolvedValue(1),
}))
vi.mock('../src/services/tiered-pricing-service.js', () => ({
  getCurrentTierMultiplier: vi.fn().mockResolvedValue({
    multiplier: 1,
    currentTokens: 0,
    nextTierThreshold: null,
    nextTierMultiplier: null,
  }),
}))
vi.mock('../src/services/relay-commission-service.js', () => ({
  recordRelayCommission: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/webhook-relay-notifier.js', () => ({
  notifyRelayEvent: vi.fn().mockResolvedValue(undefined),
}))

import { calculateCost, recordCall } from '../src/services/relay-billing-service.js'

describe('relay-billing-service — prompt cache 折扣计费', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================================================
  // 1. calculateCost 无 cache(回归,与原价相同)
  // ===========================================================================
  describe('calculateCost 无 cache(回归)', () => {
    it('不传 options 时,input cost = promptTokens × inputPrice / 1000 × multiplier(原价)', async () => {
      // aiPricing: inputPrice=10 分/千 token, outputPrice=30 分/千 token
      // modelRow: relayPriceMultiplier=1.0
      // 1000 prompt + 500 completion → input=10*1000/1000=10, output=30*500/1000=15, total=25
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))

      const result = await calculateCost('gpt-4o', 1000, 500)
      expect(result.inputCostCents).toBe(10)
      expect(result.outputCostCents).toBe(15)
      expect(result.cacheReadCostCents).toBe(0)
      expect(result.cacheCreationCostCents).toBe(0)
      expect(result.totalCostCents).toBe(25)
      expect(result.source).toBe('ai_pricing')
    })

    it('传空 options 也回归原价', async () => {
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))

      const result = await calculateCost('gpt-4o', 1000, 500, {})
      expect(result.inputCostCents).toBe(10)
      expect(result.cacheReadCostCents).toBe(0)
      expect(result.cacheCreationCostCents).toBe(0)
      expect(result.totalCostCents).toBe(25)
    })
  })

  // ===========================================================================
  // 2. calculateCost 全部 cache hit(cacheReadTokens = promptTokens,input cost = 10% 原价)
  // ===========================================================================
  describe('calculateCost 全部 cache hit', () => {
    it('cacheReadTokens = promptTokens → input cost = 10% 原价,cacheReadCostCents = 1', async () => {
      // inputPrice=10 分/千 token, promptTokens=1000, 全部 cache hit
      // 原价 input = 10*1000/1000 = 10 分
      // cache hit cost = 10*1000*0.1/1000 = 1 分(10% 原价)
      // normalInput = 0,cacheReadCostCents = 1,total = 1 + 0 + 0 + output
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))

      const result = await calculateCost('gpt-4o', 1000, 0, { cacheReadTokens: 1000 })
      expect(result.inputCostCents).toBe(0) // 普通 input = 0
      expect(result.cacheReadCostCents).toBe(1) // 10% 原价
      expect(result.cacheCreationCostCents).toBe(0)
      expect(result.totalCostCents).toBe(1)
    })

    it('cache hit 节省 90% input 成本(对比无 cache)', async () => {
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))

      const withoutCache = await calculateCost('gpt-4o', 1000, 0)
      // 重置 mock(同一测试内多次调用 calculateCost)
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))
      const withCache = await calculateCost('gpt-4o', 1000, 0, { cacheReadTokens: 1000 })

      expect(withoutCache.totalCostCents).toBe(10) // 原价 10 分
      expect(withCache.totalCostCents).toBe(1) // cache hit 1 分 = 10% 原价
      expect(withCache.totalCostCents).toBeLessThan(withoutCache.totalCostCents)
    })
  })

  // ===========================================================================
  // 3. calculateCost 全部 cache creation(cacheCreationTokens = promptTokens,input cost = 125% 原价)
  // ===========================================================================
  describe('calculateCost 全部 cache creation', () => {
    it('cacheCreationTokens = promptTokens → input cost = 125% 原价', async () => {
      // inputPrice=10 分/千 token, promptTokens=1000, 全部 cache creation
      // 原价 input = 10 分
      // cache creation cost = 10*1000*1.25/1000 = 12.5 → round = 13 分(125% 原价)
      // 注意:Math.round(12.5) = 13(JS Math.round 对 .5 向上取整)
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))

      const result = await calculateCost('gpt-4o', 1000, 0, { cacheCreationTokens: 1000 })
      expect(result.inputCostCents).toBe(0)
      expect(result.cacheReadCostCents).toBe(0)
      expect(result.cacheCreationCostCents).toBe(13) // round(12.5) = 13
      expect(result.totalCostCents).toBe(13)
    })
  })

  // ===========================================================================
  // 4. calculateCost 混合(50% 普通 + 30% cache hit + 20% cache creation)
  // ===========================================================================
  describe('calculateCost 混合(50% 普通 + 30% cache hit + 20% cache creation)', () => {
    it('promptTokens=1000, 500 普通 + 300 cache hit + 200 cache creation', async () => {
      // inputPrice=10 分/千 token
      // 普通 input = 10*500/1000 = 5 分
      // cache read = 10*300*0.1/1000 = 0.3 → round = 0 分
      // cache creation = 10*200*1.25/1000 = 2.5 → round = 3 分
      // total input-side = 5 + 0 + 3 = 8 分
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))

      const result = await calculateCost('gpt-4o', 1000, 0, {
        cacheReadTokens: 300,
        cacheCreationTokens: 200,
      })
      expect(result.inputCostCents).toBe(5) // 普通 500 × 10/1000
      expect(result.cacheReadCostCents).toBe(0) // round(0.3) = 0
      expect(result.cacheCreationCostCents).toBe(3) // round(2.5) = 3
      expect(result.totalCostCents).toBe(8)
    })

    it('混合场景 + output tokens:total = 普通 + cache read + cache creation + output', async () => {
      // inputPrice=10, outputPrice=30, promptTokens=1000, completion=500
      // 普通 input(500)= 5,cache read(300)= 0,cache creation(200)= 3
      // output = 30*500/1000 = 15
      // total = 5 + 0 + 3 + 15 = 23
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))

      const result = await calculateCost('gpt-4o', 1000, 500, {
        cacheReadTokens: 300,
        cacheCreationTokens: 200,
      })
      expect(result.inputCostCents).toBe(5)
      expect(result.cacheReadCostCents).toBe(0)
      expect(result.cacheCreationCostCents).toBe(3)
      expect(result.outputCostCents).toBe(15)
      expect(result.totalCostCents).toBe(23)
    })
  })

  // ===========================================================================
  // 5. calculateCost output 不受 cache 影响
  // ===========================================================================
  describe('calculateCost output 不受 cache 影响', () => {
    it('cache 选项不影响 output cost 计算', async () => {
      // output = 30*1000/1000 = 30 分,与 cache 选项无关
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))

      const result = await calculateCost('gpt-4o', 1000, 1000, {
        cacheReadTokens: 500,
        cacheCreationTokens: 500,
      })
      expect(result.outputCostCents).toBe(30) // 不受 cache 影响
    })
  })

  // ===========================================================================
  // 6. calculateCost 边界:cacheReadTokens + cacheCreationTokens > promptTokens(clamp)
  // ===========================================================================
  describe('calculateCost 边界:cache 之和 > promptTokens 时 clamp', () => {
    it('cacheReadTokens=800 + cacheCreationTokens=800 > promptTokens=1000 → clamp 到 800+200', async () => {
      // promptTokens=1000, cacheRead=800(优先),cacheCreation clamp 到 200(剩余)
      // 普通 input = 0
      // cache read = 10*800*0.1/1000 = 0.8 → round = 1 分
      // cache creation = 10*200*1.25/1000 = 2.5 → round = 3 分
      // total = 0 + 1 + 3 + 0 = 4 分
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))

      const result = await calculateCost('gpt-4o', 1000, 0, {
        cacheReadTokens: 800,
        cacheCreationTokens: 800,
      })
      // 普通 input = max(0, 1000-800-200) = 0
      expect(result.inputCostCents).toBe(0)
      // cache read = 800(原值)
      expect(result.cacheReadCostCents).toBe(1) // round(0.8) = 1
      // cache creation clamp 到 200(剩余 1000-800)
      expect(result.cacheCreationCostCents).toBe(3) // round(2.5) = 3
      expect(result.totalCostCents).toBe(4)
    })

    it('cacheReadTokens > promptTokens 时 clamp 到 promptTokens,普通 input = 0', async () => {
      // promptTokens=500, cacheRead=1000(>500)→clamp 到 500,cacheCreation=0
      // 普通 input = 0,cache read = 10*500*0.1/1000 = 0.5 → round = 1 分(注意 JS:round(0.5)=1)
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))

      const result = await calculateCost('gpt-4o', 500, 0, { cacheReadTokens: 1000 })
      expect(result.inputCostCents).toBe(0)
      expect(result.cacheReadCostCents).toBe(1) // round(0.5) = 1
      expect(result.cacheCreationCostCents).toBe(0)
    })

    it('负数 cache tokens 视为 0(Math.max(0, ...))', async () => {
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))

      const result = await calculateCost('gpt-4o', 1000, 0, {
        cacheReadTokens: -100,
        cacheCreationTokens: -50,
      })
      // 负数 → 0,等同无 cache
      expect(result.inputCostCents).toBe(10) // 1000 × 10/1000
      expect(result.cacheReadCostCents).toBe(0)
      expect(result.cacheCreationCostCents).toBe(0)
      expect(result.totalCostCents).toBe(10)
    })
  })

  // ===========================================================================
  // 7. calculateCost 边界:cacheReadTokens = 0 / cacheCreationTokens = 0(默认值)
  // ===========================================================================
  describe('calculateCost 边界:cache = 0(默认值)', () => {
    it('cacheReadTokens=0 + cacheCreationTokens=0 → 等同无 cache(原价)', async () => {
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))

      const result = await calculateCost('gpt-4o', 1000, 500, {
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      })
      expect(result.inputCostCents).toBe(10)
      expect(result.outputCostCents).toBe(15)
      expect(result.cacheReadCostCents).toBe(0)
      expect(result.cacheCreationCostCents).toBe(0)
      expect(result.totalCostCents).toBe(25)
    })
  })

  // ===========================================================================
  // 8. recordCall 写入 cache_read_tokens / cache_creation_tokens
  // ===========================================================================
  describe("recordCall mode='relay' 写入 cache 字段", () => {
    it('recordCall 调用时 cache 字段透传到 llm_call_logs insert', async () => {
      // calculateCost 内部两次 select(getUserModelMultiplier / getCurrentTierMultiplier 已 mock)
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))
      // llm_call_logs insert
      const returningFn = vi.fn().mockResolvedValue([{ id: 'log-cache-1' }])
      const valuesFn = vi.fn().mockReturnValue({ returning: returningFn })
      mockDbInsert.mockReturnValue({ values: valuesFn })
      // developerApiKeys update(支持 .returning() 链式)
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ tokenBalance: 1000, costBalanceCents: 500 }]),
          }),
        }),
      })

      const result = await recordCall({
        apiKeyId: 'key-1',
        userId: 'user-1',
        model: 'gpt-4o',
        prompt: 'hello',
        response: 'world',
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        latencyMs: 50,
        status: 'success',
        cacheReadTokens: 600,
        cacheCreationTokens: 200,
      })

      // 成本:普通 input(200)=2 + cache read(600)=1 + cache creation(200)=3 + output(500)=15 = 21
      expect(result.costCents).toBe(21)

      // 验证 insert 时透传 cache 字段
      const insertedValues = valuesFn.mock.calls[0]?.[0] as Record<string, unknown> | undefined
      expect(insertedValues).toBeDefined()
      expect(insertedValues!.cacheReadTokens).toBe(600)
      expect(insertedValues!.cacheCreationTokens).toBe(200)
    })

    it('recordCall 未传 cache 字段时默认 0(回归)', async () => {
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))
      const valuesFnNoCache = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'log-cache-2' }]),
      })
      mockDbInsert.mockReturnValue({ values: valuesFnNoCache })
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ tokenBalance: 1000, costBalanceCents: 500 }]),
          }),
        }),
      })

      const result = await recordCall({
        apiKeyId: 'key-1',
        userId: 'user-1',
        model: 'gpt-4o',
        prompt: 'hello',
        response: 'world',
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        latencyMs: 50,
        status: 'success',
        // 不传 cacheReadTokens / cacheCreationTokens
      })

      // 等同无 cache:input=10 + output=15 = 25
      expect(result.costCents).toBe(25)

      const insertedValues = valuesFnNoCache.mock.calls[0]?.[0] as
        Record<string, unknown> | undefined
      expect(insertedValues).toBeDefined()
      expect(insertedValues!.cacheReadTokens).toBe(0)
      expect(insertedValues!.cacheCreationTokens).toBe(0)
    })

    it('recordCall 总成本 = 普通 input + cache read + cache creation + output', async () => {
      // inputPrice=10, outputPrice=30, multiplier=2.0(中转站加价 100%)
      // promptTokens=1000, completion=500, cacheRead=400, cacheCreation=300, normal=300
      // 普通 input = 10*300/1000 × 2 = 6 分
      // cache read = 10*400*0.1/1000 × 2 = 0.8 → round = 1 分
      // cache creation = 10*300*1.25/1000 × 2 = 7.5 → round = 8 分
      // output = 30*500/1000 × 2 = 30 分
      // total = 6 + 1 + 8 + 30 = 45 分
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '2.0' }]),
        )
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))
      const valuesFnTotal = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'log-cache-3' }]),
      })
      mockDbInsert.mockReturnValue({ values: valuesFnTotal })
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ tokenBalance: 1000, costBalanceCents: 500 }]),
          }),
        }),
      })

      const result = await recordCall({
        apiKeyId: 'key-1',
        userId: 'user-1',
        model: 'gpt-4o',
        prompt: 'hello',
        response: 'world',
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        latencyMs: 50,
        status: 'success',
        cacheReadTokens: 400,
        cacheCreationTokens: 300,
      })

      expect(result.costCents).toBe(45)

      // 验证 insert 透传 cache 字段
      const insertedValues = valuesFnTotal.mock.calls[0]?.[0] as Record<string, unknown> | undefined
      expect(insertedValues).toBeDefined()
      expect(insertedValues!.cacheReadTokens).toBe(400)
      expect(insertedValues!.cacheCreationTokens).toBe(300)
    })
  })
})
