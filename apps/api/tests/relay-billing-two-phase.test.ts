// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
    const p = Promise.resolve([]) as unknown as Promise<unknown[]> & { returning: unknown }
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
// 2026-09-16:calculateCost/settlePreDeduction 接入分时倍率与订阅窗口后,
// 两者会在热路径上额外发起 dbRead 查询。本套件用 mockReturnValueOnce 精确编排
// select 序列,必须把这两个新依赖整体 mock 掉,避免消耗编排好的 mock 序列
// (分时倍率按 1 处理、窗口校验按放行处理,与本套件"聚焦两段式"的范围一致)。
vi.mock('../src/services/peak-pricing-service.js', () => ({
  resolvePeakMultiplier: vi.fn().mockResolvedValue({ multiplier: 1, ruleId: null, ruleName: null }),
}))
vi.mock('../src/services/subscription-window-service.js', () => ({
  checkSubscriptionWindowQuota: vi.fn().mockResolvedValue({ allowed: true }),
  consumeSubscriptionWindowUsage: vi.fn().mockResolvedValue(false),
}))
// 2026-09-16 深度补强:recordCall 成功路径新增 Key 窗口计数与余额邮件通知,
// 两者都会额外发起 dbRead 查询,同样必须整体 mock 掉以保护 Once 序列。
vi.mock('../src/services/key-rate-window-service.js', () => ({
  checkKeyRateWindows: vi.fn().mockResolvedValue({ allowed: true }),
  incrKeyRateWindows: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/mail-relay-notifier.js', () => ({
  checkAndNotifyLowBalance: vi.fn().mockResolvedValue(false),
  sendLowBalanceMail: vi.fn().mockResolvedValue(false),
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
import { incrKeyRateWindows } from '../src/services/key-rate-window-service.js'
import { consumeSubscriptionWindowUsage } from '../src/services/subscription-window-service.js'

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

    it('缓存命中(cacheHit):token 配额按 0 计、请求次数照计,节省量另列不得与真实调用混算', async () => {
      mockDbReadSelect.mockReturnValue(chain([{ tokenBalance: 10000, costBalanceCents: 5000 }]))
      const valuesFn = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'log-tp-2' }]),
      })
      mockDbInsert.mockReturnValue({ values: valuesFn })
      flexibleUpdate()

      const result = await recordCall({
        apiKeyId: 'key-1',
        userId: 'user-1',
        model: 'gpt-test',
        prompt: 'hello',
        response: 'cached',
        // 缓存里保留的是真实上游 usage:这笔是"被省下的量",不是本次实际消耗
        promptTokens: 480,
        completionTokens: 322,
        totalTokens: 802,
        latencyMs: 5,
        status: 'success',
        mode: 'relay',
        metadata: { cacheHit: true },
        preDeducted: { apiKeyId: 'key-1', userId: 'user-1', tokens: 500, cents: 50 },
      })

      const row = valuesFn.mock.calls[0]![0] as Record<string, unknown>
      // 命中不计 token:台账 token 列全 0,与真实上游调用区分开
      expect([row.promptTokens, row.completionTokens, row.totalTokens]).toEqual([0, 0, 0])
      expect(row.costCents).toBe(0)
      expect(row.metadata).toMatchObject({
        cacheHit: true,
        cacheSavedTokens: 802,
        quotaBilledTokens: 0,
        requestCounted: true,
      })
      // 订阅窗口按 0/0 消费:命中不占 token 配额
      expect(vi.mocked(consumeSubscriptionWindowUsage)).toHaveBeenCalledWith('user-1', 0, 0)
      // 请求次数照计:防滥用
      expect(vi.mocked(incrKeyRateWindows)).toHaveBeenCalledTimes(1)
      expect(result.costCents).toBe(0)
      expect(result.newTokenBalance).toBe(10000)
      expect(result.newCostBalanceCents).toBe(5000)
    })

    it('缓存命中且无预扣:请求次数仍计 1 次、token 列仍为 0', async () => {
      mockDbReadSelect.mockReturnValue(chain([]))
      const valuesFn = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'log-tp-3' }]),
      })
      mockDbInsert.mockReturnValue({ values: valuesFn })
      flexibleUpdate([{ tokenBalance: 10000, costBalanceCents: 5000 }])

      await recordCall({
        apiKeyId: 'key-1',
        userId: 'user-1',
        model: 'gpt-test',
        prompt: 'hello',
        response: 'cached',
        promptTokens: 180,
        completionTokens: 120,
        totalTokens: 300,
        latencyMs: 5,
        status: 'success',
        mode: 'relay',
        metadata: { cacheHit: true },
      })

      expect(vi.mocked(incrKeyRateWindows)).toHaveBeenCalledTimes(1)
      const row = valuesFn.mock.calls[0]![0] as Record<string, unknown>
      expect([row.promptTokens, row.completionTokens, row.totalTokens]).toEqual([0, 0, 0])
      expect(row.metadata).toMatchObject({ cacheSavedTokens: 300, requestCounted: true })
    })

    it('partial(流中断但已产出 token):按实际 token 计费,不再全额免单', async () => {
      // ①calculateCost modelRow ②pricingRow ③结算后余额读取
      mockDbReadSelect
        .mockReturnValueOnce(chain([{ inputPricePer1k: 10, outputPricePer1k: 30 }]))
        .mockReturnValueOnce(chain([]))
        .mockReturnValueOnce(chain([{ tokenBalance: 9500, costBalanceCents: 4996 }]))
      const valuesFn = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'log-tp-partial' }]),
      })
      mockDbInsert.mockReturnValue({ values: valuesFn })
      flexibleUpdate()

      const result = await recordCall({
        apiKeyId: 'key-1',
        userId: 'user-1',
        model: 'gpt-test',
        prompt: 'hello',
        response: 'half',
        promptTokens: 100,
        completionTokens: 100,
        totalTokens: 200,
        latencyMs: 5,
        status: 'partial',
        errorMessage: 'client disconnected',
        mode: 'relay',
        preDeducted: { apiKeyId: 'key-1', userId: 'user-1', tokens: 500, cents: 50 },
      })

      expect(result.costCents).toBe(4)
      const row = valuesFn.mock.calls[0]![0] as Record<string, unknown>
      expect(row.status).toBe('partial')
      expect(row.metadata).not.toHaveProperty('noChargeReason')
    })

    it('error(零产出/上游失败):全额免单并写明 noChargeReason', async () => {
      mockDbReadSelect
        .mockReturnValueOnce(chain([{ inputPricePer1k: 10, outputPricePer1k: 30 }]))
        .mockReturnValueOnce(chain([]))
      const valuesFn = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'log-tp-error' }]),
      })
      mockDbInsert.mockReturnValue({ values: valuesFn })
      flexibleUpdate([{ tokenBalance: 10000, costBalanceCents: 5000 }])

      const result = await recordCall({
        apiKeyId: 'key-1',
        userId: 'user-1',
        model: 'gpt-test',
        prompt: 'hello',
        response: '',
        promptTokens: 100,
        completionTokens: 100,
        totalTokens: 200,
        latencyMs: 5,
        status: 'error',
        errorMessage: 'upstream 500',
        mode: 'relay',
      })

      expect(result.costCents).toBe(0)
      const row = valuesFn.mock.calls[0]![0] as Record<string, unknown>
      expect(row.metadata).toMatchObject({ noChargeReason: 'status=error' })
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
