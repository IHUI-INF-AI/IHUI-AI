import { View, Text, ScrollView } from '@tarojs/components'
import EmptyState from './EmptyState'
import LessonListItem, { type LessonListItemData } from './LessonListItem'

export interface CourseCatalogProps {
  lessons?: LessonListItemData[]
  currentId?: string
  loading?: boolean
  onLessonClick?: (lesson: LessonListItemData, index: number) => void
  onReachBottom?: () => void
}

export default function CourseCatalog({
  lessons = [],
  currentId = '',
  loading = false,
  onLessonClick,
  onReachBottom,
}: CourseCatalogProps) {
  return (
    <View className="bg-card">
      <View className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Text className="text-sm font-medium text-foreground">课程目录</Text>
        <Text className="text-xs text-muted-foreground">{lessons.length} 节</Text>
      </View>

      <ScrollView
        scrollY
        style={{ maxHeight: '50vh' }}
        onScrollToLower={onReachBottom}
        lowerThreshold={50}
      >
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-muted-foreground">加载中...</Text>
          </View>
        ) : lessons.length === 0 ? (
          <EmptyState text="暂无课程内容" />
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
