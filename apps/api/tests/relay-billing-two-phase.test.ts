// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 两段式计费单测(2026-09-12 立):preDeductQuota 预扣 + settlePreDeduction 结算。
 *
 * 覆盖点:
 * - preDeductQuota:无限额度返回 null / 余额充足按预估扣 / 余额不足封顶余额
 * - settlePreDeduction:多退(delta>0)/ 少补(delta<0)/ 恰好相等不动账
 * - recordCall + preDeducted:跳过全额扣减,只累计统计 + 结算,返回结算后余额
 *
 * 测试模式:vi.mock 掉 db / @ihui/database(对齐 relay-billing-service.test.ts)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

function chain(limitReturn: unknown[]) {
  const limit = vi.fn().mockResolvedValue(limitReturn)
  const orderBy = vi.fn().mockReturnValue({ limit })
  const where = vi.fn().mockReturnValue({ limit, orderBy })
  const from = vi.fn().mockReturnValue({ where })
  return { from }
}

/** update 链式 mock:where() 返回既可 await(settle 路径)又带 .returning()(扣减路径)的 Promise */
function flexibleUpdate(returningRows: unknown[] = []) {
  const whereFn = vi.fn().mockImplementation(() => {
    const p = Promise.resolve([]) as Promise<unknown[]> & { returning: unknown }
    p.returning = vi.fn().mockResolvedValue(returningRows)
    return p
  })
  const setFn = vi.fn().mockReturnValue({ where: whereFn })
  mockDbUpdate.mockReturnValue({ set: setFn })
  return { setFn, whereFn }
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
  aiModelConfig: { id: 'id' },
  apiKeyGroups: {
    id: 'id',
    sharedTokenBalance: 'shared_token_balance',
    sharedCostBalanceCents: 'shared_cost_balance_cents',
    updatedAt: 'updated_at',
  },
  tokenFlows: { userId: 'user_id' },
  userMargins: { userId: 'user_id' },
}))

vi.mock('../src/services/api-key-group-service.js', () => ({
  getKeyGroup: vi.fn().mockResolvedValue(null),
}))
vi.mock('../src/services/relay-commission-service.js', () => ({
  recordRelayCommission: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/webhook-relay-notifier.js', () => ({
  notifyRelayEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/tiered-pricing-service.js', () => ({
  getCurrentTierMultiplier: vi.fn().mockResolvedValue({ multiplier: 1 }),
}))
vi.mock('../src/services/user-billing-group-service.js', () => ({
  getUserModelMultiplier: vi.fn().mockResolvedValue(1),
}))

import {
  preDeductQuota,
  settlePreDeduction,
  recordCall,
  type PreDeduction,
} from '../src/services/relay-billing-service.js'

describe('relay-billing-service — 两段式计费(2026-09-12 立)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================================================
  // 1. preDeductQuota — 调用前预扣
  // ===========================================================================
  describe('preDeductQuota', () => {
    it('余额充足:按预估扣(est 500 token + 7 分),返回实际预扣额', async () => {
      // ①key 行 ②calculateCost modelRow ③pricingRow
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([
            {
              id: 'key-1',
              userId: 'user-1',
              status: 'active',
              tokenBalance: 10000,
              costBalanceCents: 5000,
            },
          ]),
        )
        .mockReturnValueOnce(chain([])) // modelRow 空
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }])) // pricingRow
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ tokenBalance: 9500, costBalanceCents: 4993 }]),
          }),
        }),
      })

      const result = await preDeductQuota({
        apiKeyId: 'key-1',
        model: 'gpt-test',
        userId: 'user-1',
        estimatedPromptTokens: 400,
        estimatedCompletionTokens: 100,
      })

      // estTokens = 400+100 = 500;estCents = 10*400/1000 + 30*100/1000 = 7
      expect(result).not.toBeNull()
      expect(result!.tokens).toBe(500)
      expect(result!.cents).toBe(7)
      expect(result!.apiKeyId).toBe('key-1')
    })

    it('余额不足:预扣封顶当前余额', async () => {
      mockDbReadSelect
        .mockReturnValueOnce(
          chain([
            {
              id: 'key-2',
              userId: 'user-1',
              status: 'active',
              tokenBalance: 200,
              costBalanceCents: 50,
            },
          ]),
        )
        .mockReturnValueOnce(chain([]))
        .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ tokenBalance: 0, costBalanceCents: 43 }]),
          }),
        }),
      })

      const result = await preDeductQuota({
        apiKeyId: 'key-2',
        model: 'gpt-test',
        estimatedPromptTokens: 400,
        estimatedCompletionTokens: 100,
      })

      // 预扣 = min(500, 200) = 200 token;分仍按预估 7(50 > 7)
      expect(result).not.toBeNull()
      expect(result!.tokens).toBe(200)
      expect(result!.cents).toBe(7)
    })

    it('无限额度(-1/-1)→ 返回 null,不写库', async () => {
      mockDbReadSelect.mockReturnValueOnce(
        chain([
          {
            id: 'key-3',
            userId: 'user-1',
            status: 'active',
            tokenBalance: -1,
            costBalanceCents: -1,
          },
        ]),
      )

      const result = await preDeductQuota({
        apiKeyId: 'key-3',
        model: 'gpt-test',
        estimatedPromptTokens: 400,
        estimatedCompletionTokens: 100,
      })
      expect(result).toBeNull()
      expect(mockDbUpdate).not.toHaveBeenCalled()
    })

    it('Key 不存在 → null', async () => {
      mockDbReadSelect.mockReturnValueOnce(chain([]))
      const result = await preDeductQuota({
        apiKeyId: 'missing',
        model: 'gpt-test',
        estimatedPromptTokens: 100,
        estimatedCompletionTokens: 100,
      })
      expect(result).toBeNull()
    })
  })

  // ===========================================================================
  // 2. settlePreDeduction — 调用后结算(多退少补)
  // ===========================================================================
  describe('settlePreDeduction', () => {
    it('预扣 > 实际 → 退款(delta > 0),update 被调用', async () => {
      const { setFn } = flexibleUpdate()
      const pre: PreDeduction = { apiKeyId: 'key-1', userId: 'user-1', tokens: 500, cents: 7 }

      await settlePreDeduction(pre, 200, 2)

      expect(mockDbUpdate).toHaveBeenCalledTimes(1)
      expect(setFn).toHaveBeenCalledTimes(1)
    })

    it('预扣 < 实际 → 补扣(delta < 0)', async () => {
      const { setFn } = flexibleUpdate()
      const pre: PreDeduction = { apiKeyId: 'key-1', userId: 'user-1', tokens: 200, cents: 2 }

      await settlePreDeduction(pre, 500, 9)
      expect(mockDbUpdate).toHaveBeenCalledTimes(1)
      expect(setFn).toHaveBeenCalledTimes(1)
    })

    it('预扣 = 实际 → 不动账(delta = 0 不发起 update)', async () => {
      flexibleUpdate()
      const pre: PreDeduction = { apiKeyId: 'key-1', userId: 'user-1', tokens: 500, cents: 7 }

      await settlePreDeduction(pre, 500, 7)
      expect(mockDbUpdate).not.toHaveBeenCalled()
    })

    it('结算 db 异常 → 吞错不抛(计费调整失败不影响主链路)', async () => {
      mockDbUpdate.mockImplementation(() => {
        throw new Error('db down')
      })
      const pre: PreDeduction = { apiKeyId: 'key-1', userId: 'user-1', tokens: 500, cents: 7 }
      await expect(settlePreDeduction(pre, 100, 1)).resolves.toBeUndefined()
    })
  })

  // ===========================================================================
  // 3. recordCall + preDeducted — 结算集成
  // ===========================================================================
  describe('recordCall with preDeducted', () => {
    it('relay 模式:跳过全额扣减,只累计统计 + 结算,返回结算后余额', async () => {
      // ①calculateCost modelRow ②pricingRow ③结算后余额读取
      mockDbReadSelect
        .mockReturnValueOnce(chain([{ inputPricePer1k: 10, outputPricePer1k: 30 }]))
        .mockReturnValueOnce(chain([]))
        .mockReturnValueOnce(chain([{ tokenBalance: 9500, costBalanceCents: 4996 }]))
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'log-tp-1' }]),
        }),
      })
      // stats update + settle update(两次,均无 returning)
      const { setFn } = flexibleUpdate()

      const result = await recordCall({
        apiKeyId: 'key-1',
        userId: 'user-1',
        model: 'gpt-test',
        prompt: 'hello',
        response: 'world',
        promptTokens: 100,
        completionTokens: 100,
        totalTokens: 200,
        latencyMs: 50,
        status: 'success',
        mode: 'relay',
        preDeducted: { apiKeyId: 'key-1', userId: 'user-1', tokens: 500, cents: 50 },
      })

      // cost = 10*100/1000 + 30*100/1000 = 4 分;实际用量 200 token
      expect(result.costCents).toBe(4)
      expect(result.logId).toBe('log-tp-1')
      // 返回结算后余额(读自 db)
      expect(result.newTokenBalance).toBe(9500)
      expect(result.newCostBalanceCents).toBe(4996)
      // 两次 update:①统计累加 ②settle 结算(无全额扣减)
      expect(mockDbUpdate).toHaveBeenCalledTimes(2)
      expect(setFn).toHaveBeenCalledTimes(2)
    })

    it('缓存命中(cacheHit):成本 0,预扣全额退回(delta 全为正)', async () => {
      mockDbReadSelect
        .mockReturnValueOnce(chain([]))
        .mockReturnValueOnce(chain([]))
        .mockReturnValueOnce(chain([{ tokenBalance: 10000, costBalanceCents: 5000 }]))
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'log-tp-2' }]),
        }),
      })
      flexibleUpdate()

      const result = await recordCall({
        apiKeyId: 'key-1',
        userId: 'user-1',
        model: 'gpt-test',
        prompt: 'hello',
        response: 'cached',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: 5,
        status: 'success',
        mode: 'relay',
        metadata: { cacheHit: true },
        preDeducted: { apiKeyId: 'key-1', userId: 'user-1', tokens: 500, cents: 50 },
      })

      expect(result.costCents).toBe(0)
      expect(result.newTokenBalance).toBe(10000)
      expect(result.newCostBalanceCents).toBe(5000)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
