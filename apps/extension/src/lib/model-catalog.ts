// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型分类辅助(浏览器扩展端,2026-08-29 立)
 *
 * 分类判定一律由后端 `ai-service/app/services/model_catalog.py` 完成,本文件只做
 * **消费侧分组**:把 /llm/models 返回的模型拆成"默认列表"和"历史模型折叠区",
 * 折叠区再按用途分类分组。判定与排序规则放在 packages/shared,各端共用同一份口径。
 *
 * 文案说明:分类名 / "历史模型" 走 packages/i18n/messages/extension/ 的 chat.modelCategory* /
 * chat.modelHistoryToggle,与 Web / mobile-rn 消息文件里的同名 key 逐条对齐(第十二批 i18n 迁移)。
 */

import {
  MODEL_CATEGORY_ORDER,
  MODEL_TIER_ORDER,
  isArchivedModel,
  normalizeCategory,
  normalizeTier,
} from '@ihui/shared/constants/model-catalog'
import { translate } from '@ihui/i18n/loader'
import type { Locale, Messages } from '@ihui/i18n/types'
import extZhCN from '@ihui/i18n/messages/extension/zh-CN.json'
import extZhTW from '@ihui/i18n/messages/extension/zh-TW.json'
import extEn from '@ihui/i18n/messages/extension/en.json'
import extJa from '@ihui/i18n/messages/extension/ja.json'
import extKo from '@ihui/i18n/messages/extension/ko.json'
import type { LlmModel } from '@ihui/api-client'
import type { ModelTier, ModelUsageCategory } from '@ihui/types'

/** 分组后的模型集合 */
export interface ModelCategoryGroup<M> {
  category: ModelUsageCategory
  items: M[]
}

/** 拆分结果:默认展示的 latest 对话模型 + 折叠区按用途分组的历史模型 */
export interface ModelCatalogSplit<M> {
  /** 默认展示(tier=latest 且用途为对话类) */
  primary: M[]
  /** 折叠区:按用途分类排序,组内 standard 在前 legacy 在后 */
  archived: ModelCategoryGroup<M>[]
  /** 折叠区模型总数 */
  archivedCount: number
}

/** 用途分类文案 key(词表在 extension 消息文件 chat.modelCategory*,与 Web 端同名 key 对齐) */
const CATEGORY_KEYS: Record<ModelUsageCategory, string> = {
  chat: 'chat.modelCategoryChat',
  vision: 'chat.modelCategoryVision',
  embedding: 'chat.modelCategoryEmbedding',
  rerank: 'chat.modelCategoryRerank',
  tts: 'chat.modelCategoryTts',
  asr: 'chat.modelCategoryAsr',
  image: 'chat.modelCategoryImage',
  video: 'chat.modelCategoryVideo',
  guard: 'chat.modelCategoryGuard',
  ocr: 'chat.modelCategoryOcr',
  other: 'chat.modelCategoryOther',
}

/** "历史模型"折叠区标题 key(与 Web 端 chat.modelHistoryToggle 对齐) */
const HISTORY_KEY = 'chat.modelHistoryToggle'

/** 本端消息表(与 src/i18n Provider 加载同一批 JSON;此处只做纯查表,不建第二个 Provider) */
const EXT_MESSAGES: Record<Locale, Messages> = {
  'zh-CN': extZhCN,
  'zh-TW': extZhTW,
  en: extEn,
  ja: extJa,
  ko: extKo,
}

/** 读取模型用途分类(后端字段缺失时按"对话"兜底,宁可多显示也不误藏) */
export function categoryOf<M extends Pick<LlmModel, 'category'>>(model: M): ModelUsageCategory {
  return normalizeCategory(model.category)
}

/** 读取模型代次档位(后端字段缺失时按"最新"兜底) */
export function tierOf<M extends Pick<LlmModel, 'model_tier'>>(model: M): ModelTier {
  return normalizeTier(model.model_tier)
}

/** 组内排序:standard 在前、legacy 在后,再按名称 */
function compareWithinGroup(a: LlmModel, b: LlmModel): number {
  const ta = MODEL_TIER_ORDER[tierOf(a)]
  const tb = MODEL_TIER_ORDER[tierOf(b)]
  if (ta !== tb) return ta - tb
  const na = a.name || a.id
  const nb = b.name || b.id
  return na < nb ? -1 : na > nb ? 1 : 0
}

/**
 * 把模型列表拆成"默认展示"与"历史模型折叠区"。
 *
 * 折叠区按 MODEL_CATEGORY_ORDER 排序,组内按代次 + 名称排序。
 * 后端字段缺失时两个兜底都会把模型留在默认列表,保证列表不会空掉。
 */
export function splitModelCatalog<M extends LlmModel>(models: M[]): ModelCatalogSplit<M> {
  const primary: M[] = []
  const buckets = new Map<ModelUsageCategory, M[]>()

  for (const model of models) {
    const category = categoryOf(model)
    if (isArchivedModel(category, tierOf(model))) {
      const bucket = buckets.get(category)
      if (bucket) bucket.push(model)
      else buckets.set(category, [model])
    } else {
      primary.push(model)
    }
  }

  const archived: ModelCategoryGroup<M>[] = []
  for (const category of MODEL_CATEGORY_ORDER) {
    const bucket = buckets.get(category)
    if (!bucket || bucket.length === 0) continue
    archived.push({ category, items: [...bucket].sort(compareWithinGroup) })
  }

  return {
    primary,
    archived,
    archivedCount: archived.reduce((sum, g) => sum + g.items.length, 0),
  }
}

/** 用途分类文案 */
export function categoryLabel(category: ModelUsageCategory, locale: Locale): string {
  return translate(EXT_MESSAGES[locale], CATEGORY_KEYS[category], {
    fallback: EXT_MESSAGES['zh-CN'],
  })
}

/** "历史模型"折叠区标题 */
export function historyLabel(locale: Locale): string {
  return translate(EXT_MESSAGES[locale], HISTORY_KEY, { fallback: EXT_MESSAGES['zh-CN'] })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
