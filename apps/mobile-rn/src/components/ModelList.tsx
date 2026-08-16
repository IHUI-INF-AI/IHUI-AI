/**
 * ModelList 模型列表 (mobile-rn 端)
 *
 * 对齐历史项目 ModelList.vue(模型选择浮层):
 * - SectionList 按类型分组:对话 / 图片 / 视频 / 音频 / 数字人 / 全能
 *   (对齐 Uniapp type 0=其他/全能 1=对话 2=图片 3=视频 4=音频 5=数字人;
 *    legacy vendor 分组名作为无 type 时的回退标题,保证不破坏现有调用方)
 * - 单项:icon + name + 排名第一徽章(组内 index 0,金色)+ NEW 角标(is_new==1)
 *   + 描述 + 免费/付费徽章 + 选中对勾(brand 黑底白勾)
 * - 组内按 isTop 排序(is_top==1 置顶)
 * - Agent 模式选项(showAgentMode + agentModeSelected + onAgentModeClick,可选)
 * - 逐项 slideUp 入场动画(animateEntrance,默认开启,反向 stagger)
 * - 单选 / 多选:selectionMode = 'single' | 'multiple'
 * - 加载更多:onEndReached
 * - 浅色优雅风,无霓虹 / 无渐变 / 无 ttf;颜色走 @ihui/design-tokens 的 rnLightTokens
 * - 类型零 any,精确标注
 */
import { useEffect, useRef } from 'react'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  Animated,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type SectionListData,
  type SectionListRenderItem,
} from 'react-native'

/** 排名第一徽章金色(design-tokens 无金色,复刻 rankone 用) */
const RANK_GOLD_BG = '#F5B301'
const RANK_GOLD_TEXT = '#FFFFFF'

/** 模型类型分组标题(对齐 Uniapp ModelList.vue type 0-5) */
const MODEL_TYPE_TITLES: Readonly<Record<number, string>> = {
  0: '全能',
  1: '对话',
  2: '图片',
  3: '视频',
  4: '音频',
  5: '数字人',
}

/** 单个模型条目 */
export interface ModelListItem {
  id: string
  name: string
  description: string
  icon: string
  isFree: boolean
  /** NEW 角标(对齐 Uniapp is_new == 1) */
  isNew?: boolean
  /** 置顶标记(对齐 Uniapp is_top,组内排序置顶) */
  isTop?: boolean
  /** 模型类型(0 其他/1 对话/2 图片/3 视频/4 音频/5 数字人) */
  type?: number
}

/** 模型分组(legacy 按 vendor,现支持按 type 分组标题) */
export interface ModelListGroup {
  /** 旧字段:vendor 分组名(无 type/title 时作为分组标题回退) */
  vendor?: string
  /** 类型分组标题(0-5,优先于 vendor 显示) */
  type?: number
  /** 自定义分组标题(最高优先级) */
  title?: string
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
  /** Agent 模式选项(对齐 Uniapp showAgentMode,可选) */
  showAgentMode?: boolean
  /** Agent 模式选中态(对齐 Uniapp pitch === -1) */
  agentModeSelected?: boolean
  /** 点击 Agent 模式(对齐 Uniapp agent-mode-click,可选) */
  onAgentModeClick?: () => void
  /** 逐项 slideUp 入场动画(对齐 Uniapp slideUp,默认开启) */
  animateEntrance?: boolean
}

function resolveTitle(group: ModelListGroup): string {
  if (group.title) return group.title
  if (group.type !== undefined && group.type !== null) {
    const typed = MODEL_TYPE_TITLES[group.type]
    if (typed) return typed
  }
  return group.vendor ?? '其他'
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

function Check(): React.ReactElement {
  return (
    <View style={styles.check}>
      <Text style={styles.checkText}>✓</Text>
    </View>
  )
}

function Row({
  item,
  index,
  total,
  selected,
  animate,
  onPress,
}: {
  item: ModelListItem
  index: number
  total: number
  selected: boolean
  animate: boolean
  onPress: () => void
}): React.ReactElement {
  const translateY = useRef(new Animated.Value(animate ? 12 : 0)).current
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current

  useEffect(() => {
    if (!animate) return
    // 反向 stagger(对齐 Uniapp animationDelay: (list.length - 1 - index) * 0.1s),封顶 8 步
    const delay = Math.max(0, Math.min(total - 1 - index, 8)) * 60
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 350, delay, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
    ]).start()
  }, [animate, index, total, translateY, opacity])

  const rankOne = index === 0

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        style={[styles.row, selected ? styles.rowSelected : null]}
        activeOpacity={0.7}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={item.name}
      >
        <View style={styles.iconWrap}>
          <Text style={styles.iconEmoji}>{item.icon}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            {rankOne ? (
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>TOP1</Text>
              </View>
            ) : null}
            {item.isNew ? (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            ) : null}
          </View>
          {item.description ? (
            <Text style={styles.description} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
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
        {selected ? <Check /> : null}
      </TouchableOpacity>
    </Animated.View>
  )
}

function AgentModeRow({
  selected,
  onPress,
}: {
  selected: boolean
  onPress?: () => void
}): React.ReactElement {
  return (
    <TouchableOpacity
      style={[styles.row, selected ? styles.rowSelected : null]}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel="Agent模式"
    >
      <View style={styles.iconWrap}>
        <Text style={styles.iconEmoji}>🤖</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>Agent模式</Text>
      </View>
      {selected ? <Check /> : null}
    </TouchableOpacity>
  )
}

export default function ModelList({
  groups,
  selectionMode = 'single',
  selectedIds = [],
  onSelectChange,
  onEndReached,
  showAgentMode = false,
  agentModeSelected = false,
  onAgentModeClick,
  animateEntrance = true,
}: ModelListProps): React.ReactElement {
  const selectedSet = new Set(selectedIds)

  /** 列表分组 section 数据(组内按 isTop 排序,RN SectionList 要求 data 字段为 ItemT[]) */
  const sections: SectionListData<ModelListItem, { title: string }>[] = groups
    .filter((g) => g.models.length > 0)
    .map((g) => {
      const models = [...g.models].sort((a, b) => (b.isTop ? 1 : 0) - (a.isTop ? 1 : 0))
      return { title: resolveTitle(g), data: models }
    })

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

  const renderItem: SectionListRenderItem<ModelListItem, { title: string }> = ({
    item,
    index,
    section,
  }) => (
    <Row
      item={item}
      index={index}
      total={section.data.length}
      selected={selectedSet.has(item.id)}
      animate={animateEntrance}
      onPress={() => handlePress(item.id)}
    />
  )

  const renderSectionHeader = ({
    section,
  }: {
    section: SectionListData<ModelListItem, { title: string }>
  }): React.ReactElement => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  )

  const renderAgentHeader = showAgentMode
    ? (): React.ReactElement => (
        <AgentModeRow selected={agentModeSelected} onPress={onAgentModeClick} />
      )
    : undefined

  return (
    <SectionList<ModelListItem, { title: string }>
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={renderAgentHeader}
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
  rowSelected: {
    backgroundColor: tokens.surface.card,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
    flexShrink: 1,
  },
  description: {
    fontSize: 12,
    color: tokens.text.secondary,
    marginTop: 2,
  },
  rankBadge: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: RANK_GOLD_BG,
  },
  rankBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: RANK_GOLD_TEXT,
    lineHeight: 12,
  },
  newBadge: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: tokens.danger.DEFAULT,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: tokens.surface.light,
    lineHeight: 12,
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
    borderRadius: 10,
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
