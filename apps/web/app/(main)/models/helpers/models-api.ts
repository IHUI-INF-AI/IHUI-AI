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
      fetchApi<{
        items: Array<{
          modelId: string
          relayPriceMultiplier: number
          relayDisplayName?: string | null
        }>
      }>('/api/relay/models/public').catch(() => null),
    ])
    if (!r.success) throw new Error(r.error)

    // 中转站已上架模型 id → relay 元数据映射(P0-5g)
    const relayMap = new Map<string, { multiplier: number; displayName?: string | null }>()
    if (relayR?.success && Array.isArray(relayR.data?.items)) {
      for (const it of relayR.data.items) {
        relayMap.set(it.modelId, {
          multiplier: it.relayPriceMultiplier ?? 1,
          displayName: it.relayDisplayName ?? null,
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
