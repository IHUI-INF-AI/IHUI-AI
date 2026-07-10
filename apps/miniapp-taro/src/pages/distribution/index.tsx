import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { getDistributionInfo, type DistributionInfo } from '@/api'

const DEFAULT_INFO: DistributionInfo = {
  level: 0,
  totalCommission: 0,
  available: 0,
  withdrawn: 0,
  teamCount: 0,
}

const MENU_ITEMS = [
  { url: '/pages/distribution/team', label: '我的团队' },
  { url: '/pages/distribution/commission', label: '佣金记录' },
  { url: '/pages/distribution/withdraw', label: '申请提现' },
  { url: '/pages/distribution/rank', label: '分销排行' },
]

export default function DistributionIndex() {
  const [info, setInfo] = useState<DistributionInfo>(DEFAULT_INFO)

  const load = async () => {
    try {
      setInfo(await getDistributionInfo())
    } catch (e) {
      // ignore
    }
  }

  const navigate = (url: string) => {
    Taro.navigateTo({ url })
  }

  useDidShow(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-[#f7f8fa] pb-[120rpx]">
      <View className="pt-[60rpx] px-[40rpx] pb-[60rpx] text-white bg-gradient-to-br from-[#ff6e3c] to-[#ff9a3c]">
        <View className="flex mb-[32rpx]">
          <View className="flex-1 text-center">
            <Text className="block text-[40rpx] font-bold">¥{info.totalCommission}</Text>
            <Text className="block text-[24rpx] opacity-90 mt-[8rpx]">累计佣金</Text>
          </View>
          <View className="flex-1 text-center">
            <Text className="block text-[40rpx] font-bold">¥{info.available}</Text>
            <Text className="block text-[24rpx] opacity-90 mt-[8rpx]">可提现</Text>
          </View>
        </View>
        <View className="flex">
          <View className="flex-1 text-center">
            <Text className="block text-[40rpx] font-bold">¥{info.withdrawn}</Text>
            <Text className="block text-[24rpx] opacity-90 mt-[8rpx]">已提现</Text>
          </View>
          <View className="flex-1 text-center">
            <Text className="block text-[40rpx] font-bold">{info.teamCount}</Text>
            <Text className="block text-[24rpx] opacity-90 mt-[8rpx]">团队人数</Text>
          </View>
        </View>
      </View>
      <View className="m-[24rpx] bg-white rounded-[16rpx] overflow-hidden">
        {MENU_ITEMS.map((item, idx) => (
          <View
            key={item.url}
            className={`flex justify-between items-center p-[32rpx] text-[28rpx] text-[#333] ${idx < MENU_ITEMS.length - 1 ? 'border-b-[2rpx] border-[#f5f5f5]' : ''}`}
            onClick={() => navigate(item.url)}
          >
            <Text>{item.label}</Text>
            <Text className="text-[#ccc]">›</Text>
          </View>
        ))}
      </View>
      <Button
        className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] bg-[#ff6e3c] text-white rounded-[40rpx] text-[32rpx]"
        onClick={() => navigate('/pages/distribution/withdraw')}
      >
        立即提现
      </Button>
    </View>
  )
}
