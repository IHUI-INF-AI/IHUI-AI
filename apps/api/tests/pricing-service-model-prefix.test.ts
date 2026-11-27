// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 定价模型名前缀归一钉子(2026-11-27 立)。
 *
 * 上游与回调常把模型写成 `provider/model`，而 ai_pricing 只存裸模型名。
 * 精确匹配失败会把内部标题/推荐问题等调用静默记成 unknown/0 成本；本文件钉住
 * `findActivePricing` / `findActivePricingForMode` 的“原样优先、裸名兜底”。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }))

vi.mock('../src/db/index.js', () => ({
  db: { select: mockSelect },
  dbRead: { select: mockSelect },
  dbClient: {},
  registerPoolTrackerCleanup: vi.fn(),
}))

vi.mock('@ihui/database', () => {
  const column = (name: string) => ({ name, toString: () => name })
  return {
    aiPricing: {
      modelId: column('model_id'),
      inputTokenPrice: column('input_token_price'),
      outputTokenPrice: column('output_token_price'),
      billingMode: column('billing_mode'),
      perUnitPrice: column('per_unit_price'),
      costUnitPrice: column('cost_unit_price'),
      tieredCallPrices: column('tiered_call_prices'),
      videoUnit: column('video_unit'),
      longContextMultiplier: column('long_context_multiplier'),
      longContextThresholdTokens: column('long_context_threshold_tokens'),
      reasoningOutputMultiplier: column('reasoning_output_multiplier'),
      regionPricing: column('region_pricing'),
      discount: column('discount'),
      currency: column('currency'),
      effectiveAt: column('effective_at'),
      expiresAt: column('expires_at'),
    },
  }
})

function chain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows)
  const orderBy = vi.fn().mockReturnValue({ limit })
  const where = vi.fn().mockReturnValue({ limit, orderBy })
  const from = vi.fn().mockReturnValue({ where })
  return { from }
}

import { findActivePricing, findActivePricingForMode } from '../src/services/pricing-service.js'

const row = {
  modelId: 'agnes-3.0-flash',
  inputTokenPrice: '0.108',
  outputTokenPrice: '0.324',
  billingMode: 'token',
  perUnitPrice: null,
  costUnitPrice: null,
  tieredCallPrices: null,
  videoUnit: null,
  regionPricing: { cn: 1 },
  discount: null,
  currency: 'CNY',
  effectiveAt: new Date('2026-11-14T11:17:13.885Z'),
  expiresAt: null,
}

describe('定价模型名前缀归一', () => {
  beforeEach(() => vi.clearAllMocks())

  it('findActivePricing: provider/model 精确查不到时回退裸模型名', async () => {
    mockSelect.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([row]))
    await expect(findActivePricing('agnes/agnes-3.0-flash')).resolves.toBe(row)
  })

  it('findActivePricingForMode: provider/model 同样能命中 token 定价', async () => {
    mockSelect.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([row]))
    await expect(findActivePricingForMode('agnes/agnes-3.0-flash', 'token')).resolves.toBe(row)
  })

  it('裸模型名命中时只查一次,不额外扫前缀候选', async () => {
    mockSelect.mockReturnValueOnce(chain([row]))
    await expect(findActivePricing('agnes-3.0-flash')).resolves.toBe(row)
    expect(mockSelect).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
