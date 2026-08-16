/**
 * MaterialList 素材列表 (mobile-rn 端)
 *
 * 1:1 复刻 uniapp src/components/MaterialList.vue 结构:
 *   - 标题头「我的创作」
 *   - 分类 Tab(文本 / 图片 / 视频 / 音频,由 categories prop 驱动,向后兼容 all/doc)
 *   - 单列列表:文本带 30 字预览;图片/视频真实缩略图(Image uri);音频/文档用图标
 *   - 空态 + 分页提示(loading → 加载中…;!hasMore 且列表非空 → 没有更多了)
 *
 * 视觉规范(rpx→dp 2:1):
 *   - 标题头 16 / 行标题 14 / 预览 12 / 时间 11 / tab 13
 *   - 缩略图 50×50(原 100rpx),圆角 4
 *   - 颜色全部走 rnLightTokens:选中 tab = brand 黑底白字;禁用 purple/indigo
 *   - 触底加载用 useState + useEffect 双重护栏:避免 loading 重入 + 翻 false 后才真正派发
 *   - 类型零 any
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { FileText, Image as ImageIcon, Music, Video } from 'lucide-react-native'
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native'
import { useCallback, useEffect, useState } from 'react'

/** 素材类型(文本/图片/视频/音频;doc 保留向后兼容,供 AigcList/Assistant 屏使用) */
export type MaterialType = 'text' | 'image' | 'video' | 'audio' | 'doc'

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
  /** 缩略图 URL(图片/视频展示真实缩略图;音频/文档忽略) */
  url?: string
  /** 文本内容(文本 tab 展示 30 字预览) */
  text?: string
  /** 创建时间 */
  createdAt?: string
}

export interface MaterialListProps {
  categories: MaterialCategory[]
  activeCategory: string
  onCategoryChange: (key: string) => void
  items: MaterialItem[]
  onPress?: (id: string) => void
  /** 触底回调;loading=true 或 hasMore=false 时不重复触发 */
  onLoadMore?: () => void
  /** 父级声明当前是否正在分页加载 */
  loading?: boolean
  /** 是否还有更多分页数据;false 且列表非空时显示「没有更多了」 */
  hasMore?: boolean
}

/** 文本预览截断长度(对齐原版 slice(0, 30)) */
const PREVIEW_LEN = 30

function keyExtractor(item: MaterialItem): string {
  return item.id
}

/** 文本 30 字预览,超出补省略号 */
function previewText(text?: string): string {
  const s = text ?? ''
  return s.length > PREVIEW_LEN ? `${s.slice(0, PREVIEW_LEN)}...` : s
}

/** 类型 → 默认标题(对齐原版) */
function defaultTitleForType(type: MaterialType): string {
  switch (type) {
    case 'text':
      return '文本内容'
    case 'image':
      return '图片内容'
    case 'video':
      return '视频内容'
    case 'audio':
      return '音频内容'
    default:
      return '素材内容'
  }
}

/** 分类 → 空态文案(对齐原版 per-tab 空态) */
function emptyTextForCategory(key: string): string {
  switch (key) {
    case 'text':
      return '暂无文本内容'
    case 'image':
      return '暂无图片内容'
    case 'video':
      return '暂无视频内容'
    case 'audio':
      return '暂无音频内容'
    default:
      return '暂无内容'
  }
}

/** 单行素材:文本带预览,图片/视频带真实缩略图,音频/文档带图标 */
function MaterialRow({
  item,
  onPress,
}: {
  item: MaterialItem
  onPress?: (id: string) => void
}): React.JSX.Element {
  const title = item.title || defaultTitleForType(item.type)
  const time = item.createdAt ?? ''

  // 文本:标题 + 时间 + 30 字预览(无缩略图)
  if (item.type === 'text') {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => onPress?.(item.id)} style={styles.row}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          {time ? <Text style={styles.rowTime}>{time}</Text> : null}
        </View>
        <Text style={styles.rowPreview} numberOfLines={1}>
          {previewText(item.text)}
        </Text>
      </TouchableOpacity>
    )
  }

  // 图片/视频:有 url 用真实缩略图,否则占位图标;音频/文档:图标
  const thumb =
    (item.type === 'image' || item.type === 'video') && item.url ? (
      <Image source={{ uri: item.url }} style={styles.thumb} resizeMode="cover" />
    ) : (
      <View style={[styles.thumb, styles.thumbPlaceholder]}>
        {item.type === 'audio' ? (
          <Music size={22} color={tokens.text.tertiary} strokeWidth={1.5} />
        ) : item.type === 'video' ? (
          <Video size={22} color={tokens.text.tertiary} strokeWidth={1.5} />
        ) : item.type === 'image' ? (
          <ImageIcon size={22} color={tokens.text.tertiary} strokeWidth={1.5} />
        ) : (
          <FileText size={22} color={tokens.text.tertiary} strokeWidth={1.5} />
        )}
      </View>
    )

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress?.(item.id)}
      style={[styles.row, styles.rowWithThumb]}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {time ? <Text style={styles.rowTime}>{time}</Text> : null}
      </View>
      {thumb}
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
  hasMore = true,
}: MaterialListProps): React.JSX.Element {
  /** 触底触发标记:仅当 useEffect 看到 trigger=true 且 loading 翻 false 才真正派发回调 */
  const [endReachedTrigger, setEndReachedTrigger] = useState<boolean>(false)

  const handleEndReached = useCallback((): void => {
    if (loading || !onLoadMore || !hasMore) return
    setEndReachedTrigger(true)
  }, [loading, onLoadMore, hasMore])

  useEffect(() => {
    if (endReachedTrigger && !loading) {
      onLoadMore?.()
      setEndReachedTrigger(false)
    }
  }, [endReachedTrigger, loading, onLoadMore])

  const renderItem: ListRenderItem<MaterialItem> = useCallback(
    ({ item }) => <MaterialRow item={item} onPress={onPress} />,
    [onPress],
  )

  const emptyText = emptyTextForCategory(activeCategory)

  const footer = loading ? (
    <View style={styles.footer}>
      <Text style={styles.loadingMore}>加载中...</Text>
    </View>
  ) : !hasMore && items.length > 0 ? (
    <View style={styles.footer}>
      <Text style={styles.noMore}>没有更多了</Text>
    </View>
  ) : null

  return (
    <View style={styles.root}>
      {/* 标题头(对齐原版 material-header) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的创作</Text>
      </View>

      {/* 分类 tab(对齐原版 material-tabs,由 categories 驱动) */}
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

      {/* 单列列表(对齐原版 scroll-view 单列) */}
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>{emptyText}</Text> : null}
        ListFooterComponent={footer}
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
  header: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border.light,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  tabBar: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
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
    fontWeight: '600',
  },
  chipTextInactive: {
    fontSize: 13,
    color: tokens.text.secondary,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 12,
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border.light,
  },
  rowWithThumb: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 10,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  rowTime: {
    flexShrink: 0,
    marginLeft: 6,
    fontSize: 11,
    color: tokens.text.tertiary,
  },
  rowPreview: {
    marginTop: 3,
    fontSize: 12,
    color: tokens.text.secondary,
  },
  thumb: {
    width: 50,
    height: 50,
    borderRadius: 4,
    backgroundColor: tokens.surface.muted,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingVertical: 30,
    textAlign: 'center',
    fontSize: 14,
    color: tokens.text.tertiary,
  },
  footer: {
    paddingVertical: 10,
  },
  loadingMore: {
    textAlign: 'center',
    fontSize: 13,
    color: tokens.text.secondary,
  },
  noMore: {
    textAlign: 'center',
    fontSize: 13,
    color: tokens.text.tertiary,
  },
})
