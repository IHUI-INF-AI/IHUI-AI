import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useCallback } from 'react'
import { getFollowing, unfollowUser, type FollowingItem } from '@/api/social'
import { useSocialList } from '@/hooks/use-social-list'
import { useI18n } from '@/i18n'

const PAGE_SIZE = 20
const defaultAvatar = '/static/default-avatar.png'

export default function FollowingPage() {
  const { t } = useI18n()
  const { items, loading, hasMore, load, removeItem } = useSocialList<FollowingItem>({
    pageSize: PAGE_SIZE,
    fetch: (params) => getFollowing(params),
  })

  const handleUnfollow = useCallback(
    (item: FollowingItem) => {
      Taro.showModal({
        title: t('common.hint'),
        content: t('following.cancel'),
        success: async (res) => {
          if (!res.confirm) return
          try {
            await unfollowUser(item.id)
            removeItem(item.id)
            Taro.showToast({ title: t('common.success'), icon: 'success' })
          } catch {
            Taro.showToast({ title: t('following.loadFailed'), icon: 'none' })
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
          <Text className="text-[28rpx] text-[#999]">{t('following.empty')}</Text>
        </View>
      )}
      {items.length > 0 && (
        <View className="p-[24rpx]">
          {items.map((item) => (
            <View
              key={item.id}
              className="bg-white rounded-[16rpx] p-[24rpx] mb-[24rpx] flex items-center"
            >
              <Image
                className="w-[100rpx] h-[100rpx] rounded-full mr-[24rpx] bg-[#f0f0f0]"
                src={item.avatar || defaultAvatar}
                mode="aspectFill"
              />
              <View className="flex-1 min-w-0">
                <Text className="text-[30rpx] text-[#333] font-semibold truncate">
                  {item.nickname || item.username}
                </Text>
                {item.bio ? (
                  <Text className="text-[24rpx] text-[#999] mt-[8rpx] truncate">{item.bio}</Text>
                ) : null}
              </View>
              <Text
                className="text-[26rpx] text-[#dd524d] px-[16rpx] py-[8rpx]"
                onClick={() => handleUnfollow(item)}
              >
                {t('following.delete')}
              </Text>
            </View>
          ))}
          <View className="text-center py-[32rpx]">
            {loading ? (
              <Text className="text-[24rpx] text-[#999]">{t('common.loading')}</Text>
            ) : hasMore ? (
              <Text className="text-[24rpx] text-[#999]">{t('following.loadMore')}</Text>
            ) : (
              <Text className="text-[24rpx] text-[#999]">{t('following.noMore')}</Text>
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
