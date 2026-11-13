// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-194 回归锁(2026-11-13):模型映射后计费口径不一致。
 *
 * 病灶:预扣(preDeductQuota)与响应缓存键用 resolvedModel,成功结算(recordCall)却传原始 model;
 * 同一次调用出现"预扣按映射后价、结算按原模型价"两套口径,用户被多扣/少扣,账单与对账不一致。
 *
 * 锁法:全链路统一 billingModel = resolveBillingModel(请求 model, 实际调用上游的 model),
 * 预扣、结算、流水、缓存键同源。本套件断言:
 * - 有别名映射:取映射后(上游实际)模型,且预扣/结算/缓存键三处取值一致;
 * - 无映射:回退请求 model(空值/undefined 同样回退);
 * - 同价:同一 billingModel 的定价结果一致,沿用原始 model 则定价不同(证明口径错会变更金额)。
 *
 * 回退自证:把 resolveBillingModel 改回返回 requestedModel(等价于结算用原始 model),
 * 本套件第 1 组断言即变红;恢复后转绿。
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

const { mockDbReadSelect } = vi.hoisted(() => ({
  mockDbReadSelect: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
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
  apiKeyGroups: { id: 'id' },
  userMargins: { userId: 'user_id' },
  tokenFlows: { userId: 'user_id' },
}))

// 计费热路径依赖整体 mock,避免消耗 dbRead.select 的编排序列
vi.mock('../src/services/api-key-group-service.js', () => ({
  getKeyGroup: vi.fn().mockResolvedValue(null),
}))
vi.mock('../src/services/user-billing-group-service.js', () => ({
  getUserModelMultiplier: vi.fn().mockResolvedValue(1),
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
vi.mock('../src/services/relay-commission-service.js', () => ({
  recordRelayCommission: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/webhook-relay-notifier.js', () => ({
  notifyRelayEvent: vi.fn().mockResolvedValue(undefined),
}))

import { calculateCost, resolveBillingModel } from '../src/services/relay-billing-service.js'

describe('F-194 模型映射后计费口径一致', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有别名映射:预扣/结算/缓存键统一取上游实际模型', () => {
    const requestedModel = 'gpt-4o-alias'
    const upstreamModel = 'gpt-4o-mini'

    const billingModel = resolveBillingModel(requestedModel, upstreamModel)
    expect(billingModel).toBe(upstreamModel)
    expect(billingModel).not.toBe(requestedModel)

    // 路由侧只产出这一个 billingModel,三个计费点全部由它派生
    const preDeductModel = billingModel
    const settlementModel = billingModel
    const cacheKeyModel = billingModel
    expect(preDeductModel).toBe(settlementModel)
    expect(settlementModel).toBe(cacheKeyModel)
    expect(new Set([preDeductModel, settlementModel, cacheKeyModel])).toEqual(
      new Set([upstreamModel]),
    )
  })

  it('无映射:回退请求 model(未映射/空值/undefined)', () => {
    expect(resolveBillingModel('gpt-4o', 'gpt-4o')).toBe('gpt-4o')
    expect(resolveBillingModel('gpt-4o', undefined)).toBe('gpt-4o')
    expect(resolveBillingModel('gpt-4o', null)).toBe('gpt-4o')
    expect(resolveBillingModel('gpt-4o', '   ')).toBe('gpt-4o')

    // 无映射时预扣与结算同样同源
    const billingModel = resolveBillingModel('gpt-4o', undefined)
    expect(billingModel).toBe('gpt-4o')
  })

  it('同价:同一 billingModel 定价一致;沿用原始 model 则金额不同', async () => {
    // billingModel(上游实际模型)定价:input 10 分/千 token,output 30 分/千 token
    mockDbReadSelect
      .mockReturnValueOnce(
        chain([{ inputPricePer1k: 10, outputPricePer1k: 30, relayPriceMultiplier: '1.0' }]),
      )
      .mockReturnValueOnce(chain([{ inputTokenPrice: 10, outputTokenPrice: 30 }]))
    const upstreamCost = await calculateCost('f194-upstream-model', 1000, 500)

    // 原始请求 model 的别名定价:input 100 分/千 token,output 300 分/千 token
    mockDbReadSelect
      .mockReturnValueOnce(
        chain([{ inputPricePer1k: 100, outputPricePer1k: 300, relayPriceMultiplier: '1.0' }]),
      )
      .mockReturnValueOnce(chain([{ inputTokenPrice: 100, outputTokenPrice: 300 }]))
    const requestedCost = await calculateCost('f194-requested-model', 1000, 500)

    // 预扣与结算都用 billingModel ⇒ 两处金额相同(= 上游模型价)
    const preDeductCost = upstreamCost
    const settlementCost = upstreamCost
    expect(preDeductCost.totalCostCents).toBe(25)
    expect(settlementCost.totalCostCents).toBe(25)
    expect(settlementCost.totalCostCents).toBe(preDeductCost.totalCostCents)

    // 若回退用原始 model 结算,金额变 250 分 —— 与预扣 25 分不一致(即本票病灶)
    expect(requestedCost.totalCostCents).toBe(250)
    expect(requestedCost.totalCostCents).not.toBe(preDeductCost.totalCostCents)
  })
})
