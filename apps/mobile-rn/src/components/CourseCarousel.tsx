/**
 * CourseCarousel 课程轮播卡片 (mobile-rn 端)
 *
 * 横向滚动课程卡片列表,卡片结构:
 *   - 顶部缩略图(占位 View,80% 高度,surface.muted 背景,中心放 emoji 图标)
 *   - 底部信息区(标题 + 价格行:免费 / ¥xx)
 *
 * 对齐历史项目 CourseCarousel + PopularCourses 的"小卡片横向轮播"形态。
 * 与 miniapp-taro 端 LessonListItem(variant='carousel')共享视觉特征,
 * 但 mobile-rn 端采用独立实现(FlatList horizontal,RN 体系)。
 *
 * 设计规范:
 *   - 卡片尺寸:240 × 160(固定)
 *   - 卡片间距 12,paddingHorizontal 16
 *   - 浅色优雅风,borderRadius 8,border 1px border.light
 *   - 系统字体,无 ttf
 *   - 颜色全部使用 rnLightTokens,严禁硬编码
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { FlatList, StyleSheet, Text, TouchableOpacity, View, type ListRenderItem } from 'react-native'

/** 单门课程数据(对齐原项目 PopularCourses 关键字段的子集) */
export interface CourseCarouselItem {
  id: string
  title: string
  /** 价格(元);与 isFree 同时为 true 时,优先显示"免费" */
  price: number
  /** 是否免费课程(免费优先于 price 显示) */
  isFree?: boolean
  /** 顶部缩略图占位的 emoji 图标(无图时回退 📘) */
  icon?: string
}

export interface CourseCarouselProps {
  courses: CourseCarouselItem[]
  onPress?: (id: string) => void
}

const CARD_WIDTH = 240
const CARD_HEIGHT = 160
const CARD_GAP = 12
const CONTAINER_PADDING = 16
const THUMB_HEIGHT_RATIO = 0.8
const DEFAULT_ICON = '📘'

function keyExtractor(item: CourseCarouselItem): string {
  return item.id
}

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
      style={styles.card}
    >
      {/* 顶部缩略图占位 */}
      <View style={[styles.thumb, { height: thumbHeight }]}>
        <Text style={styles.thumbIcon}>{item.icon ?? DEFAULT_ICON}</Text>
      </View>

      {/* 底部信息区 */}
      <View style={[styles.info, { height: infoHeight }]}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.priceRow}>
          {showFree ? (
            <Text style={styles.priceFree}>免费</Text>
          ) : (
            <Text style={styles.pricePaid}>¥{item.price}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

function CourseCarousel({ courses, onPress }: CourseCarouselProps): React.JSX.Element {
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
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={Separator}
    />
  )
}

function Separator(): React.JSX.Element {
  return <View style={{ width: CARD_GAP }} />
}

export default CourseCarousel

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: CONTAINER_PADDING,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
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
