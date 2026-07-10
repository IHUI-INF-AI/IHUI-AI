import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getDistributionInfo, type DistributionInfo } from '@/api'

const DEFAULT_INFO: DistributionInfo = {
  level: 0,
  totalCommission: 0,
  available: 0,
  withdrawn: 0,
  teamCount: 0,
}

const MENU_ITEMS = [
  { icon: '👥', label: '我的团队', url: '/pages/distribution/team' },
  { icon: '💰', label: '佣金记录', url: '/pages/distribution/commission' },
  { icon: '💸', label: '提现', url: '/pages/distribution/withdraw' },
  { icon: '🏆', label: '排行榜', url: '/pages/distribution/rank' },
]

export default function DistributionIndex() {
  const [info, setInfo] = useState<DistributionInfo>(DEFAULT_INFO)

  const load = useCallback(async () => {
    try {
      setInfo(await getDistributionInfo())
    } catch {
      // ignore
    }
  }, [])

  const navigate = (url: string) => {
    Taro.navigateTo({ url })
  }

  useDidShow(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="bg-gradient-to-b from-[#ff6b35] to-[#ff8e53] px-[16px] pt-[24px] pb-[20px] text-white">
        <Text className="block text-[14px] opacity-90">分销等级 V{info.level}</Text>
        <Text className="block text-[40px] font-bold mt-[8px]">¥{info.totalCommission}</Text>
        <Text className="block text-[12px] opacity-90 mt-[4px]">累计佣金</Text>
        <View className="flex mt-[16px]">
          <View className="flex-1 text-center">
            <Text className="block text-[20px] font-bold">¥{info.available}</Text>
            <Text className="block text-[12px] opacity-90 mt-[4px]">可提现</Text>
          </View>
          <View className="flex-1 text-center">
            <Text className="block text-[20px] font-bold">¥{info.withdrawn}</Text>
            <Text className="block text-[12px] opacity-90 mt-[4px]">已提现</Text>
          </View>
          <View className="flex-1 text-center">
            <Text className="block text-[20px] font-bold">{info.teamCount}</Text>
            <Text className="block text-[12px] opacity-90 mt-[4px]">团队人数</Text>
          </View>
        </View>
      </View>
      <View className="mx-[12px] mt-[12px] bg-white rounded-[8px] p-[16px]">
        <View className="grid grid-cols-4 gap-[12px]">
          {MENU_ITEMS.map(item => (
            <View
              key={item.url}
              className="flex flex-col items-center"
              onClick={() => navigate(item.url)}
            >
              <Text className="text-[32px]">{item.icon}</Text>
              <Text className="text-[12px] text-[#333] mt-[6px]">{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
