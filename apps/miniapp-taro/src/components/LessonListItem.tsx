import { View, Text, Image } from '@tarojs/components'
import { useTt } from '@/i18n'
import './LessonListItem.css'

export interface LessonListItemData {
  id: string
  title: string
  duration?: string
  type?: 'video' | 'audio' | 'article' | 'live'
  isFree?: boolean
  watched?: boolean
  locked?: boolean
  // ===== H3 扩展(对齐原项目 PopularCourses 字段) =====
  /** VIP 角标(对齐 popular-courses-list-item-text-king "VIP可看") */
  vipOnly?: boolean
  /** 学习人数(对齐 Likes 字段) */
  likes?: number
  /** 分类徽章(对齐 classification 字段) */
  category?: string
  /** 课时数(对齐 classHour 字段) */
  lessonCount?: number
  /** 价格标签(对齐 pay_btn type='1'/'2'/'3'/'4' 不同类型) */
  price?: number
  /** 副标题(对齐 PopularCourses subtitle) */
  subtitle?: string
  /** 缩略图(对齐 PopularCourses img) */
  thumbnail?: string
}

/** 变体类型:list1/list2 对齐 PopularCoursesList1/2.vue,carousel 对齐 CourseCarousel/UpToDate.vue */
export type LessonListItemVariant = 'list1' | 'list2' | 'carousel'

export interface LessonListItemProps {
  data: LessonListItemData
  index?: number
  active?: boolean
  /** 紧凑模式(默认 false,显示完整扩展字段;true 只显示基础信息) */
  compact?: boolean
  /** 变体:list1=横向卡片(入门课程)/ list2=横向卡片(精选课程,封面带价格/分类角标)/ carousel=纵向网格(最新课程) */
  variant?: LessonListItemVariant
  /** VIP 角标(对齐 PopularCoursesList1 "VIP可看" 灰底金字 pill + UpToDate VIP pill) */
  showVipBadge?: boolean
  /** 价格标签(对齐 PopularCoursesList2 .price-tag 底右角红底 + UpToDate ¥XX.XX) */
  showPriceTag?: boolean
  /** 分类徽章(对齐 PopularCoursesList2/UpToDate 顶左角 黑底半透明白字) */
  showCategoryBadge?: boolean
  /** 课时数(对齐 UpToDate classHour "N课时" 底右角黑底半透明白字) */
  showLessonCount?: boolean
  onClick?: () => void
}

export default function LessonListItem({
  data,
  index = 0,
  active = false,
  compact = false,
  variant,
  showVipBadge,
  showPriceTag,
  showCategoryBadge,
  showLessonCount,
  onClick,
}: LessonListItemProps) {
  const tt = useTt()
  const TYPE_ICONS: Record<string, string> = {
    video: '▶',
    audio: '♫',
    article: tt('lesson.articleType', '文'),
    live: '🔴',
  }

  // show* 默认(undefined)= 按数据自动判断;显式 true/false 强制覆盖。
  // 变体模式下 compact 不影响角标可见性(变体有独立布局)。
  const useCompact = !variant && compact
  const vipVisible = showVipBadge ?? !!data.vipOnly
  const priceVisible = showPriceTag ?? data.price !== undefined
  const categoryVisible = showCategoryBadge ?? (!!data.category && !useCompact)
  const lessonCountVisible = showLessonCount ?? (data.lessonCount !== undefined && !useCompact)

  // ===== 变体 list1:横向卡片(对齐 PopularCoursesList1.vue) =====
  // 封面左 250rpx + 内容右;VIP 灰底金字 pill 内嵌内容区;无价格/分类角标。
  if (variant === 'list1') {
    return (
      <View className="lli lli-list1 flex w-full" onClick={onClick}>
        {data.thumbnail && (
          <View className="lli-thumb" style={{ width: '250rpx', height: '174rpx' }}>
            <Image
              src={data.thumbnail}
              mode="aspectFill"
              style={{ width: '100%', height: '100%' }}
              lazyLoad
            />
          </View>
        )}
        <View
          className="lli-content flex-1 min-w-0 flex flex-col justify-around"
          style={{ marginLeft: '20rpx' }}
        >
          <Text className="text-[28rpx] font-bold text-foreground truncate">{data.title}</Text>
          {data.subtitle && (
            <Text className="text-[24rpx] text-muted-foreground truncate">{data.subtitle}</Text>
          )}
          {vipVisible && (
            <View className="lli-vip-pill">
              <Text className="lli-vip-text">👑 VIP可看</Text>
            </View>
          )}
          <View className="flex items-center">
            {data.duration && (
              <Text className="text-[24rpx] text-muted-foreground mr-[20rpx]">{data.duration}</Text>
            )}
            {data.likes !== undefined && (
              <Text className="text-[24rpx] text-muted-foreground font-bold">
                {data.likes}人已学习
              </Text>
            )}
          </View>
        </View>
      </View>
    )
  }

  // ===== 变体 list2:横向卡片 + 封面角标(对齐 PopularCoursesList2.vue) =====
  // 同 list1 横向布局,但封面叠加:顶左分类(黑底半透明)+ 底右价格(红底);内容区显示 VIP/付费 pill。
  if (variant === 'list2') {
    return (
      <View className="lli lli-list2 flex w-full" onClick={onClick}>
        {data.thumbnail && (
          <View
            className="lli-thumb lli-thumb-overlay"
            style={{ width: '250rpx', height: '174rpx' }}
          >
            <Image
              src={data.thumbnail}
              mode="aspectFill"
              style={{ width: '100%', height: '100%' }}
              lazyLoad
            />
            {categoryVisible && data.category && (
              <Text className="lli-overlay-tag lli-overlay-tl">{data.category}</Text>
            )}
            {priceVisible && data.price !== undefined && (
              <Text className="lli-price-tag lli-overlay-br">¥{data.price}</Text>
            )}
          </View>
        )}
        <View
          className="lli-content flex-1 min-w-0 flex flex-col justify-around"
          style={{ marginLeft: '20rpx' }}
        >
          <Text className="text-[28rpx] font-bold text-foreground truncate">{data.title}</Text>
          {data.subtitle && (
            <Text className="text-[24rpx] text-muted-foreground truncate">{data.subtitle}</Text>
          )}
          {(vipVisible || priceVisible) && (
            <View className={`lli-pill ${data.vipOnly ? 'lli-pill-vip' : 'lli-pill-paid'}`}>
              <Text className="lli-pill-text">
                {data.vipOnly ? '👑 VIP可看' : data.price !== undefined ? '💎 付费项目' : ''}
              </Text>
            </View>
          )}
          <View className="flex items-center">
            {data.duration && (
              <Text className="text-[24rpx] text-muted-foreground mr-[20rpx]">{data.duration}</Text>
            )}
            {data.likes !== undefined && (
              <Text className="text-[24rpx] text-muted-foreground font-bold">
                {data.likes}人已学习
              </Text>
            )}
          </View>
        </View>
      </View>
    )
  }

  // ===== 变体 carousel:纵向网格(对齐 CourseCarousel/UpToDate.vue) =====
  // 封面上(分类顶左 + 课时底右)+ 标题 + 副标题 + VIP/付费行。
  if (variant === 'carousel') {
    return (
      <View className="lli lli-carousel flex flex-col" onClick={onClick}>
        {data.thumbnail && (
          <View className="lli-thumb lli-thumb-overlay" style={{ height: '200rpx' }}>
            <Image
              src={data.thumbnail}
              mode="aspectFill"
              style={{ width: '100%', height: '100%' }}
              lazyLoad
            />
            {categoryVisible && data.category && (
              <Text className="lli-overlay-tag lli-overlay-tl">{data.category}</Text>
            )}
            {lessonCountVisible && data.lessonCount !== undefined && (
              <Text className="lli-overlay-tag lli-overlay-br">共 {data.lessonCount} 课时</Text>
            )}
          </View>
        )}
        <Text className="text-[28rpx] text-foreground mt-[10rpx] truncate">{data.title}</Text>
        {data.subtitle && (
          <Text className="text-[24rpx] text-muted-foreground mt-[10rpx] truncate">
            {data.subtitle}
          </Text>
        )}
        <View className="flex items-center mt-[10rpx]">
          {vipVisible && data.vipOnly && (
            <View className="lli-vip-pill">
              <Text className="lli-vip-text">👑 VIP可看</Text>
            </View>
          )}
          {priceVisible && !data.vipOnly && data.price !== undefined && (
            <View className="lli-pill lli-pill-paid">
              <Text className="lli-pill-text">付费可看 ¥{data.price}</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  // ===== 默认布局(无 variant,保持向后兼容 — CourseCatalog 等现有调用方) =====
  return (
    <View
      className={`flex items-center px-4 py-3 mb-2 ${active ? 'bg-primary/10' : ''}`}
      onClick={onClick}
    >
      <View
        className={`flex items-center justify-center w-7 h-7 mr-3 rounded-md text-xs ${
          active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
        }`}
      >
        <Text>{index + 1}</Text>
      </View>

      <View className="flex-1 min-w-0">
        <View className="flex items-center">
          {data.type && (
            <Text className="text-xs text-muted-foreground mr-2">{TYPE_ICONS[data.type]}</Text>
          )}
          <Text
            className={`text-sm truncate ${active ? 'text-primary font-medium' : 'text-foreground'}`}
          >
            {data.title}
          </Text>
          {/* VIP 角标 */}
          {vipVisible && (
            <Text className="ml-2 text-[20rpx] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-medium">
              VIP
            </Text>
          )}
          {/* 分类徽章 */}
          {categoryVisible && data.category && (
            <Text className="ml-2 text-[20rpx] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {data.category}
            </Text>
          )}
        </View>
        {data.subtitle && !compact && (
          <Text className="block text-xs text-muted-foreground mt-0.5 truncate">
            {data.subtitle}
          </Text>
        )}
        {data.duration && (
          <Text className="block text-xs text-muted-foreground mt-0.5">{data.duration}</Text>
        )}
        {/* 学习人数 + 课时数 */}
        {!compact && (data.likes !== undefined || lessonCountVisible) && (
          <View className="flex items-center mt-0.5">
            {data.likes !== undefined && (
              <Text className="text-[20rpx] text-muted-foreground mr-3">{data.likes}人已学习</Text>
            )}
            {lessonCountVisible && data.lessonCount !== undefined && (
              <Text className="text-[20rpx] text-muted-foreground">{data.lessonCount}节</Text>
            )}
          </View>
        )}
      </View>

      {/* 价格标签 */}
      {priceVisible && data.price !== undefined && (
        <Text className="text-xs text-warning font-medium mr-2">¥{data.price}</Text>
      )}
      {data.isFree && (
        <Text className="text-[20rpx] px-1.5 py-0.5 rounded bg-primary/10 text-primary mr-2">
          {tt('lesson.preview', '试看')}
        </Text>
      )}
      {data.watched && <Text className="text-xs text-primary mr-2">✓</Text>}
      {data.locked && <Text className="text-xs text-muted-foreground mr-2">🔒</Text>}
    </View>
  )
}
