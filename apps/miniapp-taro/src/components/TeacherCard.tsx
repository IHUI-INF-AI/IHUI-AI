import { View, Text, Image } from '@tarojs/components'

export interface TeacherCardProps {
  name?: string
  avatar?: string
  title?: string
  bio?: string
  courseCount?: number
  studentCount?: number
  rating?: number
  isFollowing?: boolean
  onFollow?: () => void
  onClick?: () => void
}

export default function TeacherCard({
  name = '讲师',
  avatar,
  title,
  bio,
  courseCount = 0,
  studentCount = 0,
  rating = 0,
  isFollowing = false,
  onFollow,
  onClick,
}: TeacherCardProps) {
  return (
    <View className="bg-card mx-3 my-3 rounded-xl p-4" onClick={onClick}>
      <View className="flex items-center">
        {avatar ? (
          <Image className="w-12 h-12 mr-3 rounded-xl bg-muted" src={avatar} mode="aspectFill" />
        ) : (
          <View className="flex items-center justify-center w-12 h-12 mr-3 rounded-xl bg-primary/10">
            <Text className="text-base text-primary">{name.charAt(0)}</Text>
          </View>
        )}
        <View className="flex-1">
          <View className="flex items-center">
            <Text className="text-sm font-medium text-foreground">{name}</Text>
            {title && (
              <Text className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {title}
              </Text>
            )}
          </View>
          <View className="flex items-center mt-1">
            <Text className="text-xs text-muted-foreground mr-3">{courseCount} 门课</Text>
            <Text className="text-xs text-muted-foreground mr-3">{studentCount} 学员</Text>
            <Text className="text-xs text-[#f59e0b]">★ {rating.toFixed(1)}</Text>
          </View>
        </View>
        <View
          className={`px-3 py-1.5 rounded-md ${isFollowing ? 'bg-muted' : 'bg-primary'}`}
          onClick={(e) => {
            e.stopPropagation()
            onFollow?.()
          }}
        >
          <Text className={`text-xs ${isFollowing ? 'text-muted-foreground' : 'text-white'}`}>
            {isFollowing ? '已关注' : '+ 关注'}
          </Text>
        </View>
      </View>
      {bio && <Text className="block text-xs text-muted-foreground mt-3 leading-relaxed">{bio}</Text>}
    </View>
  )
}
