/**
 * 模型分类元数据(跨端共享,2026-08-29 立)
 *
 * 背景:ai-service /llm/models 会返回上千个模型,混着历史过时版本、非对话模型
 * (embedding / reranker / TTS / ASR / 图像生成)、preview 快照和 `:free` 价格变体。
 * 后端 `app/services/model_catalog.py` 给每个模型打两个正交维度的标签,各端据此渲染:
 *
 *   1. `category` —— 用途分类(这模型是干什么的)
 *   2. `model_tier` —— 代次档位(latest 默认展示 / standard+legacy 收进"历史模型")
 *
 * 本文件只放**与渲染相关的静态元数据**(展示顺序、是否对话类、i18n key),
 * 判定逻辑一律在后端,前端不做二次猜测 —— 保证 8 端口径一致。
 */

import type { ModelUsageCategory, ModelTier } from '@ihui/types'

// 类型定义下沉在 packages/types(依赖方向 types ← api-client ← shared,
// 放 shared 会让 api-client 循环依赖),此处 re-export 方便各端单点引用。
export type { ModelUsageCategory, ModelTier }

/** 后端未返回分类字段时的兜底档位(老后端 / 降级路径一律按"最新"处理,避免列表空掉) */
export const DEFAULT_MODEL_TIER: ModelTier = 'latest'
/** 后端未返回用途分类时的兜底 */
export const DEFAULT_MODEL_CATEGORY: ModelUsageCategory = 'chat'

export interface ModelCategoryMeta {
  /** i18n key(各端在自己的 i18n 包内映射为本地化文案) */
  labelKey: string
  /** 展示排序(升序),对话类永远在前 */
  order: number
  /** 是否对话类:聊天模型选择器默认只展示这些 */
  conversational: boolean
}

/**
 * 用途分类元数据。
 * order 设计:chat(0)/vision(1) 是聊天场景主力,其余专业用途按常见度排在后面。
 */
export const MODEL_CATEGORY_META: Record<ModelUsageCategory, ModelCategoryMeta> = {
  chat: { labelKey: 'modelCategoryChat', order: 0, conversational: true },
  vision: { labelKey: 'modelCategoryVision', order: 1, conversational: true },
  embedding: { labelKey: 'modelCategoryEmbedding', order: 2, conversational: false },
  rerank: { labelKey: 'modelCategoryRerank', order: 3, conversational: false },
  tts: { labelKey: 'modelCategoryTts', order: 4, conversational: false },
  asr: { labelKey: 'modelCategoryAsr', order: 5, conversational: false },
  image: { labelKey: 'modelCategoryImage', order: 6, conversational: false },
  video: { labelKey: 'modelCategoryVideo', order: 7, conversational: false },
  guard: { labelKey: 'modelCategoryGuard', order: 8, conversational: false },
  ocr: { labelKey: 'modelCategoryOcr', order: 9, conversational: false },
  other: { labelKey: 'modelCategoryOther', order: 10, conversational: false },
}

/** 用途分类展示顺序(已按 order 排好) */
export const MODEL_CATEGORY_ORDER: ModelUsageCategory[] = (
  Object.keys(MODEL_CATEGORY_META) as ModelUsageCategory[]
).sort((a, b) => MODEL_CATEGORY_META[a].order - MODEL_CATEGORY_META[b].order)

/** 代次档位排序:latest 在前,legacy 最后 */
export const MODEL_TIER_ORDER: Record<ModelTier, number> = {
  latest: 0,
  standard: 1,
  legacy: 2,
}

/** 兼容老后端:把任意字符串收敛为合法 ModelUsageCategory */
export function normalizeCategory(value: string | undefined | null): ModelUsageCategory {
  if (!value) return DEFAULT_MODEL_CATEGORY
  return (MODEL_CATEGORY_META as Record<string, ModelCategoryMeta>)[value]
    ? (value as ModelUsageCategory)
    : DEFAULT_MODEL_CATEGORY
}

/** 兼容老后端:把任意字符串收敛为合法 ModelTier(未知值按 latest,保证不误藏模型) */
export function normalizeTier(value: string | undefined | null): ModelTier {
  if (value === 'latest' || value === 'standard' || value === 'legacy') return value
  return DEFAULT_MODEL_TIER
}

/** 是否对话类模型(聊天选择器默认展示的) */
export function isConversationalCategory(category: ModelUsageCategory): boolean {
  return MODEL_CATEGORY_META[category]?.conversational ?? true
}

/**
 * 是否属于"历史模型"折叠区。
 * 只有 tier=latest 且是对话类用途的才进默认列表,其余全部折叠。
 */
export function isArchivedModel(category: ModelUsageCategory, tier: ModelTier): boolean {
  return tier !== 'latest' || !isConversationalCategory(category)
}
