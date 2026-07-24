import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import EmptyState from './EmptyState'
import { useI18n } from '@/i18n'

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
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
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
            <Text className="text-sm text-muted-foreground">{tt('comment.loading', '加载中...')}</Text>
          </View>
        ) : comments.length === 0 ? (
          <EmptyState text={tt('comment.empty', '暂无评论,快来抢沙发')} />
        ) : (
          comments.map((item) => (
            <View key={item.id} className="py-3 mb-2">
              <View className="flex items-start">
                <Image
                  className="w-8 h-8 mr-2.5 rounded-lg bg-muted"
                  src={item.avatar || '/static/default-avatar.png'}
                  mode="aspectFill"
                />
                <View className="flex-1 min-w-0">
                  <View className="flex items-center">
                    <Text className="text-sm font-medium text-foreground">
                      {item.nickname || tt('comment.anonymous', '匿名')}
                    </Text>
                    <Text className="text-xs text-muted-foreground ml-2">{item.createdAt}</Text>
                  </View>
                  <Text className="block text-sm text-foreground mt-1 leading-relaxed">
                    {item.content}
                  </Text>
                  <View className="flex justify-end mt-1">
                    <Text className="text-xs text-primary" onClick={() => onReply?.(item.id)}>
                      {tt('comment.reply', '回复')}
                    </Text>
                  </View>
                  {item.replies && item.replies.length > 0 && (
                    <View className="mt-2 ml-2 pl-3 py-1.5 pr-2 bg-muted rounded-md">
                      {item.replies.map((reply) => (
                        <View key={reply.id} className="py-1.5">
                          <Text className="text-xs text-primary">
                            {reply.nickname || tt('comment.anonymous', '匿名')}
                          </Text>
                          <Text className="text-xs text-muted-foreground">:{reply.content}</Text>
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
        <View className="flex items-center px-3 py-2 bg-card mt-2">
          <Input
            className="flex-1 px-3 py-2 text-sm bg-muted rounded-md"
            placeholder={tt('comment.placeholder', '写评论...')}
            value={inputValue}
            onInput={(e) => onInput?.(e.detail.value)}
            onConfirm={() => onSubmit?.()}
          />
          <View
            className={`ml-2 px-4 py-2 rounded-md ${inputValue ? 'bg-primary' : 'bg-muted'}`}
            onClick={() => inputValue && onSubmit?.()}
          >
            <Text className="text-sm text-white">{tt('comment.send', '发送')}</Text>
          </View>
        </View>
      )}
    </View>
  )
}
