import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import EmptyState from './EmptyState'

export interface CommentItem {
  id: string
  content: string
  avatar?: string
  nickname?: string
  createdAt?: string
  replies?: CommentItem[]
}

export interface CommentProps {
  comments?: CommentItem[]
  loading?: boolean
  inputVisible?: boolean
  inputValue?: string
  onInput?: (value: string) => void
  onSubmit?: () => void
  onReply?: (parentId: string) => void
  onReachBottom?: () => void
}

export default function Comment({
  comments = [],
  loading = false,
  inputVisible = true,
  inputValue = '',
  onInput,
  onSubmit,
  onReply,
  onReachBottom,
}: CommentProps) {
  return (
    <View className="flex flex-col" style={{ maxHeight: '50vh' }}>
      <ScrollView
        scrollY
        className="flex-1 px-3 py-2"
        onScrollToLower={() => onReachBottom?.()}
        lowerThreshold={50}
      >
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-gray-400">加载中...</Text>
          </View>
        ) : comments.length === 0 ? (
          <EmptyState text="暂无评论,快来抢沙发" />
        ) : (
          comments.map((item) => (
            <View key={item.id} className="py-3 border-b border-gray-50">
              <View className="flex items-start">
                <Image
                  className="w-8 h-8 mr-2.5 rounded-lg bg-gray-100"
                  src={item.avatar || '/static/default-avatar.png'}
                  mode="aspectFill"
                />
                <View className="flex-1 min-w-0">
                  <View className="flex items-center">
                    <Text className="text-sm font-medium text-gray-700">
                      {item.nickname || '匿名'}
                    </Text>
                    <Text className="text-xs text-gray-400 ml-2">{item.createdAt}</Text>
                  </View>
                  <Text className="block text-sm text-gray-600 mt-1 leading-relaxed">
                    {item.content}
                  </Text>
                  <View className="flex justify-end mt-1">
                    <Text className="text-xs text-indigo-400" onClick={() => onReply?.(item.id)}>
                      回复
                    </Text>
                  </View>
                  {item.replies && item.replies.length > 0 && (
                    <View className="mt-2 ml-2 pl-3 border-l-2 border-gray-100">
                      {item.replies.map((reply) => (
                        <View key={reply.id} className="py-1.5">
                          <Text className="text-xs text-indigo-400">
                            {reply.nickname || '匿名'}
                          </Text>
                          <Text className="text-xs text-gray-500">:{reply.content}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      {inputVisible && (
        <View className="flex items-center px-3 py-2 bg-white border-t border-gray-100">
          <Input
            className="flex-1 px-3 py-2 text-sm bg-gray-50 rounded-md"
            placeholder="写评论..."
            value={inputValue}
            onInput={(e) => onInput?.(e.detail.value)}
            onConfirm={() => onSubmit?.()}
          />
          <View
            className={`ml-2 px-4 py-2 rounded-md ${inputValue ? 'bg-indigo-500' : 'bg-gray-200'}`}
            onClick={() => inputValue && onSubmit?.()}
          >
            <Text className="text-sm text-white">发送</Text>
          </View>
        </View>
      )}
    </View>
  )
}
