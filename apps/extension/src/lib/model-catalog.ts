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
 * 文案说明:分类名 / "历史模型" 走本地词典而非 i18n 文件 —— 本端的消息文件在
 * packages/i18n/messages/extension/ 下,按分工不在本次改动范围内;词典与 Web /
 * mobile-rn 消息文件里的 chat.modelCategory* / chat.modelHistoryToggle 逐条对齐,
 * 后续若把 key 补进消息文件,改这里的取值来源即可,其余代码不用动。
 */

import {
  MODEL_CATEGORY_ORDER,
  MODEL_TIER_ORDER,
  isArchivedModel,
  normalizeCategory,
  normalizeTier,
} from '@ihui/shared/constants/model-catalog'
import type { Locale } from '@ihui/i18n/types'
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

/** 用途分类文案(与 Web / mobile-rn 的 chat.modelCategory* 对齐) */
const CATEGORY_LABELS: Record<Locale, Record<ModelUsageCategory, string>> = {
  'zh-CN': {
    chat: '对话推理',
    vision: '视觉理解',
    embedding: '向量嵌入',
    rerank: '重排序',
    tts: '语音合成',
    asr: '语音识别',
    image: '图像生成',
    video: '视频生成',
    guard: '安全审核',
    ocr: '文字识别',
    other: '其他',
  },
  'zh-TW': {
    chat: '對話推理',
    vision: '視覺理解',
    embedding: '向量嵌入',
    rerank: '重排序',
    tts: '語音合成',
    asr: '語音辨識',
    image: '圖像生成',
    video: '影片生成',
    guard: '安全審核',
    ocr: '文字辨識',
    other: '其他',
  },
  en: {
    chat: 'Chat',
    vision: 'Vision',
    embedding: 'Embedding',
    rerank: 'Rerank',
    tts: 'Text to speech',
    asr: 'Speech to text',
    image: 'Image generation',
    video: 'Video generation',
    guard: 'Safety guard',
    ocr: 'OCR',
    other: 'Other',
  },
  ja: {
    chat: '対話・推論',
    vision: '画像理解',
    embedding: '埋め込み',
    rerank: 'リランク',
    tts: '音声合成',
    asr: '音声認識',
    image: '画像生成',
    video: '動画生成',
    guard: '安全性審査',
    ocr: '文字認識',
    other: 'その他',
  },
  ko: {
    chat: '대화·추론',
    vision: '비전 이해',
    embedding: '임베딩',
    rerank: '리랭크',
    tts: '음성 합성',
    asr: '음성 인식',
    image: '이미지 생성',
    video: '비디오 생성',
    guard: '안전 필터',
    ocr: '문자 인식',
    other: '기타',
  },
}

/** "历史模型"折叠区标题(与 Web / mobile-rn 的 chat.modelHistoryToggle 对齐) */
const HISTORY_LABELS: Record<Locale, string> = {
  'zh-CN': '历史模型',
  'zh-TW': '歷史模型',
  en: 'Legacy models',
  ja: '過去のモデル',
  ko: '이전 모델',
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
  return CATEGORY_LABELS[locale][category]
}

/** "历史模型"折叠区标题 */
export function historyLabel(locale: Locale): string {
  return HISTORY_LABELS[locale]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
