/**
 * AgentList Agent 选择列表 (mobile-rn 端)
 *
 * 对齐历史项目 components/AgentList.vue(AI 助手选择浮层):
 * - chu-box 底部弹出容器(白底圆角 7.5dp + slideUp 动画 + maxHeight 70vh 内部滚动)
 * - 行:头像(20dp 圆角 4dp)+ 名称(14dp)+ isNew 徽章(右)
 * - 选中态:黑色描边(2dp)+ 选中圆点(16dp 黑底, bounceIn 动画)
 * - 底部:加载中... / 没有更多了
 * - 行高 40dp,行间距 2.5dp,边框 2dp #B9B9B9
 * - 浅色优雅风,无霓虹/无渐变;颜色走 @ihui/design-tokens 的 rnLightTokens。
 * - 类型零 any,精确标注。
 *
 * 平台特有:依赖 react-native Animated/ScrollView,不适合共享层。
 */
import { useEffect, useRef } from 'react'
import { Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

/** 单个 Agent 条目(对齐 Uniapp AgentListItem 核心字段) */
export interface AgentListItem {
  id: string
  name: string
  avatar?: string
  /** 新智能体徽章(对齐 Uniapp isNew,true 时行右侧显示 new 徽章) */
  isNew?: boolean
  /** P1-3 扩展字段(与 Ai-list_b 卡片流共用契约,保留兼容) */
  description?: string
  category?: string
  type?: string
  source?: string
  isCollect?: boolean
  isThumbs?: boolean
  collectCount?: number
  likeCount?: number
  usageCount?: number
  isHot?: boolean
  userNickname?: string
  userAvatar?: string
  prologue?: string
}

export interface AgentListProps {
  items: AgentListItem[]
  onItemClick: (id: string) => void
  /** 当前选中项 id(对齐 Uniapp agentPitch) */
  selectedId?: string
  /** 加载中(对齐 Uniapp isLoading,底部显示"加载中...") */
  isLoading?: boolean
  /** 是否还有更多(对齐 Uniapp hasMore,false 且列表非空时显示"没有更多了") */
  hasMore?: boolean
  /** 空态文案 */
  emptyText?: string
}

function keyExtractor(item: AgentListItem): string {
  return item.id
}

function Row({
  item,
  selected,
  onPress,
}: {
  item: AgentListItem
  selected: boolean
  onPress: () => void
}): React.JSX.Element {
  const scale = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    if (!selected) {
      scale.setValue(0.3)
      return
    }
    // bounceIn 动画(对齐 Uniapp selected-icon bounceIn 0.3s ease)
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start()
  }, [selected, scale])

  return (
    <TouchableOpacity
      style={[styles.row, selected ? styles.rowActive : null]}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={item.name}
    >
      <View style={styles.rowLeft}>
        <View style={styles.logoWrap}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.icon} resizeMode="cover" />
          ) : (
            <View style={[styles.icon, styles.iconFallback]}>
              <Text style={styles.iconFallbackText}>
                {item.name.trim().charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.text, selected ? styles.textActive : null]} numberOfLines={1}>
          {item.name}
        </Text>
        {item.isNew ? <Text style={styles.newBadge}>{'NEW'}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        {selected ? (
          <Animated.View style={[styles.selectedIcon, { transform: [{ scale }] }]}>
            <Text style={styles.selectedIconText}>✓</Text>
          </Animated.View>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

export default function AgentList({
  items,
  onItemClick,
  selectedId,
  isLoading = false,
  hasMore = true,
  emptyText = '暂无 Agent',
}: AgentListProps): React.JSX.Element {
  const slide = useRef(new Animated.Value(60)).current
  const opacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    // slideUp 动画(对齐 Uniapp slideUp 0.8s ease forwards)
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start()
  }, [slide, opacity])

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY: slide }] }]}>
      <View style={styles.inner}>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentBody}>
          {items.map((item) => (
            <Row
              key={keyExtractor(item)}
              item={item}
              selected={selectedId === item.id}
              onPress={() => onItemClick(item.id)}
            />
          ))}
          {isLoading ? <Text style={styles.loadingText}>{'加载中...'}</Text> : null}
          {!hasMore && items.length > 0 ? (
            <Text style={styles.noMoreText}>{'没有更多了'}</Text>
          ) : null}
          {items.length === 0 && !isLoading ? (
            <Text style={styles.emptyText}>{emptyText}</Text>
          ) : null}
        </ScrollView>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  inner: {
    width: '100%',
    borderRadius: 7.5,
    overflow: 'hidden',
  },
  content: {
    backgroundColor: tokens.surface.light,
    borderRadius: 7.5,
    maxHeight: '70%',
  },
  contentBody: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 40,
    borderRadius: 7.5,
    backgroundColor: tokens.surface.light,
    borderWidth: 2,
    borderColor: tokens.border.medium,
    marginVertical: 2.5,
    paddingHorizontal: 5,
  },
  rowActive: {
    borderColor: tokens.brand.DEFAULT,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoWrap: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  icon: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  iconFallback: {
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallbackText: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  text: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    marginLeft: 10,
    color: tokens.text.primary,
  },
  textActive: {
    fontWeight: '700',
  },
  newBadge: {
    fontSize: 9,
    color: tokens.surface.light,
    backgroundColor: tokens.danger.DEFAULT,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 6,
    overflow: 'hidden',
  },
  rowRight: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  selectedIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIconText: {
    color: tokens.surface.light,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  loadingText: {
    textAlign: 'center',
    paddingVertical: 10,
    fontSize: 13,
    color: tokens.text.secondary,
  },
  noMoreText: {
    textAlign: 'center',
    paddingVertical: 10,
    fontSize: 13,
    color: tokens.text.tertiary,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 13,
    color: tokens.text.tertiary,
  },
})
