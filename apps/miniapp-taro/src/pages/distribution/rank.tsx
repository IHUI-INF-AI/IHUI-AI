import { View, Text, Image } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getDistributionRank } from '@/api'

interface RankUser {
  id: string
  nickname: string
  avatar?: string
  commission: number
}

const RANK_BG: Record<string, string> = {
  '1': 'bg-[#ffd700]',
  '2': 'bg-[#c0c0c0]',
  '3': 'bg-[#cd7f32]',
}

const RANK_BORDER: Record<string, string> = {
  '1': 'w-[140rpx] h-[140rpx] border-[6rpx] border-[#ffd700]',
  '2': 'w-[110rpx] h-[110rpx] border-[4rpx] border-[#c0c0c0]',
  '3': 'w-[110rpx] h-[110rpx] border-[4rpx] border-[#cd7f32]',
}

export default function DistributionRank() {
  const [list, setList] = useState<RankUser[]>([])
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false)

  const load = async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const res = await getDistributionRank()
      setList(res.list || [])
    } catch (e) {
      // ignore
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useDidShow(() => {
    load()
  })

  const top3 = list.slice(0, 3)
  const rest = list.slice(3)

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="py-[60rpx] text-center bg-gradient-to-br from-[#ff6e3c] to-[#ff9a3c]">
        <Text className="text-white text-[36rpx] font-bold">分销佣金排行榜</Text>
      </View>
      {top3.length >= 3 && (
        <View className="flex items-end justify-center py-[32rpx] bg-white">
          {/* 2nd place */}
          <View className="flex flex-col items-center mx-[16rpx] relative">
            <Image
              className={`rounded-full bg-[#f5f5f5] ${RANK_BORDER['2']}`}
              src={top3[1].avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-[24rpx] text-[#333] mt-[12rpx]">{top3[1].nickname}</Text>
            <Text className="text-[26rpx] text-[#ff6e3c] font-semibold mt-[4rpx]">
              ¥{top3[1].commission}
            </Text>
            <Text
              className={`absolute -top-[16rpx] w-[40rpx] h-[40rpx] leading-[40rpx] text-center rounded-full text-white text-[22rpx] ${RANK_BG['2']}`}
            >
              2
            </Text>
          </View>
          {/* 1st place */}
          <View className="flex flex-col items-center mx-[16rpx] relative">
            <Image
              className={`rounded-full bg-[#f5f5f5] ${RANK_BORDER['1']}`}
              src={top3[0].avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-[24rpx] text-[#333] mt-[12rpx]">{top3[0].nickname}</Text>
            <Text className="text-[26rpx] text-[#ff6e3c] font-semibold mt-[4rpx]">
              ¥{top3[0].commission}
            </Text>
            <Text
              className={`absolute -top-[16rpx] w-[40rpx] h-[40rpx] leading-[40rpx] text-center rounded-full text-white text-[22rpx] ${RANK_BG['1']}`}
            >
              1
            </Text>
          </View>
          {/* 3rd place */}
          <View className="flex flex-col items-center mx-[16rpx] relative">
            <Image
              className={`rounded-full bg-[#f5f5f5] ${RANK_BORDER['3']}`}
              src={top3[2].avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="text-[24rpx] text-[#333] mt-[12rpx]">{top3[2].nickname}</Text>
            <Text className="text-[26rpx] text-[#ff6e3c] font-semibold mt-[4rpx]">
              ¥{top3[2].commission}
            </Text>
            <Text
              className={`absolute -top-[16rpx] w-[40rpx] h-[40rpx] leading-[40rpx] text-center rounded-full text-white text-[22rpx] ${RANK_BG['3']}`}
            >
              3
            </Text>
          </View>
        </View>
      )}
      {rest.length > 0 && (
        <View className="m-[24rpx] bg-white rounded-[16rpx] overflow-hidden">
          {rest.map((u, i) => (
            <View
              key={u.id}
              className="flex items-center px-[32rpx] py-[24rpx] border-b-[2rpx] border-[#f5f5f5]"
            >
              <Text className="w-[60rpx] text-[28rpx] text-[#999]">{i + 4}</Text>
              <Image
                className="w-[60rpx] h-[60rpx] rounded-full bg-[#f5f5f5]"
                src={u.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <Text className="flex-1 ml-[24rpx] text-[28rpx] text-[#333]">{u.nickname}</Text>
              <Text className="text-[28rpx] text-[#ff6e3c] font-semibold">¥{u.commission}</Text>
            </View>
          ))}
        </View>
      )}
      {!loading && list.length === 0 && (
        <View className="text-center py-[120rpx] text-[#999]">
          <Text>暂无排行数据</Text>
        </View>
      )}
    </View>
  )
}
