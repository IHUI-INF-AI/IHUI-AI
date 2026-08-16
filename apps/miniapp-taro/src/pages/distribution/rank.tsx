import { View, Text, Image } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getDistributionRank } from '@/api'
import { useTt } from '@/i18n'

interface RankUser {
  id: string
  nickname: string
  avatar?: string
  commission: number
}

// 排名金/银/铜色已接入 token:var(--color-rank-gold/silver/bronze)(#FFD700/#C0C0C0/#CD7F32,由 sync-design-tokens.mjs 同步自 tokens.css;className 走 weapp-tailwindcss 编译,var() 生效)
const RANK_BG: Record<string, string> = {
  '1': 'bg-[var(--color-rank-gold)]',
  '2': 'bg-[var(--color-rank-silver)]',
  '3': 'bg-[var(--color-rank-bronze)]',
}

const RANK_BORDER: Record<string, string> = {
  '1': 'border-[var(--color-rank-gold)]',
  '2': 'border-[var(--color-rank-silver)]',
  '3': 'border-[var(--color-rank-bronze)]',
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

  return (
    <View className="min-h-screen bg-background">
      <View className="py-[40rpx] text-center bg-gradient-to-b from-[var(--color-brand-orange)] to-[#ff8e53]">
        <Text className="text-primary-foreground text-[36rpx] font-bold">
          {tt('distribution.rankTitle', '分销排行榜')}
        </Text>
      </View>
      {top3.length >= 3 && (
        <View className="flex items-end justify-center py-[48rpx] bg-card">
          {/* 2nd */}
          <View className="flex flex-col items-center mx-[24rpx] relative">
            <Image
              className={`w-[110rpx] h-[110rpx] rounded-md bg-muted border-2 ${RANK_BORDER['2']}`}
              src={top3[1]!.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-[24rpx] text-foreground mt-[16rpx]">{top3[1]!.nickname}</Text>
            <Text className="text-[28rpx] text-[var(--color-brand-orange)] font-semibold mt-[4rpx]">
              ¥{top3[1]!.commission}
            </Text>
            <Text
              className={`absolute -top-[24rpx] w-[48rpx] h-[48rpx] leading-[48rpx] text-center rounded-md text-primary-foreground text-[24rpx] ${RANK_BG['2']}`}
            >
              2
            </Text>
          </View>
          {/* 1st */}
          <View className="flex flex-col items-center mx-[24rpx] relative">
            <Image
              className={`w-[140rpx] h-[140rpx] rounded-md bg-muted border-2 ${RANK_BORDER['1']}`}
              src={top3[0]!.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-[24rpx] text-foreground mt-[16rpx]">{top3[0]!.nickname}</Text>
            <Text className="text-[28rpx] text-[var(--color-brand-orange)] font-semibold mt-[4rpx]">
              ¥{top3[0]!.commission}
            </Text>
            <Text
              className={`absolute -top-[24rpx] w-[48rpx] h-[48rpx] leading-[48rpx] text-center rounded-md text-primary-foreground text-[24rpx] ${RANK_BG['1']}`}
            >
              1
            </Text>
          </View>
          {/* 3rd */}
          <View className="flex flex-col items-center mx-[24rpx] relative">
            <Image
              className={`w-[110rpx] h-[110rpx] rounded-md bg-muted border-2 ${RANK_BORDER['3']}`}
              src={top3[2]!.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-[24rpx] text-foreground mt-[16rpx]">{top3[2]!.nickname}</Text>
            <Text className="text-[28rpx] text-[var(--color-brand-orange)] font-semibold mt-[4rpx]">
              ¥{top3[2]!.commission}
            </Text>
            <Text
              className={`absolute -top-[24rpx] w-[48rpx] h-[48rpx] leading-[48rpx] text-center rounded-md text-primary-foreground text-[24rpx] ${RANK_BG['3']}`}
            >
              3
            </Text>
          </View>
        </View>
      )}
      {rest.length > 0 && (
        <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden flex flex-col">
          {rest.map((u, i) => (
            <View key={u.id} className="flex items-center p-[24rpx] mb-2 last:mb-0">
              <Text className="w-[60rpx] text-[28rpx] text-muted-foreground">{i + 4}</Text>
              <Image
                className="w-[64rpx] h-[64rpx] rounded-md bg-muted"
                src={u.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <Text className="flex-1 ml-[24rpx] text-[28rpx] text-foreground">{u.nickname}</Text>
              <Text className="text-[28rpx] text-[var(--color-brand-orange)] font-semibold">
                ¥{u.commission}
              </Text>
            </View>
          ))}
        </View>
      )}
      {!loading && list.length === 0 && (
        <View className="text-center py-[120rpx] text-muted-foreground">
          <Text>{tt('distribution.rankEmpty', '暂无排行数据')}</Text>
        </View>
      )}
    </View>
  )
}
