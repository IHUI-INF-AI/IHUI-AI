/**
 * PopularCourses 热门课程列表 (mobile-rn 端)
 *
 * 对齐历史项目 PopularCourses/index.vue(标题 + 查看全部 + 双 tab + 课程列表):
 * - 标题栏:左侧标题/副标题,右侧「查看全部」入口(popular-courses-more,onMore)
 * - 双 Tab:爆款入门 / 爆款精选(popular-courses-tab,selectedTab 驱动列表切换)
 * - 纵向 2 列网格课程列表,卡片包含:缩略图 + VIP 角标 + 标题 + 讲师行 + 价格行。
 *   vertical 模式用于首页/分类页热门区。
 *
 * 设计规范:
 *   - 容器:paddingHorizontal 16,paddingTop 8(头部区),无强制底部分隔
 *   - 网格:FlatList numColumns=2,ItemSeparatorComponent 行/列间距 8
 *   - 卡片宽:(屏宽 - 16*2 - 8) / 2,用 useWindowDimensions 自适应
 *   - 缩略图:100% × 100,borderRadius 8,bgColor surface.muted,居中 emoji 📚 32pt
 *   - VIP 角标:absolute top-right,8px 圆角,brand.DEFAULT bg,白字 10/600
 *   - 文字:标题 14/600,讲师/价格行沿用项目浅色优雅风
 *   - 系统字体,无 ttf;颜色全部使用 rnLightTokens(禁用 purple/indigo)
 *   - 禁止硬编码颜色/尺寸,类型零 any
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ListRenderItem,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

/** 单门课程数据(对齐历史 PopularCourses 关键字段) */
export interface PopularCourse {
  id: string
  title: string
  /** 讲师姓名(将取首字母作为头像占位) */
  instructor: string
  /** 课时数 */
  lessons: number
  /** 价格(元);isFree=true 时该值忽略 */
  price: number
  /** 是否免费课程(免费优先于 price 显示) */
  isFree: boolean
  /** 是否 VIP 课程(决定是否渲染右上角 VIP 角标) */
  isVip: boolean
  /** 学习人数(显示在价格行右侧) */
  studentCount: number
}

export interface PopularCoursesProps {
  courses: PopularCourse[]
  onPress?: (id: string) => void
  title?: string
  subtitle?: string
  /** 「查看全部」回调(对齐原项目 popular-courses-more);未传入则不渲染入口 */
  onMore?: () => void
  /** 「查看全部」文案(对齐原项目,默认「查看全部」) */
  moreText?: string
  /** 「爆款精选」Tab 列表(对齐原项目 CourseList2);缺省时精选 Tab 复用 courses */
  featuredCourses?: PopularCourse[]
  /** Tab 切换回调(对齐原项目 handleTabClick) */
  onTabChange?: (index: number) => void
}

const CONTAINER_PADDING = 16
const GRID_GAP = 8
const THUMB_HEIGHT = 100
const VIP_BADGE_PADDING = 4
const DEFAULT_BOOK_ICON = '📚'
const DEFAULT_MORE_TEXT = '查看全部'

/** 双 Tab(对齐原项目 popular-courses-tab:爆款入门 / 爆款精选) */
const COURSE_TABS: ReadonlyArray<string> = ['爆款入门', '爆款精选']

/** 取字符串首字符(中英文/表情兼容);空串回退 ? */
function firstChar(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length === 0) return '?'
  return trimmed.slice(0, 1)
}

function keyExtractor(item: PopularCourse): string {
  return item.id
}

interface CourseCardProps {
  item: PopularCourse
  width: number
  onPress?: (id: string) => void
}

function CourseCard({ item, width, onPress }: CourseCardProps): React.JSX.Element {
  const showFree = item.isFree
  const showVip = item.isVip
  const instructorInitial = firstChar(item.instructor).toUpperCase()

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress?.(item.id)}
      style={[styles.card, { width }]}
    >
      {/* 缩略图区 + VIP 角标 */}
      <View style={styles.thumb}>
        <Text style={styles.thumbIcon}>{DEFAULT_BOOK_ICON}</Text>
        {showVip ? (
          <View style={styles.vipBadge}>
            <Text style={styles.vipBadgeText}>VIP</Text>
          </View>
        ) : null}
      </View>

      {/* 文字区 */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>

        {/* 讲师行:头像 + 讲师名 + 课时数 */}
        <View style={styles.instructorRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{instructorInitial}</Text>
          </View>
          <Text style={styles.instructorName} numberOfLines={1}>
            {item.instructor}
          </Text>
          <Text style={styles.lessonCount} numberOfLines={1}>
            {`· ${item.lessons} 课时`}
          </Text>
        </View>

        {/* 价格行:价格 + 学习人数 */}
        <View style={styles.priceRow}>
          {showFree ? (
            <Text style={styles.priceFree}>免费</Text>
          ) : (
            <Text style={styles.pricePaid}>¥{item.price}</Text>
          )}
          <Text style={styles.studentCount} numberOfLines={1}>
            {`${item.studentCount} 人在学`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function PopularCourses({
  courses,
  onPress,
  title,
  subtitle,
  onMore,
  moreText = DEFAULT_MORE_TEXT,
  featuredCourses,
  onTabChange,
}: PopularCoursesProps): React.JSX.Element {
  const { width: screenWidth } = useWindowDimensions()
  const cardWidth = (screenWidth - CONTAINER_PADDING * 2 - GRID_GAP) / 2
  const hasHeader = Boolean(title) || Boolean(subtitle) || Boolean(onMore)

  const [selectedTab, setSelectedTab] = useState(0)
  // 入门 Tab 用 courses;精选 Tab 优先 featuredCourses,缺省复用 courses(向后兼容单列表调用方)
  const activeCourses = selectedTab === 0 ? courses : (featuredCourses ?? courses)

  const handleTabPress = (idx: number) => {
    setSelectedTab(idx)
    onTabChange?.(idx)
  }

  const renderItem: ListRenderItem<PopularCourse> = ({ item }) => (
    <CourseCard item={item} width={cardWidth} onPress={onPress} />
  )

  return (
    <View style={styles.container}>
      {hasHeader ? (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {title ? <Text style={styles.headerTitle}>{title}</Text> : null}
            {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
          </View>
          {onMore ? (
            <Pressable
              style={({ pressed }) => [styles.moreBtn, pressed ? styles.moreBtnPressed : null]}
              onPress={onMore}
              accessibilityRole="button"
              accessibilityLabel={moreText}
            >
              <Text style={styles.moreText}>{moreText}</Text>
              <Text style={styles.moreArrow} allowFontScaling={false}>
                {'›'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* 双 Tab(对齐原项目 popular-courses-tab-box) */}
      <View style={styles.tabBox}>
        {COURSE_TABS.map((tab, idx) => (
          <Pressable
            key={tab}
            style={({ pressed }) => [styles.tabItem, pressed ? styles.tabItemPressed : null]}
            onPress={() => handleTabPress(idx)}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedTab === idx }}
            accessibilityLabel={tab}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === idx ? styles.tabTextActive : styles.tabTextNormal,
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={activeCourses}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.columnWrapper}
        ItemSeparatorComponent={Separator}
        scrollEnabled={false}
      />
    </View>
  )
}

function Separator(): React.JSX.Element {
  return <View style={styles.separator} />
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CONTAINER_PADDING,
    paddingTop: 8,
    paddingBottom: 4,
  } as ViewStyle,
  headerLeft: {
    flex: 1,
  } as ViewStyle,
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  headerSubtitle: {
    fontSize: 12,
    color: tokens.text.secondary,
    marginTop: 4,
  } as TextStyle,
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 2,
  } as ViewStyle,
  moreBtnPressed: {
    opacity: 0.6,
  } as ViewStyle,
  moreText: {
    fontSize: 12,
    color: tokens.text.secondary,
  } as TextStyle,
  moreArrow: {
    fontSize: 16,
    lineHeight: 18,
    color: tokens.text.secondary,
    marginLeft: 2,
  } as TextStyle,
  tabBox: {
    flexDirection: 'row',
    paddingHorizontal: CONTAINER_PADDING,
    gap: 16,
    paddingTop: 4,
    paddingBottom: 8,
  } as ViewStyle,
  tabItem: {
    paddingVertical: 4,
  } as ViewStyle,
  tabItemPressed: {
    opacity: 0.7,
  } as ViewStyle,
  tabText: {
    fontSize: 14,
  } as TextStyle,
  tabTextActive: {
    color: tokens.brand.DEFAULT,
    fontWeight: '700',
  } as TextStyle,
  tabTextNormal: {
    color: tokens.text.secondary,
  } as TextStyle,
  columnWrapper: {
    paddingHorizontal: CONTAINER_PADDING,
    gap: GRID_GAP,
  },
  separator: {
    height: GRID_GAP,
  },
  card: {
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: THUMB_HEIGHT,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: {
    fontSize: 32,
  },
  vipBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: VIP_BADGE_PADDING * 2,
    paddingVertical: VIP_BADGE_PADDING,
    backgroundColor: tokens.brand.DEFAULT,
    borderRadius: 12,
  },
  vipBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.surface.light,
  },
  info: {
    paddingTop: 8,
    paddingHorizontal: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  instructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  avatar: {
    width: 16,
    height: 16,
    borderRadius: 12,
    backgroundColor: tokens.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  instructorName: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  lessonCount: {
    fontSize: 12,
    color: tokens.text.tertiary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  pricePaid: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.success.DEFAULT,
  },
  priceFree: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.text.secondary,
  },
  studentCount: {
    fontSize: 11,
    color: tokens.text.tertiary,
  },
})
