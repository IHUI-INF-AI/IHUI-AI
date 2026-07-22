import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useCallback } from 'react'
import { getSubscriptions, cancelSubscription, type SubscriptionItem } from '@/api/social'
import { useSocialList } from '@/hooks/use-social-list'
import { useI18n } from '@/i18n'

const PAGE_SIZE = 20

export default function SubscriptionsPage() {
  const { t } = useI18n()
  const { items, loading, hasMore, load, removeItem } = useSocialList<SubscriptionItem>({
    pageSize: PAGE_SIZE,
    fetch: (params) => getSubscriptions(params),
  })

  const handleCancel = useCallback(
    (item: SubscriptionItem) => {
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
          {items.map((item) => (
            <View
              key={item.id}
              className="bg-card rounded-[16rpx] p-[24rpx] mb-[24rpx] flex items-center justify-between"
            >
              <View className="flex-1 min-w-0 mr-[24rpx]">
                <Text className="text-[30rpx] text-foreground font-semibold truncate">
                  {item.targetType}
                </Text>
                <Text className="text-[24rpx] text-muted-foreground mt-[8rpx] truncate">{item.targetId}</Text>
              </View>
              <Text
                className="text-[26rpx] text-[#dd524d] px-[16rpx] py-[8rpx]"
                onClick={() => handleCancel(item)}
              >
                {t('subscriptions.delete')}
              </Text>
            </View>
          ))}
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
