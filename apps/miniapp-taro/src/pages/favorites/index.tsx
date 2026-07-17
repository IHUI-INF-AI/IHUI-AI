import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useCallback } from 'react'
import { getFavorites, deleteFavorite, type FavoriteItem } from '@/api/social'
import { useSocialList } from '@/hooks/use-social-list'
import { useI18n } from '@/i18n'

const PAGE_SIZE = 20

export default function FavoritesPage() {
  const { t } = useI18n()
  const { items, loading, hasMore, load, removeItem } = useSocialList<FavoriteItem>({
    pageSize: PAGE_SIZE,
    fetch: (params) => getFavorites(params),
  })

  const handleCancel = useCallback(
    (item: FavoriteItem) => {
      Taro.showModal({
        title: t('common.hint'),
        content: t('favorites.cancel'),
        success: async (res) => {
          if (!res.confirm) return
          try {
            await deleteFavorite(item.targetType, item.targetId)
            removeItem(item.id)
            Taro.showToast({ title: t('common.success'), icon: 'success' })
          } catch {
            Taro.showToast({ title: t('favorites.loadFailed'), icon: 'none' })
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
    <View className="min-h-screen bg-[#f7f8fa]">
      {items.length === 0 && !loading && (
        <View className="flex flex-col items-center justify-center py-[160rpx]">
          <Text className="text-[28rpx] text-[#999]">{t('favorites.empty')}</Text>
        </View>
      )}
      {items.length > 0 && (
        <View className="p-[24rpx]">
          {items.map((item) => (
            <View
              key={item.id}
              className="bg-white rounded-[16rpx] p-[24rpx] mb-[24rpx] flex items-center"
            >
              {item.cover ? (
                <Image
                  className="w-[120rpx] h-[120rpx] rounded-[12rpx] mr-[24rpx] bg-[#f0f0f0]"
                  src={item.cover}
                  mode="aspectFill"
                />
              ) : (
                <View className="w-[120rpx] h-[120rpx] rounded-[12rpx] mr-[24rpx] bg-[#f0f0f0] flex items-center justify-center">
                  <Text className="text-[20rpx] text-[#bbb]">{item.targetType}</Text>
                </View>
              )}
              <View className="flex-1 min-w-0">
                <Text className="text-[30rpx] text-[#333] font-semibold truncate">
                  {item.title}
                </Text>
                <Text className="text-[24rpx] text-[#999] mt-[8rpx]">{item.targetType}</Text>
              </View>
              <Text
                className="text-[26rpx] text-[#dd524d] px-[16rpx] py-[8rpx]"
                onClick={() => handleCancel(item)}
              >
                {t('favorites.delete')}
              </Text>
            </View>
          ))}
          <View className="text-center py-[32rpx]">
            {loading ? (
              <Text className="text-[24rpx] text-[#999]">{t('common.loading')}</Text>
            ) : hasMore ? (
              <Text className="text-[24rpx] text-[#999]">{t('favorites.loadMore')}</Text>
            ) : (
              <Text className="text-[24rpx] text-[#999]">{t('favorites.noMore')}</Text>
            )}
          </View>
        </View>
      )}
      {loading && items.length === 0 && (
        <View className="text-center py-[120rpx]">
          <Text className="text-[28rpx] text-[#999]">{t('common.loading')}</Text>
        </View>
      )}
    </View>
  )
}
