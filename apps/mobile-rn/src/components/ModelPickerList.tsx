// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ModelPickerList 模型选择器列表(mobile-rn 端,2026-08-29 立)
 *
 * 背景:后端 /llm/models 会返回上千个模型,混着历史过时版本、非对话模型
 * (embedding / reranker / TTS / ASR / 图像生成)、preview 快照和 `:free` 价格变体。
 * 直接铺平展示会让用户根本选不到模型。
 *
 * 本组件把列表切成两段:
 *   1. 默认列表 —— `isArchivedModel() === false`(tier=latest 且 chat/vision 类)
 *   2. 历史模型折叠区 —— 其余全部收起,点底部「历史模型 (N)」才展开,
 *      区内按**用途分类**分组(对话推理 / 向量嵌入 / 语音合成 / 图像生成 …),
 *      并带搜索框(归档模型可能上千个,没有搜索等于不可用)
 *
 * 设计约束(项目铁律,pre-commit 会拦):
 *   - 圆角只走 2/4/6/8/12/16 梯度,禁止 rounded-full / 9999px / 50%
 *   - 禁止 divide-y / divide-x / 单边 border 当分割线,用 gap + 背景色对比替代
 *   - 禁止 emoji 当 UI 图标,一律 lucide-react-native
 *   - RN 0.86 Fabric:Pressable 的 backgroundColor 不渲染 → 交互元素用 TouchableOpacity;
 *     ScrollView 需要确定高度 → 调用方必须把本组件放进定高/flex 容器,内部列表用 flex:1
 *   - 类型零 any
 *
 * 分类口径的唯一真源是后端 `ai-service/app/services/model_catalog.py` +
 * 共享常量 `@ihui/shared`(`MODEL_CATEGORY_META` / `isArchivedModel`),
 * 本组件**不重复实现任何判定逻辑**,只做渲染。
 */
import { useMemo, useState } from 'react'
import {
  MODEL_CATEGORY_META,
  MODEL_CATEGORY_ORDER,
  MODEL_TIER_ORDER,
  isArchivedModel,
  normalizeCategory,
  normalizeTier,
} from '@ihui/shared'
import type { ModelTier, ModelUsageCategory } from '@ihui/types'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { ChevronDown, ChevronUp, History, Search } from 'lucide-react-native'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import ModelList, { type ModelListItem, type ModelListGroup } from './ModelList'
import { useI18n } from '../i18n'

// 调用方需要用它自己组装条目(category / modelTier 是 ModelListItem 的字段),此处转出
export type { ModelListItem }

export interface ModelPickerListProps {
  /** 全量模型条目(需带 category / modelTier;缺失时按 latest+chat 兜底,宁可多显示不误藏) */
  items: ModelListItem[]
  selectedIds: string[]
  onSelectChange?: (ids: string[]) => void
  /** 默认列表分组标题(缺省用 chat.modelLabel) */
  defaultGroupTitle?: string
}

/** 分组内排序:standard 先于 legacy(还能用的旧版本优先于明显过时的),再按名称 */
function compareArchived(a: ModelListItem, b: ModelListItem): number {
  const ta: ModelTier = normalizeTier(a.modelTier)
  const tb: ModelTier = normalizeTier(b.modelTier)
  const byTier = MODEL_TIER_ORDER[ta] - MODEL_TIER_ORDER[tb]
  if (byTier !== 0) return byTier
  return a.name.localeCompare(b.name)
}

/** 默认列表排序:名称升序(全部是 latest,无需比代次) */
function comparePrimary(a: ModelListItem, b: ModelListItem): number {
  return a.name.localeCompare(b.name)
}

function matchesKeyword(item: ModelListItem, keyword: string): boolean {
  const haystack = `${item.name} ${item.id} ${item.description ?? ''}`.toLowerCase()
  return haystack.includes(keyword)
}

export default function ModelPickerList({
  items,
  selectedIds,
  onSelectChange,
  defaultGroupTitle,
}: ModelPickerListProps): React.ReactElement {
  const { t } = useI18n()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [keyword, setKeyword] = useState('')

  // ── 分区:默认列表 vs 历史模型 ──
  const { primary, archived } = useMemo(() => {
    const visible: ModelListItem[] = []
    const hidden: ModelListItem[] = []
    for (const item of items) {
      const category: ModelUsageCategory = normalizeCategory(item.category)
      const tier: ModelTier = normalizeTier(item.modelTier)
      if (isArchivedModel(category, tier)) {
        hidden.push(item)
      } else {
        visible.push(item)
      }
    }
    return { primary: visible.sort(comparePrimary), archived: hidden }
  }, [items])

  // ── 默认列表分组 ──
  const primaryGroups: ModelListGroup[] = useMemo(
    () =>
      primary.length > 0
        ? [{ title: defaultGroupTitle ?? t('chat.modelLabel'), models: primary }]
        : [],
    [primary, defaultGroupTitle, t],
  )

  // ── 归档区:先按关键词过滤,再按用途分类分组 ──
  const archiveGroups: ModelListGroup[] = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const pool = kw ? archived.filter((item) => matchesKeyword(item, kw)) : archived

    const buckets = new Map<ModelUsageCategory, ModelListItem[]>()
    for (const item of pool) {
      const category = normalizeCategory(item.category)
      const bucket = buckets.get(category)
      if (bucket) {
        bucket.push(item)
      } else {
        buckets.set(category, [item])
      }
    }

    const groups: ModelListGroup[] = []
    for (const category of MODEL_CATEGORY_ORDER) {
      const bucket = buckets.get(category)
      if (!bucket || bucket.length === 0) continue
      bucket.sort(compareArchived)
      const label = t(`chat.${MODEL_CATEGORY_META[category].labelKey}`)
      groups.push({ title: `${label} (${bucket.length})`, models: bucket })
    }
    return groups
  }, [archived, keyword, t])

  /**
   * 归档区是否展开 —— 用派生值而非直接改 state:
   * 默认列表为空时(老后端没返回 model_tier / 整批模型被判成 standard)强制展开,
   * 避免用户打开选择器看到一片空白以为功能坏了;同时用户仍可手动收起(toggle 会
   * 把 archiveOpen 显式置 false,但 autoOpen 仍为真 → 这里用 && 短路兼顾两者)。
   */
  const showArchive = archiveOpen || primary.length === 0

  const handleToggle = (): void => {
    if (showArchive) setKeyword('')
    setArchiveOpen(!showArchive)
  }

  return (
    <View style={styles.root}>
      <View style={styles.primaryWrap}>
        <ModelList
          style={styles.list}
          groups={primaryGroups}
          selectionMode="single"
          selectedIds={selectedIds}
          onSelectChange={onSelectChange}
        />
      </View>

      {archived.length > 0 ? (
        <View style={[styles.archiveSection, showArchive ? styles.archiveSectionOpen : null]}>
          <TouchableOpacity
            style={styles.toggle}
            onPress={handleToggle}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: showArchive }}
            accessibilityLabel={`${t('chat.modelHistoryToggle')} (${archived.length})`}
          >
            <History size={16} color={tokens.text.secondary} />
            <Text
              style={styles.toggleText}
            >{`${t('chat.modelHistoryToggle')} (${archived.length})`}</Text>
            {showArchive ? (
              <ChevronUp size={16} color={tokens.text.secondary} />
            ) : (
              <ChevronDown size={16} color={tokens.text.secondary} />
            )}
          </TouchableOpacity>

          {showArchive ? (
            <View style={styles.archiveWrap}>
              <View style={styles.searchRow}>
                <Search size={16} color={tokens.text.tertiary} />
                <TextInput
                  style={styles.searchInput}
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder={t('chat.modelHistorySearch')}
                  placeholderTextColor={tokens.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel={t('chat.modelHistorySearch')}
                />
              </View>
              {archiveGroups.length > 0 ? (
                <ModelList
                  style={styles.list}
                  groups={archiveGroups}
                  selectionMode="single"
                  selectedIds={selectedIds}
                  onSelectChange={onSelectChange}
                />
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>{t('chat.modelHistoryEmpty')}</Text>
                </View>
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  },
  /**
   * 折叠时占满全部;展开时让出 2/3 给归档区。
   *
   * 已知取舍(刻意保留,勿当 bug 改):默认区与归档区是**两个独立滚动容器**,
   * 滚动不连续。要统一滚动需让 ModelList 支持分区 footer,改动面大、回归风险高;
   * 而分栏的副作用是正面的——归档区展开后"最新最强"列表仍固定可见,不会滚丢。
   */
  primaryWrap: {
    flex: 1,
    minHeight: 120,
  },
  list: {
    flex: 1,
  },
  /** 与默认列表用背景色对比区分(禁止 divide-y 分割线) */
  archiveSection: {
    backgroundColor: tokens.surface.muted,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  /**
   * 展开时才分走 2/3 高度。注意:必须挂在这一层 —— archiveWrap 的父级若仍是
   * auto 高度,里面的 flex 会退化成内容高度(归档模型上千条时会把默认列表顶没)。
   */
  archiveSectionOpen: {
    flex: 2,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
    backgroundColor: tokens.surface.card,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.text.secondary,
  },
  /** 父级 archiveSection 已分到 flex:2,这里 flex:1 吃掉去掉搜索框后的剩余空间 */
  archiveWrap: {
    flex: 1,
    minHeight: 160,
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
    backgroundColor: tokens.surface.light,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: tokens.text.primary,
    paddingVertical: 0,
  },
  empty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: tokens.text.tertiary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
