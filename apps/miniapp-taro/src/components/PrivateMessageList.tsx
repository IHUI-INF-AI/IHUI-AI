import { View, Text, Image } from '@tarojs/components'

export interface PrivateMessageItem {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  lastMessage: string
  lastTime: string
  unread: number
  online?: boolean
}

export interface PrivateMessageListProps {
  list: PrivateMessageItem[]
  onClick?: (item: PrivateMessageItem) => void
}

export default function PrivateMessageList({ list, onClick }: PrivateMessageListProps) {
  if (!list.length) {
    return (
      <View className="flex items-center justify-center py-16">
        <Text className="text-sm text-muted-foreground">暂无私信</Text>
      </View>
    )
  }

  return (
    <View className="bg-card">
      {list.map((item) => (
        <View
          key={item.id}
          className="flex items-center px-3 py-3 border-b border-border"
          onClick={() => onClick?.(item)}
        >
          <View className="relative mr-3">
            {item.userAvatar ? (
              <Image
                src={item.userAvatar}
                className="w-11 h-11 rounded-xl bg-muted"
                mode="aspectFill"
              />
            ) : (
              <View className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
                <Text className="text-sm text-muted-foreground">{item.userName.charAt(0)}</Text>
              </View>
            )}
            {item.online && (
              <View className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-primary border-2 border-white" />
            )}
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex items-center">
              <Text className="text-sm font-medium text-foreground truncate flex-1">
                {item.userName}
              </Text>
              <Text className="text-[10px] text-muted-foreground ml-2">{item.lastTime}</Text>
            </View>
            <View className="flex items-center mt-0.5">
              <Text className="text-xs text-muted-foreground truncate flex-1">{item.lastMessage}</Text>
              {item.unread > 0 && (
                <View className="ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive flex items-center justify-center">
                  <Text className="text-[10px] text-white">
                    {item.unread > 99 ? '99+' : item.unread}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}
