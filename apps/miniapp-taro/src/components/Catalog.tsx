import { View, Text, ScrollView, Image } from '@tarojs/components'
import EmptyState from './EmptyState'

export interface ChapterItem {
  id: string
  title: string
  content?: string
  cover?: string
  duration?: string
  createdAt?: string
  watched?: boolean
}

export interface CatalogProps {
  chapters?: ChapterItem[]
  currentId?: string
  loading?: boolean
  onSelect?: (chapter: ChapterItem) => void
  onReachBottom?: () => void
}

export default function Catalog({
  chapters = [],
  currentId = '',
  loading = false,
  onSelect,
  onReachBottom,
}: CatalogProps) {
  if (loading) {
    return (
      <View className="py-8 text-center">
        <Text className="text-sm text-gray-400">加载中...</Text>
      </View>
    )
  }

  if (chapters.length === 0) {
    return <EmptyState text="暂无章节" />
  }

  return (
    <ScrollView
      scrollY
      className="px-3 py-2"
      style={{ maxHeight: '50vh' }}
      onScrollToLower={() => onReachBottom?.()}
      lowerThreshold={50}
    >
      {chapters.map((chapter, idx) => {
        const active = chapter.id === currentId
        return (
          <View
            key={chapter.id}
            className={`flex py-2.5 px-3 mb-2 rounded-lg transition-colors ${
              active ? 'bg-indigo-50' : 'bg-gray-50'
            }`}
            onClick={() => onSelect?.(chapter)}
          >
            {chapter.cover ? (
              <Image
                className="mr-3 rounded bg-gray-100"
                style={{ width: '120px', height: '68px' }}
                src={chapter.cover}
                mode="aspectFill"
              />
            ) : (
              <View
                className="flex items-center justify-center mr-3 rounded bg-gray-100"
                style={{ width: '120px', height: '68px' }}
              >
                <Text className="text-xs text-gray-300">无封面</Text>
              </View>
            )}
            <View className="flex-1 min-w-0">
              <Text className="block text-sm font-medium text-gray-800 truncate">
                {idx + 1}. {chapter.title}
              </Text>
              {chapter.content && (
                <Text className="block text-xs text-gray-400 truncate mt-0.5">
                  {chapter.content}
                </Text>
              )}
              <View className="flex items-center mt-1">
                {chapter.duration && (
                  <Text className="text-xs text-gray-400 mr-2">{chapter.duration}</Text>
                )}
                {chapter.watched && <Text className="text-xs text-green-500">已观看</Text>}
                {active && <Text className="text-xs text-indigo-500 ml-auto">播放中</Text>}
              </View>
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}
