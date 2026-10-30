// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agnes 视频定价钉子(2026-10-30 立,本票)。
 *
 * 为什么必须钉:ai_pricing 里此前**没有任何 per_video 行**(全仓 seed/迁移只有列定义)。
 * 无行 ⇒ calculateCost 回落 token 分支,而多模态调用的 prompt/completion tokens 恒 0
 * (v1-multimodal.ts 的 chargeMultimodal 写死 0)⇒ 总成本 0 分,「付费调用」是空转。
 * 本票的迁移落了第一手定价,这里把「按次不按秒」「倍率链生效」「打到错误 callType 不得误收」钉住。
 *
 * 不连库:dbRead / @ihui/database 全替身,零真 SQL(AGENTS §5 测试隔离铁律)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

const MIGRATION = resolve(
  __dirname,
  '../../../packages/database/drizzle/20261030193000_agnes_video_pricing.sql',
)

/** 喂一行 ai_pricing(per_video/per_image)与一行模型配置倍率,顺序同 queryPricingRows。 */
function feedRows(
  perUnitPrice: number,
  relayMultiplier: string,
  billingMode: 'per_video' | 'per_image' = 'per_video',
  videoUnit: string | null = 'call',
) {
  mockDbReadSelect
    .mockReturnValueOnce(
      chain([{ inputPricePer1k: 0, outputPricePer1k: 0, relayPriceMultiplier: relayMultiplier }]),
    )
    .mockReturnValueOnce(
      chain([
        {
          inputTokenPrice: 0,
          outputTokenPrice: 0,
          billingMode,
          perUnitPrice,
          tieredCallPrices: null,
          videoUnit,
        },
      ]),
    )
}

describe('Agnes 视频 per_video 计费', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('agnes-video-2.5-flash = 20 分/次(= 公示 ¥0.20/次)', async () => {
    feedRows(20, '1.0000')
    const r = await calculateCost('agnes-video-2.5-flash', 0, 0, { callType: 'video', units: 1 })
    expect(r.source).toBe('ai_pricing')
    expect(r.billingMode).toBe('per_video')
    expect(r.totalCostCents).toBe(20)
    expect(r.unitsApplied).toBe(1)
  })

  it('客户端传了 duration=8 也必须只按次收 20 分(video_unit=call 是定档,不是漏算)', async () => {
    feedRows(20, '1.0000')
    const r = await calculateCost('agnes-video-2.5-flash', 0, 0, { callType: 'video', units: 8 })
    expect(r.unitsApplied).toBe(1)
    expect(r.totalCostCents).toBe(20)
  })

  it('agnes-video-2.5(非 flash,上游要余额)= 60 分/次', async () => {
    feedRows(60, '1.0000')
    const r = await calculateCost('agnes-video-2.5', 0, 0, { callType: 'video', units: 1 })
    expect(r.totalCostCents).toBe(60)
  })

  it('agnes-image-2.5-flash = 20 分/张(= 公示 ¥0.20/张)', async () => {
    feedRows(20, '1.0000', 'per_image', null)
    const r = await calculateCost('agnes-image-2.5-flash', 0, 0, { callType: 'image', units: 1 })
    expect(r.source).toBe('ai_pricing')
    expect(r.billingMode).toBe('per_image')
    expect(r.totalCostCents).toBe(20)
    expect(r.unitsApplied).toBe(1)
  })

  it('按张计费按实际产出张数放大:出 3 张收 60 分(单位数=张数,不是固定 1)', async () => {
    feedRows(20, '1.0000', 'per_image', null)
    const r = await calculateCost('agnes-image-2.5-flash', 0, 0, { callType: 'image', units: 3 })
    expect(r.unitsApplied).toBe(3)
    expect(r.totalCostCents).toBe(60)
  })

  it('agnes-image-2.1-flash 同价 20 分/张(上游 429 只是 rpm 更紧,不是另一个价档)', async () => {
    feedRows(20, '1.0000', 'per_image', null)
    const r = await calculateCost('agnes-image-2.1-flash', 0, 0, { callType: 'image', units: 1 })
    expect(r.source).toBe('ai_pricing')
    expect(r.totalCostCents).toBe(20)
  })

  it('反向对照:图像档打到 callType=video 不得按图价误收', async () => {
    feedRows(20, '1.0000', 'per_image', null)
    const r = await calculateCost('agnes-image-2.5-flash', 0, 0, { callType: 'video', units: 1 })
    expect(r.totalCostCents).toBe(0)
    expect(r.billingMode).toBe('token')
  })

  it('倍率链对 per_video 生效:20 × 1.2 = 24 分', async () => {
    feedRows(20, '1.2000')
    const r = await calculateCost('agnes-video-2.5-flash', 0, 0, { callType: 'video', units: 1 })
    expect(r.multiplier).toBe(1.2)
    expect(r.totalCostCents).toBe(24)
  })

  it('反向对照:同一行打到 callType=image 不得按视频价误收', async () => {
    feedRows(20, '1.0000')
    const r = await calculateCost('agnes-video-2.5-flash', 0, 0, { callType: 'image', units: 1 })
    // 实测语义(非本票引入):callType 与 billing_mode 不匹配时 calculateCost 回退 token 分支,
    // 返回的 billingMode 一并记为 'token'(relay-billing-service.ts:699-701 注释即此口径)。
    // 这里钉的是「不会误按 20 分视频价扣」;至于回退后收 0 分(image 打视频模型 = 免费),
    // 属既有链路行为,不在本票射程,记入交付报告交后手裁。
    expect(r.totalCostCents).toBe(0)
    expect(r.billingMode).toBe('token')
  })

  it('带 LiteLLM 前缀的写法必须命中同一行(否则客户端一发 agnes/… 就白嫖)', async () => {
    feedRows(20, '1.0000')
    const r = await calculateCost('agnes/agnes-video-2.5-flash', 0, 0, {
      callType: 'video',
      units: 1,
    })
    expect(r.source).toBe('ai_pricing')
    expect(r.totalCostCents).toBe(20)
  })

  it('迁移正文形态对账:per_video / call / 20 / 60 与幂等判据都在,摘掉即红', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    expect(sql).toContain(`'per_video'`)
    expect(sql).toContain(`'call'`)
    expect(sql).toContain('agnes-video-2.5-flash')
    expect(sql).toContain('20.000000::numeric')
    expect(sql).toContain('60.000000::numeric')
    expect(sql).toMatch(/WHERE NOT EXISTS/)
    // 幂等判据的三要素(生效时间窗)缺一不可,否则重复执行会堆出多条生效行
    expect(sql).toContain('p.effective_at <= now()')
    expect(sql).toContain('p.expires_at IS NULL OR p.expires_at > now()')
  })

  it('迁移正文形态对账:图像两行(per_image/分每张)与上游两个模型名都在,摘掉即红', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    expect(sql).toContain(`'per_image'`)
    expect(sql).toContain('agnes-image-2.5-flash')
    expect(sql).toContain('agnes-image-2.1-flash')
    // 图像行不得带 video_unit ⇒ 按张计费的单位数=张数,不是秒
    expect(sql).toMatch(
      /'agnes-image-2\.5-flash',\s*'per_image',\s*20\.000000::numeric,\s*NULL::text/,
    )
  })

  it('上游四个媒体模型名与定价行逐字对齐(实测 GET /v1/models 返回的 id 集合)', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    // 实测 2026-10-30 上游 /v1/models 返回 9 个 id,其中媒体四档:
    // agnes-video-2.5-flash / agnes-video-2.5 / agnes-image-2.5-flash / agnes-image-2.1-flash
    for (const id of [
      'agnes-video-2.5-flash',
      'agnes-video-2.5',
      'agnes-image-2.5-flash',
      'agnes-image-2.1-flash',
    ]) {
      expect(sql).toContain(id)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
