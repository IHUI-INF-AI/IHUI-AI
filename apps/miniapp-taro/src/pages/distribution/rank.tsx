import { View, Text, Image } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getDistributionRank } from '@/api'
import { useI18n } from '@/i18n'

interface RankUser {
  id: string
  nickname: string
  avatar?: string
  commission: number
}

const RANK_BG: Record<string, string> = {
  '1': 'bg-[#FFD700]',
  '2': 'bg-[#C0C0C0]',
  '3': 'bg-[#CD7F32]',
}

const RANK_BORDER: Record<string, string> = {
  '1': 'border-[#FFD700]',
  '2': 'border-[#C0C0C0]',
  '3': 'border-[#CD7F32]',
}

export default function DistributionRank() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
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
      <View className="py-[20px] text-center bg-gradient-to-b from-[#ff6b35] to-[#ff8e53]">
        <Text className="text-white text-[18px] font-bold">{tt('distribution.rankTitle', '分销排行榜')}</Text>
      </View>
      {top3.length >= 3 && (
        <View className="flex items-end justify-center py-[24px] bg-card">
          {/* 2nd */}
          <View className="flex flex-col items-center mx-[12px] relative">
            <Image
              className="w-[55px] h-[55px] rounded-md bg-muted border-2 ${RANK_BORDER['2']}"
              src={top3[1]!.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-[12px] text-foreground mt-[8px]">{top3[1]!.nickname}</Text>
            <Text className="text-[14px] text-[#ff6b35] font-semibold mt-[2px]">
              ¥{top3[1]!.commission}
            </Text>
            <Text
              className={`absolute -top-[12px] w-[24px] h-[24px] leading-[24px] text-center rounded-md text-white text-[12px] ${RANK_BG['2']}`}
            >
              2
            </Text>
          </View>
          {/* 1st */}
          <View className="flex flex-col items-center mx-[12px] relative">
            <Image
              className="w-[70px] h-[70px] rounded-md bg-muted border-2 ${RANK_BORDER['1']}"
              src={top3[0]!.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-[12px] text-foreground mt-[8px]">{top3[0]!.nickname}</Text>
            <Text className="text-[14px] text-[#ff6b35] font-semibold mt-[2px]">
              ¥{top3[0]!.commission}
            </Text>
            <Text
              className={`absolute -top-[12px] w-[24px] h-[24px] leading-[24px] text-center rounded-md text-white text-[12px] ${RANK_BG['1']}`}
            >
              1
            </Text>
          </View>
          {/* 3rd */}
          <View className="flex flex-col items-center mx-[12px] relative">
            <Image
              className={`w-[55px] h-[55px] rounded-md bg-muted border-2 ${RANK_BORDER['3']}`}
              src={top3[2]!.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-[12px] text-foreground mt-[8px]">{top3[2]!.nickname}</Text>
            <Text className="text-[14px] text-[#ff6b35] font-semibold mt-[2px]">
              ¥{top3[2]!.commission}
            </Text>
            <Text
              className={`absolute -top-[12px] w-[24px] h-[24px] leading-[24px] text-center rounded-md text-white text-[12px] ${RANK_BG['3']}`}
            >
              3
            </Text>
          </View>
        </View>
      )}
      {rest.length > 0 && (
        <View className="m-[12px] bg-card rounded-[8px] overflow-hidden">
          {rest.map((u, i) => (
            <View key={u.id} className="flex items-center p-[12px] border-b-[1px] border-border">
              <Text className="w-[30px] text-[14px] text-muted-foreground">{i + 4}</Text>
              <Image
                className="w-[32px] h-[32px] rounded-md bg-muted"
                src={u.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <Text className="flex-1 ml-[12px] text-[14px] text-foreground">{u.nickname}</Text>
              <Text className="text-[14px] text-[#ff6b35] font-semibold">¥{u.commission}</Text>
            </View>
          ))}
        </View>
      )}
      {!loading && list.length === 0 && (
        <View className="text-center py-[60px] text-muted-foreground">
          <Text>{tt('distribution.rankEmpty', '暂无排行数据')}</Text>
        </View>
      )}
    </View>
  )
}
