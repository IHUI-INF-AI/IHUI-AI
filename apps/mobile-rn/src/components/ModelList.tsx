/**
 * ModelList 模型列表 (mobile-rn 端)
 *
 * 对齐历史项目 ModelList.vue(模型广场专用):
 * - SectionList 按 vendor 分组(OpenAI / Anthropic / Google / 智谱 / 百度等)
 * - 分组头部:paddingHorizontal 16, paddingVertical 8, fontSize 13,
 *   fontWeight 600, color text.secondary, uppercase letterSpacing 0.5,
 *   bgColor surface.bg
 * - 单项:左侧 40×40 圆角 8 emoji 图标 + 中间 name/description + 右侧
 *   免费/付费徽章 + 选中态对勾(brand.DEFAULT 色)
 * - ItemSeparatorComponent 1px 分割线(border.light)
 * - 单选 / 多选模式:selectionMode = 'single' | 'multiple'
 * - 加载更多:onEndReached
 * - 浅色优雅风,无霓虹 / 无渐变 / 无 ttf
 * - 颜色全部走 @ihui/design-tokens 的 rnLightTokens
 * - 类型零 any,精确标注
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type SectionListData,
  type SectionListRenderItem,
} from 'react-native'

/** 单个模型条目 */
export interface ModelListItem {
  id: string
  name: string
  description: string
  icon: string
  isFree: boolean
}

/** 按 vendor 分组 */
export interface ModelListGroup {
  vendor: string
  models: ModelListItem[]
}

/** 选中模式 */
export type ModelListSelectionMode = 'single' | 'multiple'

export interface ModelListProps {
  groups: ModelListGroup[]
  selectionMode?: ModelListSelectionMode
  selectedIds?: string[]
  onSelectChange?: (ids: string[]) => void
  onEndReached?: () => void
}

function Separator(): React.ReactElement {
  return <View style={styles.separator} />
}

function EmptyState(): React.ReactElement {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>暂无模型</Text>
    </View>
  )
}

export default function ModelList({
  groups,
  selectionMode = 'single',
  selectedIds = [],
  onSelectChange,
  onEndReached,
}: ModelListProps): React.ReactElement {
  const selectedSet = new Set(selectedIds)

  /** 列表分组 section 数据(RN SectionList 要求 data 字段为 ItemT[]) */
  const sections: SectionListData<ModelListItem, { vendor: string }>[] = groups
    .filter((g) => g.models.length > 0)
    .map((g) => ({ vendor: g.vendor, data: g.models }))

  const handlePress = (id: string): void => {
    if (!onSelectChange) return
    if (selectionMode === 'single') {
      onSelectChange([id])
      return
    }
    const next = new Set(selectedSet)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onSelectChange(Array.from(next))
  }

  const renderItem: SectionListRenderItem<ModelListItem, { vendor: string }> = ({ item }) => {
    const selected = selectedSet.has(item.id)
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => handlePress(item.id)}
      >
        <View style={styles.iconWrap}>
          <Text style={styles.iconEmoji}>{item.icon}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.description} numberOfLines={1}>
            {item.description}
          </Text>
        </View>
        {item.isFree ? (
          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>免费</Text>
          </View>
        ) : (
          <View style={styles.paidBadge}>
            <Text style={styles.paidBadgeText}>付费</Text>
          </View>
        )}
        {selected ? (
          <View style={styles.check}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    )
  }

  const renderSectionHeader = ({
    section,
  }: {
    section: SectionListData<ModelListItem, { vendor: string }>
  }): React.ReactElement => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.vendor}</Text>
    </View>
  )

  return (
    <SectionList<ModelListItem, { vendor: string }>
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ItemSeparatorComponent={Separator}
      stickySectionHeadersEnabled
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={EmptyState}
      contentContainerStyle={styles.listBody}
    />
  )
}

const styles = StyleSheet.create({
  listBody: {
    backgroundColor: tokens.surface.bg,
    paddingBottom: 24,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: tokens.surface.bg,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: tokens.surface.bg,
  },
  iconWrap: {
    width: 40,
    height: 44,
    borderRadius: 12,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 20,
  },
  body: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  description: {
    fontSize: 12,
    color: tokens.text.secondary,
    marginTop: 2,
  },
  freeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: tokens.success.lighter,
  },
  freeBadgeText: {
    fontSize: 11,
    color: tokens.success.DEFAULT,
  },
  paidBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: tokens.warning.amberLight,
  },
  paidBadgeText: {
    fontSize: 11,
    color: tokens.warning.amberText,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: tokens.surface.light,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  separator: {
    height: 1,
    backgroundColor: tokens.border.light,
    marginLeft: 68,
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: tokens.text.tertiary,
  },
})
