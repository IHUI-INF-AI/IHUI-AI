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
  like: 'text-destructive',
  comment: 'text-primary',
  follow: 'text-primary',
  collect: 'text-[#f59e0b]',
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
        <Text className="text-sm text-muted-foreground">暂无互动消息</Text>
      </View>
    )
  }

  return (
    <View className="px-3 py-2">
      {list.map((item) => (
        <View
          key={item.id}
          className="flex bg-card rounded-xl p-3 mb-2"
          onClick={() => onClick?.(item)}
        >
          <View className="relative mr-3">
            {item.userAvatar ? (
              <Image
                src={item.userAvatar}
                className="w-10 h-10 rounded-lg bg-muted"
                mode="aspectFill"
              />
            ) : (
              <View className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Text className="text-sm text-muted-foreground">{item.userName.charAt(0)}</Text>
              </View>
            )}
            <Text
              className={`absolute -bottom-1 -right-1 w-4 h-4 text-xs bg-card rounded flex items-center justify-center ${
                TYPE_COLOR[item.type]
              }`}
            >
              {TYPE_ICON[item.type]}
            </Text>
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex items-center">
              <Text className="text-sm font-medium text-foreground truncate">{item.userName}</Text>
              <Text className="ml-1 text-xs text-muted-foreground">{TYPE_LABEL[item.type]}</Text>
              {!item.read && <View className="w-2 h-2 rounded-full bg-destructive ml-auto" />}
            </View>
            <Text className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.content}</Text>
            {item.targetTitle && (
              <View className="mt-1.5 px-2 py-1 bg-muted rounded">
                <Text className="text-xs text-muted-foreground line-clamp-1">@{item.targetTitle}</Text>
              </View>
            )}
            <Text className="text-[10px] text-muted-foreground mt-1">{item.createdAt}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}
