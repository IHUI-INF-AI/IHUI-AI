import { View, Text, Image } from '@tarojs/components'

export interface InteractionItem {
  id: string
  type: 'like' | 'comment' | 'follow' | 'collect'
  userName: string
  userAvatar?: string
  content: string
  targetTitle?: string
  createdAt: string
  read: boolean
}

export interface InteractionMessageProps {
  list: InteractionItem[]
  onClick?: (item: InteractionItem) => void
}

const TYPE_ICON: Record<InteractionItem['type'], string> = {
  like: '❤',
  comment: '💬',
  follow: '✚',
  collect: '★',
}

const TYPE_COLOR: Record<InteractionItem['type'], string> = {
  like: 'text-red-500',
  comment: 'text-primary',
  follow: 'text-green-500',
  collect: 'text-yellow-500',
}

const TYPE_LABEL: Record<InteractionItem['type'], string> = {
  like: '赞了我',
  comment: '评论了我',
  follow: '关注了我',
  collect: '收藏了我',
}

export default function InteractionMessage({ list, onClick }: InteractionMessageProps) {
  if (!list.length) {
    return (
      <View className="flex items-center justify-center py-16">
        <Text className="text-sm text-gray-400">暂无互动消息</Text>
      </View>
    )
  }

  return (
    <View className="px-3 py-2">
      {list.map((item) => (
        <View
          key={item.id}
          className="flex bg-white rounded-xl p-3 mb-2"
          onClick={() => onClick?.(item)}
        >
          <View className="relative mr-3">
            {item.userAvatar ? (
              <Image
                src={item.userAvatar}
                className="w-10 h-10 rounded-full bg-gray-50"
                mode="aspectFill"
              />
            ) : (
              <View className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Text className="text-sm text-gray-500">{item.userName.charAt(0)}</Text>
              </View>
            )}
            <Text
              className={`absolute -bottom-1 -right-1 w-4 h-4 text-xs bg-white rounded-full flex items-center justify-center ${
                TYPE_COLOR[item.type]
              }`}
            >
              {TYPE_ICON[item.type]}
            </Text>
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex items-center">
              <Text className="text-sm font-medium text-gray-800 truncate">{item.userName}</Text>
              <Text className="ml-1 text-xs text-gray-400">{TYPE_LABEL[item.type]}</Text>
              {!item.read && <View className="w-2 h-2 rounded-full bg-red-500 ml-auto" />}
            </View>
            <Text className="text-xs text-gray-500 mt-1 line-clamp-1">{item.content}</Text>
            {item.targetTitle && (
              <View className="mt-1.5 px-2 py-1 bg-gray-50 rounded">
                <Text className="text-xs text-gray-500 line-clamp-1">@{item.targetTitle}</Text>
              </View>
            )}
            <Text className="text-[10px] text-gray-400 mt-1">{item.createdAt}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}
