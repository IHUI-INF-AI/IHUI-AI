/**
 * MaterialList 素材列表 (mobile-rn 端)
 *
 * 用途:AI 生成的图片 / 视频 / 文档素材展示,顶部分类 Tab 横条 +
 *      主体 2 列网格缩略图。
 *
 * 视觉规范:
 *   - 顶部分类 Tab:水平 ScrollView,chip 形,paddingHorizontal 12,
 *     paddingVertical 6,borderRadius 16;选中态 bgColor brand.DEFAULT +
 *     白字,未选 bgColor surface.muted + text.secondary。
 *   - 主体:FlatList numColumns=2,3:4 缩略图,卡片 8 圆角 + 1px 浅边框 +
 *     surface.card 背景。
 *   - 缩略图:高度按宽度 3:4 等比,surface.muted 背景,居中 emoji(图 / 视频 /
 *     文档分类)。
 *   - 底部:padding 8,标题 12px text.primary numberOfLines=1 +
 *     元数据 11px text.secondary。
 *
 * 约束:
 *   - 浅色优雅风,无霓虹/无渐变;系统字体,无 ttf;颜色全部用 rnLightTokens。
 *   - 触底加载用 useState + useEffect 双重护栏:避免 loading 状态下重入 +
 *     loading 翻 false 后再真正派发 onLoadMore。
 *   - 类型零 any,精确标注。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native'
import { useCallback, useEffect, useState } from 'react'

/** 素材类型(决定缩略图占位 emoji) */
export type MaterialType = 'image' | 'video' | 'doc'

/** 顶部分类 chip */
export interface MaterialCategory {
  key: string
  label: string
}

/** 单条素材 */
export interface MaterialItem {
  id: string
  title: string
  type: MaterialType
  /** 可选创建时间(ISO 字符串或本地化字符串均可) */
  createdAt?: string
}

export interface MaterialListProps {
  categories: MaterialCategory[]
  activeCategory: string
  onCategoryChange: (key: string) => void
  items: MaterialItem[]
  onPress?: (id: string) => void
  /** 触底回调;loading=true 时不重复触发 */
  onLoadMore?: () => void
  /** 父级声明当前是否正在分页加载(用于控制 onLoadMore 防重入) */
  loading?: boolean
}

const THUMB_RATIO = 4 / 3
const GRID_GAP = 8
const CONTAINER_PADDING = 12
const TAB_BAR_PADDING = 12
const TAB_GAP = 8

/** 类型 → 缩略图居中 emoji */
const TYPE_EMOJI: Record<MaterialType, string> = {
  image: '🖼️',
  video: '🎬',
  doc: '📄',
}

/** 类型 → 列表底部元数据文字 */
const TYPE_META: Record<MaterialType, string> = {
  image: '图片',
  video: '视频',
  doc: '文档',
}

function keyExtractor(item: MaterialItem): string {
  return item.id
}

function MaterialCard({
  item,
  onPress,
}: {
  item: MaterialItem
  onPress?: (id: string) => void
}): React.JSX.Element {
  const emoji = TYPE_EMOJI[item.type]
  const meta = item.createdAt ? `${TYPE_META[item.type]} · ${item.createdAt}` : TYPE_META[item.type]

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress?.(item.id)}
      style={styles.card}
    >
      <View style={styles.thumb}>
        <Text style={styles.thumbEmoji}>{emoji}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

export default function MaterialList({
  categories,
  activeCategory,
  onCategoryChange,
  items,
  onPress,
  onLoadMore,
  loading = false,
}: MaterialListProps): React.JSX.Element {
  /** 触底触发标记:仅当 useEffect 看到 trigger=true 且 loading 翻 false 才真正派发回调 */
  const [endReachedTrigger, setEndReachedTrigger] = useState<boolean>(false)

  const handleEndReached = useCallback((): void => {
    if (loading || !onLoadMore) return
    setEndReachedTrigger(true)
  }, [loading, onLoadMore])

  useEffect(() => {
    if (endReachedTrigger && !loading) {
      onLoadMore?.()
      setEndReachedTrigger(false)
    }
  }, [endReachedTrigger, loading, onLoadMore])

  const renderItem: ListRenderItem<MaterialItem> = useCallback(
    ({ item }) => <MaterialCard item={item} onPress={onPress} />,
    [onPress],
  )

  return (
    <View style={styles.root}>
      {/* 顶部分类 Tab 横条 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {categories.map((cat) => {
          const isActive = cat.key === activeCategory
          return (
            <TouchableOpacity
              key={cat.key}
              activeOpacity={0.7}
              onPress={() => onCategoryChange(cat.key)}
              style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
            >
              <Text style={isActive ? styles.chipTextActive : styles.chipTextInactive}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* 主体 2 列网格 */}
      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  },
  tabBar: {
    paddingHorizontal: TAB_BAR_PADDING,
    paddingVertical: 10,
    gap: TAB_GAP,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipActive: {
    backgroundColor: tokens.brand.DEFAULT,
  },
  chipInactive: {
    backgroundColor: tokens.surface.muted,
  },
  chipTextActive: {
    fontSize: 13,
    color: tokens.surface.light,
    fontWeight: '500',
  },
  chipTextInactive: {
    fontSize: 13,
    color: tokens.text.secondary,
  },
  gridContent: {
    paddingHorizontal: CONTAINER_PADDING,
    paddingBottom: 12,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  card: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.border.light,
  },
  thumb: {
    width: '100%',
    aspectRatio: THUMB_RATIO,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: {
    fontSize: 36,
  },
  info: {
    padding: 8,
  },
  title: {
    fontSize: 12,
    color: tokens.text.primary,
    fontWeight: '500',
  },
  meta: {
    marginTop: 2,
    fontSize: 11,
    color: tokens.text.secondary,
  },
})
