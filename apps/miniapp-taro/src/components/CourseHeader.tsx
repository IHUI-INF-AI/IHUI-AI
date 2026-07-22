import { View, Text, Image } from '@tarojs/components'

export interface CourseHeaderData {
  title: string
  cover?: string
  teacher?: string
  teacherAvatar?: string
  lessonCount?: number
  studentCount?: number
  rating?: number
  price?: number
  originalPrice?: number
  tags?: string[]
}

export interface CourseHeaderProps {
  data?: CourseHeaderData
  onTeacherClick?: () => void
}

export default function CourseHeader({ data = { title: '' }, onTeacherClick }: CourseHeaderProps) {
  return (
    <View className="bg-card">
      {data.cover && (
        <Image className="w-full" style={{ height: '180px' }} src={data.cover} mode="aspectFill" />
      )}
      <View className="px-4 py-3">
        <Text className="block text-base font-medium text-foreground">{data.title}</Text>

        {data.tags && data.tags.length > 0 && (
          <View className="flex flex-wrap mt-2">
            {data.tags.map((tag, i) => (
              <Text
                key={i}
                className="text-[11px] px-2 py-0.5 mr-1.5 mb-1 rounded bg-primary/10 text-primary"
              >
                {tag}
              </Text>
            ))}
          </View>
        )}

        <View className="flex items-center justify-between mt-3">
          <View className="flex items-center" onClick={onTeacherClick}>
            {data.teacherAvatar && (
              <Image
                className="w-7 h-7 mr-2 rounded-md bg-muted"
                src={data.teacherAvatar}
                mode="aspectFill"
              />
            )}
            {data.teacher && <Text className="text-xs text-foreground mr-3">{data.teacher}</Text>}
          </View>
          <View className="flex items-center">
            {data.lessonCount !== undefined && (
              <Text className="text-xs text-muted-foreground mr-2">{data.lessonCount} 节</Text>
            )}
            {data.studentCount !== undefined && (
              <Text className="text-xs text-muted-foreground mr-2">{data.studentCount} 人学</Text>
            )}
            {data.rating !== undefined && (
              <Text className="text-xs text-[#f59e0b]">★ {data.rating.toFixed(1)}</Text>
            )}
          </View>
        </View>

        {data.price !== undefined && (
          <View className="flex items-baseline mt-2">
            <Text className="text-xs text-destructive mr-1">¥</Text>
            <Text className="text-xl font-bold text-destructive">{data.price}</Text>
            {data.originalPrice && (
              <Text className="text-xs text-muted-foreground line-through ml-2">¥{data.originalPrice}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  )
}
