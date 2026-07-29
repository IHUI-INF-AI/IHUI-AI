import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'

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
  /** 分类徽章(对齐 subtitle 字段) */
  category?: string
  /** 课时数(对齐 lessonCount 字段) */
  lessonCount?: number
  /** 价格标签(对齐 pay_btn type='1'/'2'/'3'/'4' 不同类型) */
  price?: number
  /** 副标题(对齐 PopularCourses subtitle) */
  subtitle?: string
  /** 缩略图(对齐 PopularCourses img) */
  thumbnail?: string
}

export interface LessonListItemProps {
  data: LessonListItemData
  index?: number
  active?: boolean
  /** 紧凑模式(默认 false,显示完整扩展字段;true 只显示基础信息) */
  compact?: boolean
  onClick?: () => void
}

export default function LessonListItem({
  data,
  index = 0,
  active = false,
  compact = false,
  onClick,
}: LessonListItemProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const TYPE_ICONS: Record<string, string> = {
    video: '▶',
    audio: '♫',
    article: tt('lesson.articleType', '文'),
    live: '🔴',
  }
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
          {data.vipOnly && (
            <Text className="ml-2 text-[20rpx] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-medium">
              VIP
            </Text>
          )}
          {/* 分类徽章 */}
          {data.category && !compact && (
            <Text className="ml-2 text-[20rpx] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {data.category}
            </Text>
          )}
        </View>
        {data.subtitle && !compact && (
          <Text className="block text-xs text-muted-foreground mt-0.5 truncate">{data.subtitle}</Text>
        )}
        {data.duration && (
          <Text className="block text-xs text-muted-foreground mt-0.5">{data.duration}</Text>
        )}
        {/* 学习人数 + 课时数 */}
        {!compact && (data.likes !== undefined || data.lessonCount !== undefined) && (
          <View className="flex items-center mt-0.5">
            {data.likes !== undefined && (
              <Text className="text-[20rpx] text-muted-foreground mr-3">{data.likes}人已学习</Text>
            )}
            {data.lessonCount !== undefined && (
              <Text className="text-[20rpx] text-muted-foreground">{data.lessonCount}节</Text>
            )}
          </View>
        )}
      </View>

      {/* 价格标签 */}
      {data.price !== undefined && (
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
