// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

import type {
  ModelCapabilities,
  ModelCapabilityKey,
  ModelUsageCategory,
  ModelTier,
} from '@ihui/types'

// 类型定义下沉在 packages/types(依赖方向 types ← api-client ← shared,
// 放 shared 会让 api-client 循环依赖),此处 re-export 方便各端单点引用。
export type { ModelUsageCategory, ModelTier, ModelCapabilities, ModelCapabilityKey }

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
 * 2026-10-21 起:standard 是仍可调用的正式代次,折叠进历史区会造成
 * "能调通的没显示" —— latest/standard 的对话类模型都进默认列表;
 * 只有 legacy(过时版本)与非对话专用模型(嵌入/语音/图像,聊天场景调不通)折叠。
 */
export function isArchivedModel(category: ModelUsageCategory, tier: ModelTier): boolean {
  return tier === 'legacy' || !isConversationalCategory(category)
}

/**
 * 选择器不展示的用途(2026-11-20 机主追加:图片/视频/语音等分类要能选)。
 *
 * 只有"选了也产不出可读结果"的流水线中间件才挡在选择器外:
 * embedding(向量,产出的是 float 数组)、rerank(重排得分)、guard(内容审核判定)、
 * other(未归类兜底)。它们不是"另一种模态",是流水线中间件。
 * 图像(image)/视频(video)/语音(tts/asr)/视觉(vision)/OCR(ocr)等一律**展示**。
 *
 * 与后端 `model_catalog.py` 的 `MIDDLEWARE_CATEGORIES` 同口径(单一真相源在两侧各自语言内,
 * 改动必须同笔对齐,否则会一边显示一边判 legacy)。
 */
export const SELECTOR_EXCLUDED_CATEGORIES: readonly ModelUsageCategory[] = [
  'embedding',
  'rerank',
  'guard',
  'other',
]

/**
 * 聊天模型选择器是否展示该模型(2026-11-20 机主定档:取消「历史模型」折叠区)。
 *
 * 判据 = "非 legacy ∧ 用途不在 `SELECTOR_EXCLUDED_CATEGORIES` ∧ 模态档有可用生成通道":
 * legacy(过时版本)直接不出现;图像/视频/语音等专用模型**照常展示**(机主 2026-11-20 追加要求),
 * 只有检索/审核类中间件被挡掉。
 *
 * 第三判据(2026-11-21 追加):图像/视频里**没有接通生成通道**的模型不展示 —— 展示即承诺
 * "选了就出图/出片",而当前唯一能真跑的是 agnes 两条通道(`agnes-image-*` / `agnes-video-*`)。
 * 其余图像档(stable-diffusion-inpainting 这类需参考图、以及非生成器的 detector)留在
 * 选择器里只会重演"显示了但选了不能用"。`modelId` 缺位时该判据不生效(向后兼容老调用方)。
 *
 * 与 `isArchivedModel` 的分工:后者仍是"看目录"场景(模型市场 / Agent 创建器)的归档分组
 * 判据,语义未变;选择器改用本判据,避免把市场页一起掏空(市场页要能看到全量目录)。
 *
 * 后端字段缺失(老后端 / 缓存 / 降级种子)时兜底为 chat+latest ⇒ 返回 true,
 * 宁可多显示也不误藏,保证选择器不会整片空掉。
 */
export function isSelectableChatModel(
  category: ModelUsageCategory,
  tier: ModelTier,
  modelId?: string | null,
): boolean {
  if (tier === 'legacy') return false
  if (SELECTOR_EXCLUDED_CATEGORIES.includes(category)) return false
  if (modelId && !isExecutableMediaModel(modelId, category)) return false
  return true
}

/** 已接通真实生成通道的模态档 id 前缀(2026-11-21 立)。
 *  agnes 是当下唯一"不用新 key 就能真出图/出片"的 provider(见 apps/api 的
 *  ai-vendors/_shared.ts VENDORS.agnes + proxy-llm.ts 的 /agnes/image、proxy-media.ts 的
 *  /agnes/video)。新增通道时必须同笔把前缀登记到这里,否则新通道会在选择器里被藏掉。 */
export const MEDIA_GENERATION_ID_PREFIXES: readonly string[] = ['agnes-image-', 'agnes-video-']

/**
 * 取模型 id 的裸名(去掉 provider 前缀,保留大小写)。
 *
 * 目录里的 id 带前缀(`agnes/agnes-image-2.5-flash`)而上游只认裸名
 * (`agnes-image-2.5-flash`);两处必须同源取裸名,否则前端按目录 id 传过来,
 * 后端前缀判定与前缀透传会双双击空(2026-11-21 实测:选了 agnes 图像档却回 400)。
 */
export function bareMediaModelId(modelId: string | null | undefined): string {
  const id = (modelId ?? '').trim()
  return id.slice(id.lastIndexOf('/') + 1)
}

/**
 * 该模态档是否已有真实生成通路可执行(2026-11-21 立)。
 *
 * - 非图像/视频(chat/vision/tts/asr/ocr…)一律 true —— 语音等档的"未接通"由发送侧
 *   给明确提示卡,不在目录层判死(机主要求语音档可见)。
 * - 图像/视频:裸模型名(去掉 provider 前缀)命中 `MEDIA_GENERATION_ID_PREFIXES` 才算可执行。
 *
 * 取裸名而不是整串匹配:上游目录既有 `agnes/agnes-image-2.5-flash` 也有不带前缀的形态,
 * 两种都要认,同时不会把 `xxx-vision` 这类对话档误判。
 */
export function isExecutableMediaModel(
  modelId: string | null | undefined,
  category: ModelUsageCategory,
): boolean {
  if (category !== 'image' && category !== 'video') return true
  const bare = bareMediaModelId(modelId).toLowerCase()
  if (!bare) return true // 取不到 id ⇒ 不判死(失效方向恒为多显示一次)
  return MEDIA_GENERATION_ID_PREFIXES.some((prefix) => bare.startsWith(prefix))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
