/**
 * 模型分类辅助(CLI 端,2026-08-29 立)
 *
 * 分类判定一律由后端 `ai-service/app/services/model_catalog.py` 完成,本文件只做
 * **消费侧分组**:把 /api/llm/models 返回的模型拆成"默认列表"和"历史模型折叠区",
 * 折叠区再按用途分类分组。判定与排序规则放在 packages/shared,各端共用同一份口径。
 *
 * 文案说明:CLI 输出目前统一中文(models.ts / keys / usage 等命令的提示语均为中文),
 * 分类名直接与 Web / mobile-rn 消息文件里的 chat.modelCategory* 中文案对齐。
 */

import {
  MODEL_CATEGORY_ORDER,
  MODEL_TIER_ORDER,
  isArchivedModel,
  normalizeCategory,
  normalizeTier,
} from '@ihui/shared/constants';
import type { ModelTier, ModelUsageCategory } from '@ihui/types';

/** 参与分类所需的最小字段(CLI 侧 LlmModel 与 api-client 契约均满足) */
export interface CatalogModel {
  id: string;
  name: string;
  category?: ModelUsageCategory;
  model_tier?: ModelTier;
}

/** 分组后的模型集合 */
export interface ModelCategoryGroup<M> {
  category: ModelUsageCategory;
  items: M[];
}

/** 拆分结果:默认展示的 latest 对话模型 + 折叠区按用途分组的历史模型 */
export interface ModelCatalogSplit<M> {
  /** 默认展示(tier=latest 且用途为对话类) */
  primary: M[];
  /** 折叠区:按用途分类排序,组内 standard 在前 legacy 在后 */
  archived: ModelCategoryGroup<M>[];
  /** 折叠区模型总数 */
  archivedCount: number;
}

/** 用途分类中文名(与 Web / mobile-rn 的 chat.modelCategory* 中文案一致) */
const CATEGORY_LABELS: Record<ModelUsageCategory, string> = {
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
};

/** "历史模型"折叠区标题 */
export const HISTORY_LABEL = '历史模型';

/** 用途分类中文名 */
export function categoryLabel(category: ModelUsageCategory): string {
  return CATEGORY_LABELS[category];
}

/** 读取模型用途分类(后端字段缺失时按"对话"兜底,宁可多显示也不误藏) */
export function categoryOf(model: CatalogModel): ModelUsageCategory {
  return normalizeCategory(model.category);
}

/** 读取模型代次档位(后端字段缺失时按"最新"兜底) */
export function tierOf(model: CatalogModel): ModelTier {
  return normalizeTier(model.model_tier);
}

/** 组内排序:standard 在前、legacy 在后,再按名称 */
function compareWithinGroup(a: CatalogModel, b: CatalogModel): number {
  const ta = MODEL_TIER_ORDER[tierOf(a)];
  const tb = MODEL_TIER_ORDER[tierOf(b)];
  if (ta !== tb) return ta - tb;
  const na = a.name || a.id;
  const nb = b.name || b.id;
  return na < nb ? -1 : na > nb ? 1 : 0;
}

/**
 * 把模型列表拆成"默认展示"与"历史模型折叠区"。
 *
 * 折叠区按 MODEL_CATEGORY_ORDER 排序,组内按代次 + 名称排序。
 * 后端字段缺失时两个兜底都会把模型留在默认列表,保证列表不会空掉。
 */
export function splitModelCatalog<M extends CatalogModel>(models: M[]): ModelCatalogSplit<M> {
  const primary: M[] = [];
  const buckets = new Map<ModelUsageCategory, M[]>();

  for (const model of models) {
    const category = categoryOf(model);
    if (isArchivedModel(category, tierOf(model))) {
      const bucket = buckets.get(category);
      if (bucket) bucket.push(model);
      else buckets.set(category, [model]);
    } else {
      primary.push(model);
    }
  }

  const archived: ModelCategoryGroup<M>[] = [];
  for (const category of MODEL_CATEGORY_ORDER) {
    const bucket = buckets.get(category);
    if (!bucket || bucket.length === 0) continue;
    archived.push({ category, items: [...bucket].sort(compareWithinGroup) });
  }

  return {
    primary,
    archived,
    archivedCount: archived.reduce((sum, g) => sum + g.items.length, 0),
  };
}
