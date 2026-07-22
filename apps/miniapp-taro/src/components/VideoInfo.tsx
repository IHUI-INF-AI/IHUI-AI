import { View, Text } from '@tarojs/components'

export interface VideoInfoData {
  title?: string
  description?: string
  teacher?: string
  duration?: string
  chapterCount?: number
  tags?: string[]
  createdAt?: string
}

export interface VideoInfoProps {
  info?: VideoInfoData
}

export default function VideoInfo({ info = {} }: VideoInfoProps) {
  return (
    <View className="bg-card px-4 py-3">
      <Text className="block text-base font-medium text-foreground">{info.title || '视频详情'}</Text>
      <View className="flex items-center mt-2">
        {info.teacher && <Text className="text-xs text-muted-foreground mr-3">讲师: {info.teacher}</Text>}
        {info.duration && <Text className="text-xs text-muted-foreground">时长: {info.duration}</Text>}
        {info.chapterCount !== undefined && info.chapterCount > 0 && (
          <Text className="text-xs text-muted-foreground ml-3">共 {info.chapterCount} 节</Text>
        )}
      </View>
      {info.description && (
        <Text className="block text-sm text-muted-foreground mt-2 leading-relaxed">{info.description}</Text>
      )}
      {info.tags && info.tags.length > 0 && (
        <View className="flex flex-wrap mt-2">
          {info.tags.map((tag, i) => (
            <Text
              key={i}
              className="text-[11px] px-2 py-0.5 mr-1.5 mb-1 rounded bg-muted text-muted-foreground"
            >
              {tag}
            </Text>
          ))}
        </View>
      )}
    </View>
  )
}
