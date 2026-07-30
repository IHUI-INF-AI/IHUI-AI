/**
 * BYOK 计费链路单测(P0-5 BYOK,2026-07-30 立)。
 *
 * 覆盖点:
 * - isFreeProvider:免费 provider 前缀匹配
 * - calculateByokCost:上游原价 + 抽成(不乘中转站倍率,免费 provider 抽成 0)
 * - isByokCall:用户私有 ai_model_config 配置存在性判断
 * - getByokCommissionRate:全局抽成率(默认 0.1,容错无效值)
 * - recordCall mode='byok':只扣 platformFeeCents,不扣 upstreamCostCents,metadata.byokMode=true
 *
 * 测试模式:vi.mock 掉 db / @ihui/database(对齐 api-key-quota.test.ts)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * 构建链式 mock:dbRead.select(...).from(...).where(...).limit() / .orderBy().limit()
 * 返回值是 dbRead.select() 的返回值(即 { from: fn }),从 from 开始链式调用。
 *
 * 同时支持两种链式:
 * - select().from().where().limit()(calculateByokCost modelRow / isByokCall / getByokCommissionRate)
 * - select().from().where().orderBy().limit()(calculateByokCost pricingRow)
 */
function chain(limitReturn: unknown[]) {
  const limit = vi.fn().mockResolvedValue(limitReturn)
  const orderBy = vi.fn().mockReturnValue({ limit })
  // where 返回既有 limit 又有 orderBy 的对象(两种链式都满足)
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
  // dbRead.select 直接用 mockDbReadSelect,mockReturnValueOnce 直接控制返回值
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
}))

import {
  isFreeProvider,
  calculateByokCost,
  isByokCall,
  getByokCommissionRate,
  recordCall,
} from '../src/services/relay-billing-service.js'

describe('relay-billing-service — BYOK 计费链路', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================================================
  // 1. isFreeProvider — 免费 provider 前缀匹配
  // ===========================================================================
  describe('isFreeProvider', () => {
    it('cloudflare/ 前缀命中 → true', () => {
      expect(isFreeProvider('cloudflare/llama-3.1-8b-instruct')).toBe(true)
    })

    it('huggingface/ 前缀命中 → true(大小写不敏感)', () => {
      expect(isFreeProvider('HuggingFace/mistral-7b')).toBe(true)
    })

    it('gpt-4o 未命中免费前缀 → false', () => {
      expect(isFreeProvider('gpt-4o')).toBe(false)
    })

    it('pollinations/ 命中 → true', () => {
      expect(isFreeProvider('pollinations/text')).toBe(true)
    })
  })

  // ===========================================================================
  // 2. calculateByokCost — 上游原价 + 抽成(不乘倍率,免费 provider 抽成 0)
  // ===========================================================================
  describe('calculateByokCost', () => {
    it('付费 provider + 10% 抽成:platformFeeCents = round(upstream × 0.1)', async () => {
      // aiPricing 返回 inputPrice=10 分/千 token,outputPrice=30 分/千 token
      // 100 prompt + 200 completion → upstream = 10*100/1000 + 30*200/1000 = 1 + 6 = 7 分
      // platformFee = round(7 × 0.1) = 1 分
      mockDbReadSelect
        .mockReturnValueOnce(chain([])) // modelRow 空(第 1 次 select)
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }])) // pricingRow(第 2 次)

      const result = await calculateByokCost('gpt-4o', 100, 200, 0.1)
      expect(result.upstreamCostCents).toBe(7)
      expect(result.platformFeeCents).toBe(1)
      expect(result.commissionRate).toBe(0.1)
      expect(result.isFree).toBe(false)
      expect(result.source).toBe('ai_pricing')
    })

    it('免费 provider(cloudflare/)→ platformFeeCents=0,upstreamCostCents 仍按定价算', async () => {
      mockDbReadSelect
        .mockReturnValueOnce(chain([{ inputPricePer1k: 5, outputPricePer1k: 5 }]))
        .mockReturnValueOnce(chain([]))

      const result = await calculateByokCost('cloudflare/llama-3.1-8b', 1000, 1000, 0.1)
      // upstream = 5*1000/1000 + 5*1000/1000 = 10 分
      expect(result.upstreamCostCents).toBe(10)
      expect(result.platformFeeCents).toBe(0)
      expect(result.isFree).toBe(true)
      expect(result.source).toBe('model_config')
    })

    it('不乘中转站倍率:即使 ai_model_config_models.relayPriceMultiplier=2.0,BYOK 成本仍只按上游原价', async () => {
      // calculateByokCost 的 select 不查 relayPriceMultiplier 字段,所以倍率不参与计算
      mockDbReadSelect
        .mockReturnValueOnce(chain([{ inputPricePer1k: 10, outputPricePer1k: 10 }]))
        .mockReturnValueOnce(chain([]))

      const result = await calculateByokCost('deepseek-chat', 1000, 1000, 0.2)
      // upstream = 10*1000/1000 + 10*1000/1000 = 20 分(若误乘倍率会变 40)
      expect(result.upstreamCostCents).toBe(20)
      expect(result.platformFeeCents).toBe(4) // round(20 × 0.2)
    })

    it('定价表无记录 + model_config 无记录 → 默认 0 成本,platformFee=0', async () => {
      mockDbReadSelect.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([]))

      const result = await calculateByokCost('unknown-model', 500, 500, 0.15)
      expect(result.upstreamCostCents).toBe(0)
      expect(result.platformFeeCents).toBe(0)
      expect(result.source).toBe('default')
    })
  })

  // ===========================================================================
  // 3. isByokCall — 用户私有配置存在性判断
  // ===========================================================================
  describe('isByokCall', () => {
    it('用户有私有 ai_model_config → true', async () => {
      mockDbReadSelect.mockReturnValueOnce(chain([{ id: 'cfg-1' }]))

      const result = await isByokCall('user-1', 'gpt-4o')
      expect(result).toBe(true)
    })

    it('用户无私有配置 → false', async () => {
      mockDbReadSelect.mockReturnValueOnce(chain([]))

      const result = await isByokCall('user-2', 'gpt-4o')
      expect(result).toBe(false)
    })

    it('deepseek- 前缀映射到 provider_code=deepseek', async () => {
      // 验证 _modelToProviderCode 的前缀映射(通过 isByokCall 间接覆盖)
      mockDbReadSelect.mockReturnValueOnce(chain([{ id: 'cfg-deepseek' }]))

      const result = await isByokCall('user-1', 'deepseek-chat')
      expect(result).toBe(true)
    })
  })

  // ===========================================================================
  // 4. getByokCommissionRate — 全局抽成率(默认 0.1,容错)
  // ===========================================================================
  describe('getByokCommissionRate', () => {
    it('有全局配置 → 返回配置值', async () => {
      // select alias: { rate: aiModelConfig.byokCommissionRate } → 字段名 rate
      mockDbReadSelect.mockReturnValueOnce(chain([{ rate: '0.15' }]))

      const rate = await getByokCommissionRate('openai')
      expect(rate).toBe(0.15)
    })

    it('无全局配置 → 默认 0.1', async () => {
      mockDbReadSelect.mockReturnValueOnce(chain([]))

      const rate = await getByokCommissionRate('openai')
      expect(rate).toBe(0.1)
    })

    it('配置值为无效字符串 → 默认 0.1', async () => {
      mockDbReadSelect.mockReturnValueOnce(chain([{ rate: 'not-a-number' }]))

      const rate = await getByokCommissionRate('openai')
      expect(rate).toBe(0.1)
    })

    it('配置值为负数 → 默认 0.1', async () => {
      mockDbReadSelect.mockReturnValueOnce(chain([{ rate: '-0.5' }]))

      const rate = await getByokCommissionRate('openai')
      expect(rate).toBe(0.1)
    })
  })

  // ===========================================================================
  // 5. recordCall mode='byok' — 只扣 platformFeeCents,不扣 upstreamCostCents
  // ===========================================================================
  describe("recordCall mode='byok'", () => {
    it('付费 provider:扣减 platformFeeCents,metadata.byokMode=true,upstream/platformFee 透传', async () => {
      // calculateByokCost 内部两次 select(传了 commissionRate,跳过 getByokCommissionRate)
      mockDbReadSelect
        .mockReturnValueOnce(chain([{ inputPricePer1k: 10, outputPricePer1k: 10 }]))
        .mockReturnValueOnce(chain([]))
      // recordCall 读 apiKeyRow 余额(第 3 次 select),select alias: tokenBalance / costBalanceCents
      mockDbReadSelect.mockReturnValueOnce(chain([{ tokenBalance: 1000, costBalanceCents: 500 }]))
      // llm_call_logs insert
      const returningFn = vi.fn().mockResolvedValue([{ id: 'log-1' }])
      const valuesFn = vi.fn().mockReturnValue({ returning: returningFn })
      mockDbInsert.mockReturnValue({ values: valuesFn })
      // developerApiKeys update
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })

      const result = await recordCall({
        apiKeyId: 'key-1',
        userId: 'user-1',
        model: 'deepseek-chat',
        prompt: 'hello',
        response: 'world',
        promptTokens: 100,
        completionTokens: 100,
        totalTokens: 200,
        latencyMs: 50,
        status: 'success',
        mode: 'byok',
        commissionRate: 0.1,
      })

      // upstream = 10*100/1000 + 10*100/1000 = 2 分,platformFee = round(2 × 0.1) = 0 分
      expect(result.upstreamCostCents).toBe(2)
      expect(result.platformFeeCents).toBe(0)
      expect(result.costCents).toBe(0) // 只扣 platformFee,不扣 upstream
      expect(result.newTokenBalance).toBe(800) // 1000 - 200
      expect(result.newCostBalanceCents).toBe(500) // 500 - 0
      expect(result.logId).toBe('log-1')

      // 验证 insert 时 metadata 含 byokMode=true + upstreamCostCents + platformFeeCents
      const insertedValues = valuesFn.mock.calls[0]?.[0] as Record<string, unknown> | undefined
      expect(insertedValues).toBeDefined()
      const meta = insertedValues!.metadata as Record<string, unknown>
      expect(meta.byokMode).toBe(true)
      expect(meta.upstreamCostCents).toBe(2)
      expect(meta.platformFeeCents).toBe(0)
      expect(meta.commissionRate).toBe(0.1)
    })

    it('免费 provider:platformFeeCents=0,costCents=0,余额不扣成本', async () => {
      mockDbReadSelect
        .mockReturnValueOnce(chain([{ inputPricePer1k: 5, outputPricePer1k: 5 }]))
        .mockReturnValueOnce(chain([]))
      mockDbReadSelect.mockReturnValueOnce(chain([{ tokenBalance: 1000, costBalanceCents: 500 }]))
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'log-2' }]),
        }),
      })
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })

      const result = await recordCall({
        apiKeyId: 'key-1',
        userId: 'user-1',
        model: 'cloudflare/llama-3.1-8b',
        prompt: 'hi',
        response: 'hello',
        promptTokens: 1000,
        completionTokens: 1000,
        totalTokens: 2000,
        latencyMs: 100,
        status: 'success',
        mode: 'byok',
        commissionRate: 0.1,
      })

      // upstream = 5*1000/1000 + 5*1000/1000 = 10 分,platformFee = 0(免费 provider)
      expect(result.upstreamCostCents).toBe(10)
      expect(result.platformFeeCents).toBe(0)
      expect(result.costCents).toBe(0)
      expect(result.newCostBalanceCents).toBe(500) // 不扣
    })

    it('无限额度(-1):余额保持 -1,累计统计仍累加', async () => {
      mockDbReadSelect
        .mockReturnValueOnce(chain([{ inputPricePer1k: 10, outputPricePer1k: 10 }]))
        .mockReturnValueOnce(chain([]))
      mockDbReadSelect.mockReturnValueOnce(chain([{ tokenBalance: -1, costBalanceCents: -1 }]))
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'log-3' }]),
        }),
      })
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      })
      mockDbUpdate.mockReturnValue({ set: setMock })

      const result = await recordCall({
        apiKeyId: 'key-admin',
        userId: 'admin-1',
        model: 'gpt-4o',
        prompt: 'admin task',
        response: 'ok',
        promptTokens: 100,
        completionTokens: 100,
        totalTokens: 200,
        latencyMs: 30,
        status: 'success',
        mode: 'byok',
        commissionRate: 0.2,
      })

      expect(result.newTokenBalance).toBe(-1)
      expect(result.newCostBalanceCents).toBe(-1)
      // set clause 不含 tokenBalance/costBalanceCents(因为 -1 不修改),但含 tokenUsedTotal/costUsedTotalCents 累加
      const setArg = setMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined
      expect(setArg).toBeDefined()
      expect(setArg!.tokenBalance).toBeUndefined()
      expect(setArg!.costBalanceCents).toBeUndefined()
      expect(setArg!.tokenUsedTotal).toBeDefined()
      expect(setArg!.costUsedTotalCents).toBeDefined()
    })
  })
})
