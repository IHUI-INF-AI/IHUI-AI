// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'
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
  const tt = useTt()
  return (
    <View className="flex flex-col" style={{ maxHeight: '50vh' }}>
      <ScrollView
        scrollY
        className="flex-1 px-md py-sm"
        onScrollToLower={() => onReachBottom?.()}
        lowerThreshold={50}
      >
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-body text-muted-foreground">
              {tt('comment.loading', '加载中...')}
            </Text>
          </View>
        ) : comments.length === 0 ? (
          <EmptyState text={tt('comment.empty', '暂无评论,快来抢沙发')} />
        ) : (
          comments.map((item) => (
            <View key={item.id} className="py-md mb-sm">
              <View className="flex items-start">
                <Image
                  className="w-8 h-8 mr-[20rpx] rounded-lg bg-muted"
                  src={item.avatar || '/static/default-avatar.png'}
                  mode="aspectFill"
                />
                <View className="flex-1 min-w-0">
                  <View className="flex items-center">
                    <Text className="text-body font-medium text-foreground">
                      {item.nickname || tt('comment.anonymous', '匿名')}
                    </Text>
                    <Text className="text-label text-muted-foreground ml-sm">{item.createdAt}</Text>
                  </View>
                  <Text className="block text-body text-foreground mt-xs leading-relaxed">
                    {item.content}
                  </Text>
                  <View className="flex justify-end mt-xs">
                    <Text className="text-label text-primary" onClick={() => onReply?.(item.id)}>
                      {tt('comment.reply', '回复')}
                    </Text>
                  </View>
                  {item.replies && item.replies.length > 0 && (
                    <View className="mt-sm ml-sm pl-md py-[12rpx] pr-sm bg-muted rounded-md">
                      {item.replies.map((reply) => (
                        <View key={reply.id} className="py-[12rpx]">
                          <Text className="text-label text-primary">
                            {reply.nickname || tt('comment.anonymous', '匿名')}
                          </Text>
                          <Text className="text-label text-muted-foreground">:{reply.content}</Text>
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
        <View className="flex items-center px-md py-sm bg-card mt-sm">
          <FocusInput
            className="flex-1 px-md py-sm text-body bg-muted rounded-sm"
            placeholder={tt('comment.placeholder', '写评论...')}
            value={inputValue}
            onInput={(e) => onInput?.(e.detail.value)}
            onConfirm={() => onSubmit?.()}
          />
          <View
            className={`ml-sm px-lg py-sm rounded-md ${inputValue ? 'bg-primary' : 'bg-muted'}`}
            onClick={() => inputValue && onSubmit?.()}
            hoverClass="opacity-60"
          >
            <Text className="text-body text-primary-foreground">{tt('comment.send', '发送')}</Text>
          </View>
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
