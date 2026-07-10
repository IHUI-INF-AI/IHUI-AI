import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getCouponList } from '@/api'

interface Coupon {
  id: string
  title: string
  amount: number
  threshold: number
  expireTime: string
  status: string
}

export default function CouponListPage() {
  const [list, setList] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCouponList({ status: 'available' })
      setList(res.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => load())

  const onReceive = (id: string) => {
    Taro.showToast({ title: '领取成功', icon: 'success' })
    load()
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa] p-[12px]">
      {list.map(c => (
        <View key={c.id} className="bg-white rounded-[8px] mb-[12px] flex overflow-hidden">
          <View className="bg-gradient-to-r from-[#dd5145] to-[#f7695a] w-[180rpx] flex flex-col items-center justify-center py-[24rpx]">
            <View className="flex items-baseline">
              <Text className="text-[60rpx] text-white font-bold">{c.amount}</Text>
              <Text className="text-[26rpx] text-white ml-[4rpx]">元</Text>
            </View>
            <Text className="text-[22rpx] text-white mt-[4rpx]">优惠券</Text>
          </View>
          <View className="flex-1 px-[20rpx] py-[20rpx] flex flex-col justify-between">
            <View>
              <Text className="block text-[30rpx] text-[#333] font-semibold">{c.title}</Text>
              <Text className="block text-[24rpx] text-[#999] mt-[8rpx]">满 {c.threshold} 元可用</Text>
              <Text className="block text-[22rpx] text-[#bbb] mt-[4rpx]">有效期至 {c.expireTime}</Text>
            </View>
            <Button
              className="self-end text-[24rpx] text-white bg-[#dd5145] rounded-[24rpx] px-[24rpx] py-[4rpx] leading-[40rpx]"
              onClick={() => onReceive(c.id)}
            >
              立即领取
            </Button>
          </View>
        </View>
      ))}
      {!loading && !list.length ? (
        <View className="text-center py-[120px] text-[#999]">
          <Text>暂无可领取优惠券</Text>
        </View>
      ) : null}
    </View>
  )
}
