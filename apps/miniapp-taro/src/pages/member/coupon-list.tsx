import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getCouponList } from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'

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
  const [error, setError] = useState(false)

  const tt = useCallback(
    (key: string, fallback: string, params?: Record<string, string | number>) => {
      const v = t(key, params)
      if (v === key) {
        if (!params) return fallback
        return fallback.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''))
      }
      return v
    },
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getCouponList({ status: 'available' })
      setList(res.list || [])
    } catch (e) {
      logger.error('member/coupon-list', '获取优惠券', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => load())
  usePullDownRefresh(() => load().finally(() => Taro.stopPullDownRefresh()))

  const onReceive = useCallback(
    (_id: string) => {
      Taro.showToast({ title: tt('member.couponList.received', '领取成功'), icon: 'success' })
      load()
    },
    [tt, load],
  )

  return (
    <View className="min-h-screen bg-background p-[24rpx] pb-[48rpx]">
      {loading ? (
        <View className="flex flex-col items-center py-[120rpx] text-muted-foreground text-[26rpx]">
          <Text>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View className="flex flex-col items-center py-[120rpx] text-muted-foreground text-[26rpx]">
          <Text>{tt('member.couponList.loadFailed', '加载失败')}</Text>
          <Text className="mt-[16rpx] py-[8rpx] px-[32rpx] text-[24rpx] text-primary" onClick={load}>
            {t('common.retry')}
          </Text>
        </View>
      ) : list.length ? (
        <View className="flex flex-col gap-[24rpx]">
          {list.map((c) => (
            <View key={c.id} className="flex bg-card rounded-[16rpx] overflow-hidden">
              <View className="w-[200rpx] bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] text-white flex flex-col items-center justify-center py-[24rpx]">
                <View className="flex items-baseline">
                  <Text className="text-[60rpx] font-bold">{c.amount}</Text>
                  <Text className="text-[26rpx] ml-[4rpx]">{tt('member.couponList.unit', '元')}</Text>
                </View>
                <Text className="mt-[8rpx] text-[22rpx] opacity-90">{tt('member.couponList.coupon', '优惠券')}</Text>
              </View>
              <View className="flex-1 p-[24rpx] flex flex-col justify-between">
                <Text className="block text-[30rpx] text-foreground font-semibold">{c.title}</Text>
                <Text className="block mt-[12rpx] text-[24rpx] text-muted-foreground">
                  {tt('member.couponList.thresholdText', '满{threshold}元可用', {
                    threshold: c.threshold,
                  })}
                </Text>
                <Text className="block mt-[8rpx] text-[22rpx] text-muted-foreground">
                  {tt('member.couponList.expireText', '有效期至 {time}', { time: c.expireTime })}
                </Text>
                <Button className="self-end mt-[16rpx] text-[24rpx] text-white bg-primary rounded-[28rpx] px-[28rpx] leading-[56rpx]" onClick={() => onReceive(c.id)}>
                  {tt('member.couponList.receive', '立即领取')}
                </Button>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="text-center py-[120rpx] text-muted-foreground text-[26rpx]">
          <Text>{tt('member.couponList.empty', '暂无可领取优惠券')}</Text>
        </View>
      )}
    </View>
  )
}
