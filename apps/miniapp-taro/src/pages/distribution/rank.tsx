// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getDistributionRank } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

interface RankUser {
  id: string
  nickname: string
  avatar?: string
  commission: number
}

export default function DistributionRank() {
  const tt = useTt()
  const [list, setList] = useState<RankUser[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await getDistributionRank()
      setList(res.list || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const top3 = list.slice(0, 3)
  const rest = list.slice(3)

  /* 对齐 RN RankingScreen rankColor:1=warning.amber / 2=text.tertiary / 3=warning.amberText */
  const PODIUM = [
    { rank: 1, item: top3[0], border: 'var(--color-warning-amber)', badge: 'var(--color-warning-amber)' },
    { rank: 2, item: top3[1], border: 'var(--color-text-tertiary)', badge: 'var(--color-text-tertiary)' },
    { rank: 3, item: top3[2], border: 'var(--color-warning-amber-text)', badge: 'var(--color-warning-amber-text)' },
  ]

  return (
    <ThemeRoot className="min-h-screen bg-background">
      {top3.length >= 3 && (
        <View className="flex flex-row gap-[16rpx] p-[20rpx] py-[24rpx]">
          {PODIUM.map(({ rank, item, border, badge }) =>
            item ? (
              <View
                key={rank}
                className={`flex-1 flex flex-col items-center p-[28rpx] rounded-[24rpx] ${rank === 1 ? 'bg-[var(--color-warning-amber-light)]' : 'bg-[var(--color-muted)]'}`}
              >
                <View
                  className="w-[96rpx] h-[96rpx] rounded-full border-[4rpx] bg-[var(--color-background)] overflow-hidden"
                  style={{ borderColor: border }}
                >
                  <Image
                    className="w-full h-full"
                    src={item.avatar || '/static/default-avatar.png'}
                    mode="aspectFill"
                  />
                </View>
                <Text className="text-[28rpx] font-semibold text-foreground mt-[16rpx] max-w-full truncate">
                  {item.nickname}
                </Text>
                <Text className="text-[28rpx] text-[var(--color-success)] mt-[16rpx]">
                  ¥{item.commission}
                </Text>
                <Text
                  className="mt-[16rpx] px-[12rpx] py-[4rpx] rounded-[16rpx] text-[22rpx] text-[var(--color-surface-light)]"
                  style={{ backgroundColor: badge }}
                >
                  {rank}
                </Text>
              </View>
            ) : null,
          )}
        </View>
      )}
      {rest.length > 0 && (
        <View className="mx-[20rpx] flex flex-col gap-[16rpx]">
          {rest.map((u, i) => (
            <View
              key={u.id}
              className="flex flex-row items-center p-[28rpx] rounded-[24rpx] border border-border bg-[var(--color-background)]"
            >
              <Text className="w-[72rpx] text-[32rpx] font-bold text-[var(--color-muted-foreground)]">
                {i + 4}
              </Text>
              <View className="w-[88rpx] h-[88rpx] rounded-full border-[3rpx] border-[var(--color-muted-foreground)] bg-[var(--color-muted)] overflow-hidden">
                <Image
                  className="w-full h-full"
                  src={u.avatar || '/static/default-avatar.png'}
                  mode="aspectFill"
                />
              </View>
              <Text className="flex-1 ml-[20rpx] mr-[16rpx] text-[32rpx] font-semibold text-foreground truncate">
                {u.nickname}
              </Text>
              <Text className="text-[32rpx] font-bold text-[var(--color-success)]">
                ¥{u.commission}
              </Text>
            </View>
          ))}
        </View>
      )}
      {!loading && list.length === 0 && (
        <View className="text-center py-[120rpx] text-[28rpx] text-[var(--color-text-tertiary)]">
          <Text>{tt('distribution.rankEmpty', '暂无排行数据')}</Text>
        </View>
      )}
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
