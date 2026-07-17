import { View, Text } from '@tarojs/components'

export interface LessonListItemData {
  id: string
  title: string
  duration?: string
  type?: 'video' | 'audio' | 'article' | 'live'
  isFree?: boolean
  watched?: boolean
  locked?: boolean
}

export interface LessonListItemProps {
  data: LessonListItemData
  index?: number
  active?: boolean
  onClick?: () => void
}

const TYPE_ICONS: Record<string, string> = {
  video: '▶',
  audio: '♫',
  article: '文',
  live: '🔴',
}

export default function LessonListItem({
  data,
  index = 0,
  active = false,
  onClick,
}: LessonListItemProps) {
  return (
    <View
      className={`flex items-center px-4 py-3 border-b border-gray-50 ${
        active ? 'bg-indigo-50' : ''
      }`}
      onClick={onClick}
    >
      <View
        className={`flex items-center justify-center w-7 h-7 mr-3 rounded-md text-xs ${
          active ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
        }`}
      >
        <Text>{index + 1}</Text>
      </View>

      <View className="flex-1 min-w-0">
        <View className="flex items-center">
          {data.type && <Text className="text-xs text-gray-400 mr-2">{TYPE_ICONS[data.type]}</Text>}
          <Text
            className={`text-sm truncate ${active ? 'text-indigo-600 font-medium' : 'text-gray-700'}`}
          >
            {data.title}
          </Text>
        </View>
        {data.duration && (
          <Text className="block text-xs text-gray-400 mt-0.5">{data.duration}</Text>
        )}
      </View>

      {data.isFree && (
        <Text className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-500 mr-2">
          试看
        </Text>
      )}
      {data.watched && <Text className="text-xs text-green-500 mr-2">✓</Text>}
      {data.locked && <Text className="text-xs text-gray-400 mr-2">🔒</Text>}
    </View>
  )
}
