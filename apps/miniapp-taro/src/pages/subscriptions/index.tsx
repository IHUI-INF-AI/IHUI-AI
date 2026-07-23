import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useCallback } from 'react'
import { getSubscriptions, cancelSubscription, type SubscriptionItem } from '@/api/social'
import { useSocialList } from '@/hooks/use-social-list'
import { useI18n } from '@/i18n'

const PAGE_SIZE = 20

// 后端可能返回订阅对象的标题/封面/名称(列表场景常见),做容错字段
interface DisplayableSubscription extends SubscriptionItem {
  title?: string
  name?: string
  cover?: string | null
  description?: string | null
}

export default function SubscriptionsPage() {
  const { t } = useI18n()
  const { items, loading, hasMore, load, removeItem } = useSocialList<DisplayableSubscription>({
    pageSize: PAGE_SIZE,
    fetch: (params) => getSubscriptions(params),
  })

  const targetTypeLabel = useCallback(
    (raw: string) => {
      // 优先复用 i18n 已有的资源类型 key,缺失则回退原值
      const keyMap: Record<string, string> = {
        course: 'user.menu.courses',
        agent: 'user.menu.ai',
      }
      const key = keyMap[raw]
      if (!key) return raw
      const translated = t(key)
      return translated === key ? raw : translated
    },
    [t],
  )

  const handleCancel = useCallback(
    (item: DisplayableSubscription) => {
      Taro.showModal({
        title: t('common.hint'),
        content: t('subscriptions.cancel'),
        success: async (res) => {
          if (!res.confirm) return
          try {
            await cancelSubscription(item.targetType, item.targetId)
            removeItem(item.id)
            Taro.showToast({ title: t('common.success'), icon: 'success' })
          } catch {
            Taro.showToast({ title: t('subscriptions.loadFailed'), icon: 'none' })
          }
        },
      })
    },
    [t, removeItem],
  )

  useDidShow(() => load(true))
  useReachBottom(() => load())
  usePullDownRefresh(() => load(true).finally(() => Taro.stopPullDownRefresh()))

  return (
    <View className="min-h-screen bg-background">
      {items.length === 0 && !loading && (
        <View className="flex flex-col items-center justify-center py-[160rpx]">
          <Text className="text-[28rpx] text-muted-foreground">{t('subscriptions.empty')}</Text>
        </View>
      )}
      {items.length > 0 && (
        <View className="p-[24rpx]">
          {items.map((item) => {
            const title = item.title || item.name || targetTypeLabel(item.targetType)
            const sub = item.description || targetTypeLabel(item.targetType)
            return (
              <View
                key={item.id}
                className="bg-card rounded-[16rpx] p-[24rpx] mb-[24rpx] flex items-center justify-between"
              >
                <View className="flex-1 min-w-0 mr-[24rpx] flex items-center">
                  {item.cover ? (
                    <Image
                      className="w-[100rpx] h-[100rpx] rounded-[12rpx] mr-[20rpx] bg-[#f0f0f0]"
                      src={item.cover}
                      mode="aspectFill"
                    />
                  ) : null}
                  <View className="flex-1 min-w-0">
                    <Text className="text-[30rpx] text-foreground font-semibold truncate block">
                      {title}
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground mt-[8rpx] truncate block">
                      {sub}
                    </Text>
                  </View>
                </View>
                <Text
                  className="text-[26rpx] text-[#dd524d] px-[16rpx] py-[8rpx]"
                  onClick={() => handleCancel(item)}
                >
                  {t('subscriptions.delete')}
                </Text>
              </View>
            )
          })}
          <View className="text-center py-[32rpx]">
            {loading ? (
              <Text className="text-[24rpx] text-muted-foreground">{t('common.loading')}</Text>
            ) : hasMore ? (
              <Text className="text-[24rpx] text-muted-foreground">{t('subscriptions.loadMore')}</Text>
            ) : (
              <Text className="text-[24rpx] text-muted-foreground">{t('subscriptions.noMore')}</Text>
            )}
          </View>
        </View>
      )}
      {loading && items.length === 0 && (
        <View className="text-center py-[120rpx]">
          <Text className="text-[28rpx] text-muted-foreground">{t('common.loading')}</Text>
        </View>
      )}
    </View>
  )
}
