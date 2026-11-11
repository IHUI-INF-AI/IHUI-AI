// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-35 回归锁(2026-11-11)。
 *
 * 病灶:两段式计费的 settlePreDeduction 在补差价/退差额写库失败时只 logger.error,
 * 调用方继续返回成功 ⇒ 预扣额与实扣额永久不一致且不会自愈。
 *
 * 判据:
 * - 单次失败必须重试,重试成功即视为结算完成(attempts=2);
 * - 有界重试(首次 + 2 次)全部失败必须返回 { ok:false, reason },不得静默;
 * - 成功路径的金额表达式与 UPDATE 次数不变(不因重试引入额外写库);
 * - recordCall 在结算失败时返回 billingSettlement 失败结果,并把待对账信息
 *   写进该次 llm_call_logs 行的 metadata(既有 jsonb 列,无新表/无迁移)。
 *
 * 测试模式:vi.mock 掉 db / @ihui/database(对齐 relay-billing-two-phase.test.ts)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

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
  llmCallLogs: { id: 'id', metadata: 'metadata' },
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
vi.mock('../src/services/peak-pricing-service.js', () => ({
  resolvePeakMultiplier: vi.fn().mockResolvedValue({ multiplier: 1, ruleId: null, ruleName: null }),
}))
vi.mock('../src/services/subscription-window-service.js', () => ({
  checkSubscriptionWindowQuota: vi.fn().mockResolvedValue({ allowed: true }),
  consumeSubscriptionWindowUsage: vi.fn().mockResolvedValue(false),
}))
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
  settlePreDeductionStrict,
  settlePreDeduction,
  recordCall,
  type PreDeduction,
} from '../src/services/relay-billing-service.js'
import { consumeSubscriptionWindowUsage } from '../src/services/subscription-window-service.js'

/** 结算 UPDATE 链:where() 可按调用序号决定成功/失败 */
function settleUpdateWhere(outcome: (call: number) => Promise<unknown>) {
  let call = 0
  mockDbUpdate.mockImplementation(() => {
    call += 1
    const seq = call
    return { set: vi.fn().mockReturnValue({ where: vi.fn(() => outcome(seq)) }) }
  })
  return () => call
}

describe('F-35 两段式结算失败不再静默', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('首次失败 → 重试一次成功:ok=true、attempts=2,金额表达式仍只写一次库', async () => {
    const whereCalls = settleUpdateWhere((call) =>
      call === 1 ? Promise.reject(new Error('db blip')) : Promise.resolve([]),
    )
    const pre: PreDeduction = { apiKeyId: 'key-1', userId: 'user-1', tokens: 500, cents: 7 }

    const result = await settlePreDeductionStrict(pre, 200, 2)

    expect(result).toEqual({ ok: true, attempts: 2 })
    expect(whereCalls()).toBe(2)
    // 窗口用量只累加一次,不随重试放大
    expect(vi.mocked(consumeSubscriptionWindowUsage)).toHaveBeenCalledTimes(1)
  })

  it('连续失败 → 有界重试(共 3 次)后返回 ok:false + reason,不再吞错', async () => {
    const whereCalls = settleUpdateWhere(() => Promise.reject(new Error('db down')))
    const pre: PreDeduction = { apiKeyId: 'key-1', userId: 'user-1', tokens: 500, cents: 7 }

    const result = await settlePreDeductionStrict(pre, 100, 1)

    expect(result.ok).toBe(false)
    expect(result.attempts).toBe(3)
    expect(result.reason).toBe('db down')
    expect(whereCalls()).toBe(3)
  })

  it('成功路径不变:多退(delta>0)只发一次 UPDATE,且不写 metadata', async () => {
    const setPayloads: Record<string, unknown>[] = []
    mockDbUpdate.mockImplementation(() => {
      const set = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        setPayloads.push(payload)
        return { where: vi.fn().mockResolvedValue([]) }
      })
      return { set }
    })
    const pre: PreDeduction = { apiKeyId: 'key-1', userId: 'user-1', tokens: 500, cents: 7 }

    const result = await settlePreDeductionStrict(pre, 200, 2)

    expect(result).toEqual({ ok: true, attempts: 1 })
    expect(setPayloads).toHaveLength(1)
    expect(Object.keys(setPayloads[0]!)).toEqual([
      'tokenBalance',
      'costBalanceCents',
      'updatedAt',
    ])
  })

  it('预扣=实际(delta=0):不动账、attempts=0', async () => {
    const pre: PreDeduction = { apiKeyId: 'key-1', userId: 'user-1', tokens: 500, cents: 7 }

    const result = await settlePreDeductionStrict(pre, 500, 7)

    expect(result).toEqual({ ok: true, attempts: 0 })
    expect(mockDbUpdate).not.toHaveBeenCalled()
  })

  it('兼容出口 settlePreDeduction 仍保持「失败不抛错」契约(仅日志)', async () => {
    settleUpdateWhere(() => Promise.reject(new Error('db down')))
    const pre: PreDeduction = { apiKeyId: 'key-1', userId: 'user-1', tokens: 500, cents: 7 }

    await expect(settlePreDeduction(pre, 100, 1)).resolves.toBeUndefined()
  })

  it('recordCall:结算连续失败 → 返回值带 billingSettlement 失败结果 + 写入待对账 metadata', async () => {
    // calculateCost 两次读:model 配置行 + 定价行;结算后余额读一次
    mockDbReadSelect
      .mockReturnValueOnce(chain([{ inputPricePer1k: 10, outputPricePer1k: 30 }]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([{ tokenBalance: 9496, costBalanceCents: 4996 }]))
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'log-f35-1' }]),
      }),
    })

    const setPayloads: Record<string, unknown>[] = []
    let settleAttempts = 0
    mockDbUpdate.mockImplementation(() => {
      const set = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        setPayloads.push(payload)
        const isSettle = 'tokenBalance' in payload
        if (isSettle) settleAttempts += 1
        return {
          where: vi.fn(() =>
            isSettle ? Promise.reject(new Error('settle db down')) : Promise.resolve([]),
          ),
        }
      })
      return { set }
    })

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

    expect(result.logId).toBe('log-f35-1')
    // 成功路径金额口径不变:10*100/1000 + 30*100/1000 = 4 分
    expect(result.costCents).toBe(4)
    expect(result.billingSettlement).toEqual({ ok: false, attempts: 3, reason: 'settle db down' })
    // 3 次结算尝试后,第 4 次 UPDATE 是待对账 metadata 标记
    expect(settleAttempts).toBe(3)
    const marker = setPayloads.find((p) => 'metadata' in p)
    expect(marker).toBeDefined()
  })
})
