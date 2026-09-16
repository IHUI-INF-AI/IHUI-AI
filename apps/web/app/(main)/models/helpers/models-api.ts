// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi } from '@/lib/api'
import { normalizeCategory, normalizeTier } from '@ihui/shared'
import type { Model, Provider } from '../types'
import type { ModelTier, ModelUsageCategory } from '@ihui/shared'
import { HIGHLIGHT_MODEL_IDS, MODEL_DESCRIPTIONS } from './model-meta'

function enrichModel(m: Model): Model {
  const highlight = HIGHLIGHT_MODEL_IDS.has(m.id)
  return {
    ...m,
    highlight,
    popularity: highlight ? 88 : 50,
  }
}

export function enrichModels(list: Model[]): Model[] {
  return list.map(enrichModel)
}

/** 中转站公开目录条目(2026-09-16 扩充价格对比字段;与 relay-public.ts 输出对齐) */
interface RelayPublicItem {
  modelId: string
  relayPriceMultiplier: number
  relayDisplayName?: string | null
  /** 官方/上游参考价(分/千 token) */
  officialInputPricePer1k?: number
  officialOutputPricePer1k?: number
  /** 中转站实付价(分/千 token) */
  relayInputPricePer1k?: number
  relayOutputPricePer1k?: number
  /** 缓存读/写实付价(分/千 token) */
  relayCacheReadPricePer1k?: number
  relayCacheWritePricePer1k?: number
  /** 当前生效的分时倍率(1 = 无高峰加价) */
  peakMultiplier?: number
  /** 含分时倍率的实付价 */
  effectiveInputPricePer1k?: number
  effectiveOutputPricePer1k?: number
  /** 包含本模型的订阅套餐名 */
  subscriptionPlans?: string[]
}

/** 中转站元数据(供 Model 卡片展示价格对比) */
interface RelayMeta {
  multiplier: number
  displayName?: string | null
  officialInputPricePer1k: number
  officialOutputPricePer1k: number
  relayInputPricePer1k: number
  relayOutputPricePer1k: number
  relayCacheReadPricePer1k: number
  relayCacheWritePricePer1k: number
  peakMultiplier: number
  effectiveInputPricePer1k: number
  effectiveOutputPricePer1k: number
  subscriptionPlans: string[]
}

export async function fetchModels(): Promise<Model[]> {
  try {
    // fetchApi 自动解包 { code, message, data } 信封并返回 data 字段;
    // 原 `next: { revalidate: 300 }` 是 SSR 遗留(此函数已改为客户端 useQuery 调用),客户端忽略。
    const [r, relayR] = await Promise.all([
      fetchApi<{
        models: Array<{
          id: string
          name: string
          provider: Provider
          context_length: number
          input_price: number
          /** 2026-08-29 立:后端 model_catalog 分类字段(老后端无此字段) */
          category?: ModelUsageCategory
          model_tier?: ModelTier
        }>
      }>('/api/llm/models'),
      // P0-5g 并发拉取中转站已上架模型清单(失败时降级空清单,不阻塞主流程)
      fetchApi<{ items: RelayPublicItem[] }>('/api/relay/models/public').catch(() => null),
    ])
    if (!r.success) throw new Error(r.error)

    // 中转站已上架模型 id → relay 元数据映射(P0-5g;2026-09-16 扩充价格对比字段)
    const relayMap = new Map<string, RelayMeta>()
    if (relayR?.success && Array.isArray(relayR.data?.items)) {
      for (const it of relayR.data.items) {
        const multiplier = it.relayPriceMultiplier ?? 1
        const officialIn = it.officialInputPricePer1k ?? 0
        const officialOut = it.officialOutputPricePer1k ?? 0
        const peak = it.peakMultiplier ?? 1
        relayMap.set(it.modelId, {
          multiplier,
          displayName: it.relayDisplayName ?? null,
          officialInputPricePer1k: officialIn,
          officialOutputPricePer1k: officialOut,
          // 老后端未返回实付价时按"基础价 × 倍率"就地折算,保证展示不退化为 0
          relayInputPricePer1k: it.relayInputPricePer1k ?? officialIn * multiplier,
          relayOutputPricePer1k: it.relayOutputPricePer1k ?? officialOut * multiplier,
          relayCacheReadPricePer1k: it.relayCacheReadPricePer1k ?? officialIn * 0.1 * multiplier,
          relayCacheWritePricePer1k: it.relayCacheWritePricePer1k ?? officialIn * 1.25 * multiplier,
          peakMultiplier: peak,
          effectiveInputPricePer1k: it.effectiveInputPricePer1k ?? officialIn * multiplier * peak,
          effectiveOutputPricePer1k:
            it.effectiveOutputPricePer1k ?? officialOut * multiplier * peak,
          subscriptionPlans: Array.isArray(it.subscriptionPlans) ? it.subscriptionPlans : [],
        })
      }
    }

    const list: Model[] = r.data.models.map((m) => {
      const desc = MODEL_DESCRIPTIONS[m.id] ?? { description: '', features: [] }
      const relay = relayMap.get(m.id)
      return {
        id: m.id,
        name: m.name,
        provider: m.provider,
        description: desc.description,
        contextLength: m.context_length,
        inputPrice: m.input_price,
        features: desc.features,
        // P0-5g 中转站字段(若模型已上架到中转站,relayMap 命中)
        relayPublic: !!relay,
        relayPriceMultiplier: relay?.multiplier ?? 1,
        relayDisplayName: relay?.displayName ?? undefined,
        // 2026-09-16 价格对比字段(仅在 relayPublic 为真时有意义)
        relayOfficialInputPricePer1k: relay?.officialInputPricePer1k,
        relayOfficialOutputPricePer1k: relay?.officialOutputPricePer1k,
        relayInputPricePer1k: relay?.relayInputPricePer1k,
        relayOutputPricePer1k: relay?.relayOutputPricePer1k,
        relayCacheReadPricePer1k: relay?.relayCacheReadPricePer1k,
        relayCacheWritePricePer1k: relay?.relayCacheWritePricePer1k,
        relayPeakMultiplier: relay?.peakMultiplier,
        relayEffectiveInputPricePer1k: relay?.effectiveInputPricePer1k,
        relayEffectiveOutputPricePer1k: relay?.effectiveOutputPricePer1k,
        relaySubscriptionPlans: relay?.subscriptionPlans ?? [],
        // 2026-08-29 立:用途分类 + 代次档位(缺失时归一化为 chat/latest)
        category: normalizeCategory(m.category),
        modelTier: normalizeTier(m.model_tier),
      }
    })
    return enrichModels(list)
  } catch {
    // API 不可用时返回空列表,由页面呈现加载失败态,避免用内置模型冒充真实模型市场
    return []
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
