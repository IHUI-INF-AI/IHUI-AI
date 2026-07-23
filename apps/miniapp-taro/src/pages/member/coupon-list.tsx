import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getCouponList } from '@/api'
import { useI18n } from '@/i18n'

interface Coupon {
  id: string
  title: string
  amount: number
  threshold: number
  expireTime: string
  status: string
}

export default function CouponListPage() {
  const { t } = useI18n()
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

  const onReceive = (_id: string) => {
    Taro.showToast({ title: t('member.couponList.received'), icon: 'success' })
    load()
  }

  return (
    <View className="min-h-screen bg-background p-[12px]">
      {list.map(c => (
        <View key={c.id} className="bg-card rounded-[8px] mb-[12px] flex overflow-hidden">
          <View className="bg-gradient-to-r from-[#00f2ff] to-[#8b5cf6] w-[180rpx] flex flex-col items-center justify-center py-[24rpx]">
            <View className="flex items-baseline">
              <Text className="text-[60rpx] text-white font-bold">{c.amount}</Text>
              <Text className="text-[26rpx] text-white ml-[4rpx]">{t('member.couponList.unit')}</Text>
            </View>
            <Text className="text-[22rpx] text-white mt-[4rpx]">{t('member.couponList.coupon')}</Text>
          </View>
          <View className="flex-1 px-[20rpx] py-[20rpx] flex flex-col justify-between">
            <View>
              <Text className="block text-[30rpx] text-foreground font-semibold">{c.title}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx]">{t('member.couponList.threshold', { threshold: c.threshold })}</Text>
              <Text className="block text-[22rpx] text-muted-foreground mt-[4rpx]">{t('member.couponList.expireTime', { time: c.expireTime })}</Text>
            </View>
            <Button
              className="self-end text-[24rpx] text-white bg-primary rounded-[24rpx] px-[24rpx] py-[4rpx] leading-[40rpx]"
              onClick={() => onReceive(c.id)}
            >
              {t('member.couponList.receive')}
            </Button>
          </View>
        </View>
      ))}
      {!loading && !list.length ? (
        <View className="text-center py-[120px] text-muted-foreground">
          <Text>{t('member.couponList.empty')}</Text>
        </View>
      ) : null}
    </View>
  )
}
