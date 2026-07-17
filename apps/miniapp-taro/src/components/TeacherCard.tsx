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
    <View className="bg-white mx-3 my-3 rounded-xl p-4" onClick={onClick}>
      <View className="flex items-center">
        {avatar ? (
          <Image className="w-12 h-12 mr-3 rounded-xl bg-gray-100" src={avatar} mode="aspectFill" />
        ) : (
          <View className="flex items-center justify-center w-12 h-12 mr-3 rounded-xl bg-indigo-50">
            <Text className="text-base text-indigo-500">{name.charAt(0)}</Text>
          </View>
        )}
        <View className="flex-1">
          <View className="flex items-center">
            <Text className="text-sm font-medium text-gray-800">{name}</Text>
            {title && (
              <Text className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500">
                {title}
              </Text>
            )}
          </View>
          <View className="flex items-center mt-1">
            <Text className="text-xs text-gray-400 mr-3">{courseCount} 门课</Text>
            <Text className="text-xs text-gray-400 mr-3">{studentCount} 学员</Text>
            <Text className="text-xs text-orange-500">★ {rating.toFixed(1)}</Text>
          </View>
        </View>
        <View
          className={`px-3 py-1.5 rounded-md ${isFollowing ? 'bg-gray-100' : 'bg-indigo-500'}`}
          onClick={(e) => {
            e.stopPropagation()
            onFollow?.()
          }}
        >
          <Text className={`text-xs ${isFollowing ? 'text-gray-500' : 'text-white'}`}>
            {isFollowing ? '已关注' : '+ 关注'}
          </Text>
        </View>
      </View>
      {bio && <Text className="block text-xs text-gray-500 mt-3 leading-relaxed">{bio}</Text>}
    </View>
  )
}
