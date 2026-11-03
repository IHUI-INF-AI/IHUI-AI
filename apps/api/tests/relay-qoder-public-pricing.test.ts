// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-38 公开档位计费钉子(2026-10-30 立)。
 *
 * qoder/kmodel 与 qoder/qmodel_38max 进市场后必须**非免费**:价格唯一源是 ai_pricing
 * (分/千 token),倍率取模型行 relay_price_multiplier=1.2。
 * 本测试不连库:dbRead / @ihui/database 全替身,零真 SQL。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

function chain(limitReturn: unknown[]) {
  const limit = vi.fn().mockResolvedValue(limitReturn)
  const orderBy = vi.fn().mockReturnValue({ limit })
  const where = vi.fn().mockReturnValue({ limit, orderBy })
  const from = vi.fn().mockReturnValue({ where })
  return { from }
}

const { mockDbReadSelect } = vi.hoisted(() => ({ mockDbReadSelect: vi.fn() }))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  dbRead: { select: mockDbReadSelect },
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
    billingMode: 'billing_mode',
    perUnitPrice: 'per_unit_price',
    tieredCallPrices: 'tiered_call_prices',
    videoUnit: 'video_unit',
    longContextMultiplier: 'long_context_multiplier',
    longContextThresholdTokens: 'long_context_threshold_tokens',
    reasoningOutputMultiplier: 'reasoning_output_multiplier',
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
vi.mock('../src/services/peak-pricing-service.js', () => ({
  resolvePeakMultiplier: vi.fn().mockResolvedValue({ multiplier: 1 }),
  listPublicPeakWindows: vi.fn().mockResolvedValue([]),
}))
vi.mock('../src/services/relay-commission-service.js', () => ({
  recordRelayCommission: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/webhook-relay-notifier.js', () => ({
  notifyRelayEvent: vi.fn().mockResolvedValue(undefined),
}))

import { calculateCost } from '../src/services/relay-billing-service.js'

describe('RP-38 qoder 公开档位计费', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('qoder/kmodel:ai_pricing 0.065/0.270 × 倍率 1.2 ⇒ 1000+1000 tokens = 0.402 分', async () => {
    mockDbReadSelect
      .mockReturnValueOnce(
        chain([{ inputPricePer1k: 0.065, outputPricePer1k: 0.27, relayPriceMultiplier: '1.2000' }]),
      )
      .mockReturnValueOnce(chain([{ inputTokenPrice: 0.065, outputTokenPrice: 0.27 }]))
    const r = await calculateCost('qoder/kmodel', 1000, 1000)
    expect(r.source).toBe('ai_pricing')
    expect(r.multiplier).toBe(1.2)
    expect(r.totalCostCents).toBe(0.402)
  })

  it('qoder/qmodel_38max:ai_pricing 0.375/0.375 × 倍率 1.2 ⇒ 1000+1000 tokens = 0.9 分', async () => {
    mockDbReadSelect
      .mockReturnValueOnce(
        chain([
          { inputPricePer1k: 0.375, outputPricePer1k: 0.375, relayPriceMultiplier: '1.2000' },
        ]),
      )
      .mockReturnValueOnce(chain([{ inputTokenPrice: 0.375, outputTokenPrice: 0.375 }]))
    const r = await calculateCost('qoder/qmodel_38max', 1000, 1000)
    expect(r.source).toBe('ai_pricing')
    expect(r.totalCostCents).toBe(0.9)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
