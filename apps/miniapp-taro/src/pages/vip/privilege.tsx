import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getVipPrivilege } from '@/api'

interface Privilege {
  id: string
  title: string
  desc: string
}

export default function PrivilegePage() {
  const [list, setList] = useState<Privilege[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getVipPrivilege()
      setList(res.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => load())

  const goUpgrade = () => {
    Taro.navigateTo({ url: '/pages/vip/upgrade' })
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="bg-gradient-to-b from-[#2c2c2c] to-[#1a1a1a] px-[24px] py-[40px]">
        <Text className="block text-white text-[40px] font-bold">VIP 会员特权</Text>
        <Text className="block text-[#d4af6a] text-[26px] mt-[12px]">尊享专属权益，开启高品质体验</Text>
      </View>
      <View className="p-[12px]">
        {list.map(p => (
          <View key={p.id} className="bg-white rounded-[8px] p-[16px] mb-[12px]">
            <View className="flex items-center">
              <Text className="text-[40px] mr-[12px]">★</Text>
              <Text className="text-[30px] text-[#333] font-semibold">{p.title}</Text>
            </View>
            <Text className="block text-[26px] text-[#999] mt-[12px]">{p.desc}</Text>
          </View>
        ))}
        {!loading && !list.length ? (
          <View className="text-center py-[120px] text-[#999]">
            <Text>暂无特权信息</Text>
          </View>
        ) : null}
      </View>
      <View className="fixed bottom-0 left-0 right-0 p-[24px] bg-white">
        <Button
          className="w-full bg-gradient-to-r from-[#d4af6a] to-[#b8860b] text-white text-[32px] rounded-[8px] py-[20px]"
          onClick={goUpgrade}
        >
          立即升级
        </Button>
      </View>
    </View>
  )
}
