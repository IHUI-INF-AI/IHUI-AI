// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useCallback } from 'react'
import { getSubscriptions, cancelSubscription, type SubscriptionItem } from '@/api/social'
import { useSocialList } from '@/hooks/use-social-list'
import ThemeRoot from '@/components/ThemeRoot'

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
    // 对齐 RN SubscriptionsScreen:根容器 surface.bg;header(返回+标题)由原生导航栏承载
    <View className="min-h-screen bg-background">
      {items.length === 0 && !loading && (
        <View className="flex flex-col items-center py-[96rpx]">
          <Text className="text-[28rpx] text-muted-foreground">{t('subscriptions.empty')}</Text>
        </View>
      )}
      {items.length > 0 && (
        <View className="p-[20rpx] pb-[64rpx]">
          {items.map((item) => {
            const title = item.title || item.name || targetTypeLabel(item.targetType)
            const sub = item.description || targetTypeLabel(item.targetType)
            return (
              <ThemeRoot key={item.id}>
                {/* 对齐 RN card:边框卡 + 40x40 thumb(radius 12→24rpx)+ 标题/副文字 + 描边取消按钮 */}
                <View className="mb-[24rpx] flex items-center border-[2rpx] border-border rounded-[24rpx] bg-background p-[24rpx]">
                  {item.cover ? (
                    <Image
                      className="w-[80rpx] h-[80rpx] rounded-[24rpx] bg-muted mr-[24rpx] flex-shrink-0"
                      src={item.cover}
                      mode="aspectFill"
                    />
                  ) : (
                    <View className="w-[80rpx] h-[80rpx] rounded-[24rpx] bg-muted mr-[24rpx] flex items-center justify-center flex-shrink-0">
                      <Text className="text-[28rpx] font-semibold text-foreground">
                        {targetTypeLabel(item.targetType)}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1 min-w-0">
                    <Text className="text-[32rpx] font-semibold text-foreground truncate block">
                      {title}
                    </Text>
                    <Text className="text-[28rpx] text-muted-foreground mt-[16rpx] truncate block">
                      {sub}
                    </Text>
                  </View>
                  <Text
                    className="ml-[24rpx] border-[2rpx] border-border rounded-[24rpx] bg-background px-[24rpx] py-[12rpx] text-[28rpx] font-semibold text-[var(--color-text-medium)] flex-shrink-0"
                    onClick={() => handleCancel(item)}
                  >
                    {t('subscriptions.delete')}
                  </Text>
                </View>
              </ThemeRoot>
            )
          })}
          <View className="flex items-center justify-center py-[32rpx]">
            {loading ? (
              <Text className="text-[28rpx] text-muted-foreground">{t('common.loading')}</Text>
            ) : hasMore ? (
              <Text className="text-[28rpx] text-muted-foreground">
                {t('subscriptions.loadMore')}
              </Text>
            ) : (
              <Text className="text-[28rpx] text-muted-foreground">
                {t('subscriptions.noMore')}
              </Text>
            )}
          </View>
        </View>
      )}
      {loading && items.length === 0 && (
        <View className="flex flex-col items-center py-[96rpx]">
          <Text className="text-[28rpx] text-muted-foreground">{t('common.loading')}</Text>
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
