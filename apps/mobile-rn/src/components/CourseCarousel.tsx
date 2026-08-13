/**
 * CourseCarousel 课程轮播卡片 (mobile-rn 端)
 *
 * 3 变体(对齐历史 Uniapp 项目):
 * - index(默认):横向滚动课程卡片(banner 式,FlatList horizontal)
 * - UpToDate:最新课程(2 列网格 + 分类标签 + 课时 + VIP/价格徽章)
 * - list:课程列表(标签页切换:入门/精选,纵向列表)
 *
 * 对齐历史项目:
 * - index.vue( swiper banner)→ variant='index'
 * - UpToDate.vue(2 列网格)→ variant='UpToDate'
 * - list.vue(标签页 + 列表)→ variant='list'
 *
 * 设计规范:
 *   - index 卡片:240 × 160(固定),圆角 8
 *   - UpToDate 卡片:2 列等宽,圆角 12,图片占主体
 *   - list 卡片:纵向全宽,圆角 12
 *   - 浅色优雅风,颜色全部使用 rnLightTokens,严禁硬编码
 *   - 系统字体,无 ttf
 */
import { useState } from 'react'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native'

/** 单门课程数据(对齐原项目 PopularCourses 关键字段的子集) */
export interface CourseCarouselItem {
  id: string
  title: string
  /** 价格(元);与 isFree 同时为 true 时,优先显示"免费" */
  price: number
  /** 是否免费课程(免费优先于 price 显示) */
  isFree?: boolean
  /** 顶部缩略图占位的 emoji 图标(无图时回退 📘,index 变体使用) */
  icon?: string
  /** 缩略图 URL(UpToDate/list 变体优先使用,替代 emoji 占位) */
  img?: string
  /** 分类标签(UpToDate 变体:左上角覆盖标签) */
  classification?: string
  /** 课时数(UpToDate 变体:右下角覆盖标签) */
  classHour?: number
  /** 课程类型:1=VIP可看,2=付费可看(UpToDate 变体:VIP/价格徽章) */
  type?: 1 | 2
}

/** 课程轮播变体 */
export type CourseCarouselVariant = 'index' | 'UpToDate' | 'list'

export interface CourseCarouselProps {
  courses: CourseCarouselItem[]
  onPress?: (id: string) => void
  /** 变体选择,默认 'index' */
  variant?: CourseCarouselVariant
  /** list 变体:第二个标签页的课程列表(入门课程在 courses,精选课程在 courses2) */
  courses2?: CourseCarouselItem[]
  /** list 变体:标签页标题(默认 ['爆款入门课程', '爆款精选课程']) */
  tabLabels?: readonly [string, string]
}

// ===== 共享常量 =====

const CARD_WIDTH = 240
const CARD_HEIGHT = 144
const CARD_GAP = 12
const CONTAINER_PADDING = 16
const THUMB_HEIGHT_RATIO = 0.8
const DEFAULT_ICON = '📘'
const GRID_GAP = 12
const GRID_PADDING = 16

function keyExtractor(item: CourseCarouselItem): string {
  return item.id
}

// ===== index 变体(横向 banner 轮播)=====

function CourseCard({
  item,
  onPress,
}: {
  item: CourseCarouselItem
  onPress?: (id: string) => void
}): React.JSX.Element {
  const showFree = item.isFree ?? false
  const thumbHeight = Math.round(CARD_HEIGHT * THUMB_HEIGHT_RATIO)
  const infoHeight = CARD_HEIGHT - thumbHeight

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress?.(item.id)}
      style={indexStyles.card}
    >
      {/* 顶部缩略图占位 */}
      <View style={[indexStyles.thumb, { height: thumbHeight }]}>
        <Text style={indexStyles.thumbIcon}>{item.icon ?? DEFAULT_ICON}</Text>
      </View>

      {/* 底部信息区 */}
      <View style={[indexStyles.info, { height: infoHeight }]}>
        <Text style={indexStyles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={indexStyles.priceRow}>
          {showFree ? (
            <Text style={indexStyles.priceFree}>免费</Text>
          ) : (
            <Text style={indexStyles.pricePaid}>¥{item.price}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

function IndexCarousel({
  courses,
  onPress,
}: {
  courses: CourseCarouselItem[]
  onPress?: (id: string) => void
}): React.JSX.Element {
  const renderItem: ListRenderItem<CourseCarouselItem> = ({ item }) => (
    <CourseCard item={item} onPress={onPress} />
  )

  return (
    <FlatList
      data={courses}
      horizontal
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={indexStyles.listContent}
      ItemSeparatorComponent={IndexSeparator}
    />
  )
}

function IndexSeparator(): React.JSX.Element {
  return <View style={{ width: CARD_GAP }} />
}

const indexStyles = StyleSheet.create({
  listContent: {
    paddingHorizontal: CONTAINER_PADDING,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.light,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: {
    fontSize: 36,
  },
  info: {
    width: '100%',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceFree: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.success.DEFAULT,
  },
  pricePaid: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.text.primary,
  },
})

// ===== UpToDate 变体(2 列网格 + 分类/课时/VIP 徽章)=====

function UpToDateCard({
  item,
  onPress,
}: {
  item: CourseCarouselItem
  onPress?: (id: string) => void
}): React.JSX.Element {
  const isVipCourse = item.type === 1
  const isPaidCourse = item.type === 2

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress?.(item.id)}
      style={uptodateStyles.card}
    >
      {/* 缩略图区(带分类/课时覆盖标签) */}
      <View style={uptodateStyles.thumbWrap}>
        {item.img ? (
          <Image source={{ uri: item.img }} style={uptodateStyles.thumbImg} resizeMode="cover" />
        ) : (
          <View style={uptodateStyles.thumbPlaceholder}>
            <Text style={uptodateStyles.thumbIcon}>{item.icon ?? DEFAULT_ICON}</Text>
          </View>
        )}

        {/* 左上角:分类标签 */}
        {item.classification ? (
          <View style={uptodateStyles.classificationTag}>
            <Text style={uptodateStyles.classificationText}>{item.classification}</Text>
          </View>
        ) : null}

        {/* 右下角:课时标签 */}
        {item.classHour ? (
          <View style={uptodateStyles.classHourTag}>
            <Text style={uptodateStyles.classHourText}>{item.classHour}课时</Text>
          </View>
        ) : null}
      </View>

      {/* 标题 */}
      <Text style={uptodateStyles.title} numberOfLines={2}>
        {item.title}
      </Text>

      {/* VIP/价格徽章行 */}
      <View style={uptodateStyles.badgeRow}>
        {isVipCourse ? (
          <View style={uptodateStyles.vipBadge}>
            <Text style={uptodateStyles.vipText}>VIP可看</Text>
          </View>
        ) : isPaidCourse ? (
          <View style={uptodateStyles.paidBadgeWrap}>
            <View style={uptodateStyles.paidBadge}>
              <Text style={uptodateStyles.paidText}>付费可看</Text>
            </View>
            <Text style={uptodateStyles.priceText}>¥{item.price}</Text>
          </View>
        ) : item.isFree ? (
          <Text style={uptodateStyles.freeText}>免费</Text>
        ) : (
          <Text style={uptodateStyles.priceText}>¥{item.price}</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

function UpToDateCarousel({
  courses,
  onPress,
}: {
  courses: CourseCarouselItem[]
  onPress?: (id: string) => void
}): React.JSX.Element {
  const renderItem: ListRenderItem<CourseCarouselItem> = ({ item }) => (
    <UpToDateCard item={item} onPress={onPress} />
  )

  return (
    <FlatList
      data={courses}
      numColumns={2}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      scrollEnabled={false}
      contentContainerStyle={uptodateStyles.listContent}
      columnWrapperStyle={uptodateStyles.row}
      ItemSeparatorComponent={UpToDateSeparator}
    />
  )
}

function UpToDateSeparator(): React.JSX.Element {
  return <View style={{ height: GRID_GAP }} />
}

const uptodateStyles = StyleSheet.create({
  listContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 8,
  },
  row: {
    gap: GRID_GAP,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.light,
    overflow: 'hidden',
  },
  thumbWrap: {
    width: '100%',
    height: 120,
    backgroundColor: tokens.surface.muted,
    position: 'relative',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: {
    fontSize: 32,
  },
  classificationTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  classificationText: {
    fontSize: 11,
    color: tokens.surface.light,
  },
  classHourTag: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  classHourText: {
    fontSize: 11,
    color: tokens.surface.light,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.text.primary,
    marginTop: 8,
    marginHorizontal: 8,
    minHeight: 36,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  vipBadge: {
    backgroundColor: tokens.warning.light,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  vipText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.warning.DEFAULT,
  },
  paidBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paidBadge: {
    backgroundColor: tokens.error.bg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
  },
  paidText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.error.text,
  },
  freeText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.success.DEFAULT,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.text.primary,
  },
})

// ===== list 变体(标签页 + 纵向列表)=====

function ListCard({
  item,
  onPress,
}: {
  item: CourseCarouselItem
  onPress?: (id: string) => void
}): React.JSX.Element {
  const showFree = item.isFree ?? false

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress?.(item.id)}
      style={listStyles.card}
    >
      {/* 左侧缩略图 */}
      <View style={listStyles.thumbWrap}>
        {item.img ? (
          <Image source={{ uri: item.img }} style={listStyles.thumbImg} resizeMode="cover" />
        ) : (
          <View style={listStyles.thumbPlaceholder}>
            <Text style={listStyles.thumbIcon}>{item.icon ?? DEFAULT_ICON}</Text>
          </View>
        )}
      </View>

      {/* 右侧信息 */}
      <View style={listStyles.infoWrap}>
        <Text style={listStyles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={listStyles.priceRow}>
          {showFree ? (
            <Text style={listStyles.priceFree}>免费</Text>
          ) : (
            <Text style={listStyles.pricePaid}>¥{item.price}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

function ListCarousel({
  courses,
  courses2,
  onPress,
  tabLabels,
}: {
  courses: CourseCarouselItem[]
  courses2?: CourseCarouselItem[]
  onPress?: (id: string) => void
  tabLabels: readonly [string, string]
}): React.JSX.Element {
  const [selectedTab, setSelectedTab] = useState<0 | 1>(0)
  const list = selectedTab === 0 ? courses : (courses2 ?? [])

  const renderItem: ListRenderItem<CourseCarouselItem> = ({ item }) => (
    <ListCard item={item} onPress={onPress} />
  )

  return (
    <View style={listStyles.container}>
      {/* 标签页头部 */}
      <View style={listStyles.tabBar}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setSelectedTab(0)}
          style={[listStyles.tabItem, selectedTab === 0 ? listStyles.tabItemActive : null]}
        >
          <Text
            style={[
              listStyles.tabText,
              selectedTab === 0 ? listStyles.tabTextActive : null,
            ]}
          >
            {tabLabels[0]}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setSelectedTab(1)}
          style={[listStyles.tabItem, selectedTab === 1 ? listStyles.tabItemActive : null]}
        >
          <Text
            style={[
              listStyles.tabText,
              selectedTab === 1 ? listStyles.tabTextActive : null,
            ]}
          >
            {tabLabels[1]}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 课程列表 */}
      <FlatList
        data={list}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        scrollEnabled={false}
        contentContainerStyle={listStyles.listContent}
        ItemSeparatorComponent={ListSeparator}
      />
    </View>
  )
}

function ListSeparator(): React.JSX.Element {
  return <View style={{ height: CARD_GAP }} />
}

const listStyles = StyleSheet.create({
  container: {
    paddingHorizontal: GRID_PADDING,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: tokens.surface.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: tokens.indigo.DEFAULT,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.text.tertiary,
  },
  tabTextActive: {
    color: tokens.surface.light,
  },
  listContent: {
    paddingBottom: 8,
  },
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.light,
    overflow: 'hidden',
  },
  thumbWrap: {
    width: 100,
    height: 80,
    backgroundColor: tokens.surface.muted,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: {
    fontSize: 28,
  },
  infoWrap: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceFree: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.success.DEFAULT,
  },
  pricePaid: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.text.primary,
  },
})

// ===== 主组件(变体分发)=====

const DEFAULT_TAB_LABELS = ['爆款入门课程', '爆款精选课程'] as const

function CourseCarousel({
  courses,
  onPress,
  variant = 'index',
  courses2,
  tabLabels,
}: CourseCarouselProps): React.JSX.Element {
  if (variant === 'UpToDate') {
    return <UpToDateCarousel courses={courses} onPress={onPress} />
  }
  if (variant === 'list') {
    return (
      <ListCarousel
        courses={courses}
        courses2={courses2}
        onPress={onPress}
        tabLabels={tabLabels ?? DEFAULT_TAB_LABELS}
      />
    )
  }
  return <IndexCarousel courses={courses} onPress={onPress} />
}

export default CourseCarousel
