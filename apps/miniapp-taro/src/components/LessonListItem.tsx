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
      className={`flex items-center px-4 py-3 border-b border-border ${
        active ? 'bg-primary/10' : ''
      }`}
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
          {data.type && <Text className="text-xs text-muted-foreground mr-2">{TYPE_ICONS[data.type]}</Text>}
          <Text
            className={`text-sm truncate ${active ? 'text-primary font-medium' : 'text-foreground'}`}
          >
            {data.title}
          </Text>
        </View>
        {data.duration && (
          <Text className="block text-xs text-muted-foreground mt-0.5">{data.duration}</Text>
        )}
      </View>

      {data.isFree && (
        <Text className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary mr-2">
          试看
        </Text>
      )}
      {data.watched && <Text className="text-xs text-primary mr-2">✓</Text>}
      {data.locked && <Text className="text-xs text-muted-foreground mr-2">🔒</Text>}
    </View>
  )
}
