import { View, Text, ScrollView, Image } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import EmptyState from './EmptyState'
import LessonListItem, { type LessonListItemData } from './LessonListItem'
import { useTt } from '@/i18n'
import { bspappUrl } from '@/constants/icon-urls'

/** 知识星球卡片数据(planet variant 专用,对齐原项目 KnowledgePlanet/index.vue) */
export interface PlanetData {
  id: string
  name: string
  cover?: string
  intro?: string
  memberCount?: number
  joined?: boolean
}

export interface CourseCatalogProps {
  lessons?: LessonListItemData[]
  currentId?: string
  loading?: boolean
  onLessonClick?: (lesson: LessonListItemData, index: number) => void
  onReachBottom?: () => void
  /** 样式变体:'default'(课程目录列表,默认)/ 'planet'(知识星球卡片) */
  variant?: 'default' | 'planet'
  /** planet variant 专用:知识星球数据 */
  planet?: PlanetData
  /** planet variant 专用:加入星球回调 */
  onJoin?: (planetId: string) => void
}

/**
 * CourseCatalog 课程目录 / 知识星球卡片
 *
 * 两种 variant:
 * - 'default'(默认,兼容旧调用):课程目录列表(封面 + 标题 + 简介 + 成员数 + 加入按钮)
 * - 'planet'(知识星球卡片,对齐原项目 KnowledgePlanet/index.vue):
 *   卡片式布局,封面图 + 标题 + 简介 + 成员数 + 加入/已加入按钮
 */
export default function CourseCatalog({
  lessons = [],
  currentId = '',
  loading = false,
  onLessonClick,
  onReachBottom,
  variant = 'default',
  planet,
  onJoin,
}: CourseCatalogProps) {
  const tt = useTt()

  // ===== planet variant:知识星球卡片 =====
  if (variant === 'planet') {
    if (!planet) {
      return <EmptyState text={tt('planet.empty', '暂无星球')} />
    }
    const { id, name, cover, intro, memberCount, joined } = planet
    return (
      <View className="bg-card rounded-xl overflow-hidden">
        {cover ? (
          <View className="relative w-full" style={{ height: '160px' }}>
            <Image src={cover} mode="aspectFill" className="w-full h-full" lazyLoad />
          </View>
        ) : null}
        <View className="p-4">
          <Text className="block text-base font-medium text-foreground mb-1">{name}</Text>
          {intro ? (
            <Text className="block text-sm text-muted-foreground mb-3 line-clamp-2">{intro}</Text>
          ) : null}
          <View className="flex items-center justify-between">
            <Text className="text-xs text-muted-foreground">
              {memberCount !== undefined ? `${memberCount} ${tt('planet.members', '成员')}` : ''}
            </Text>
            <View
              onClick={() => {
                if (!joined) onJoin?.(id)
              }}
              className={cn(
                'px-4 py-1.5 rounded-md',
                joined ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground',
              )}
            >
              <Text className="text-sm">
                {joined ? tt('planet.joined', '已加入') : tt('planet.join', '加入星球')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  // ===== default variant:课程目录列表(原实现)=====
  return (
    <View className="bg-card">
      <View className="flex items-center justify-between px-4 py-3 mb-2">
        <View className="flex items-center">
          <Image
            src={bspappUrl('tabbar/home/zhongxia/popular-courser.png')}
            mode="aspectFill"
            className="w-[62rpx] h-[62rpx] mr-[20rpx]"
            lazyLoad
          />
          <Text className="text-sm font-medium text-foreground">
            {tt('catalog.courseCatalog', '课程目录')}
          </Text>
        </View>
        <View className="flex items-center">
          <Text className="text-xs text-muted-foreground">{lessons.length} 节</Text>
          <Image
            src={bspappUrl('tabbar/home/zhongxia/right-arrow.png')}
            mode="aspectFill"
            className="w-[30rpx] h-[30rpx] ml-[10rpx]"
            lazyLoad
          />
        </View>
      </View>

      <ScrollView
        scrollY
        style={{ maxHeight: '50vh' }}
        onScrollToLower={onReachBottom}
        lowerThreshold={50}
      >
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-muted-foreground">
              {tt('common.loadingShort', '加载中...')}
            </Text>
          </View>
        ) : lessons.length === 0 ? (
          <EmptyState text={tt('catalog.empty', '暂无课程内容')} />
        ) : (
          lessons.map((lesson, idx) => (
            <LessonListItem
              key={lesson.id}
              data={lesson}
              index={idx}
              active={lesson.id === currentId}
              onClick={() => onLessonClick?.(lesson, idx)}
            />
          ))
        )}
      </ScrollView>
    </View>
  )
}
