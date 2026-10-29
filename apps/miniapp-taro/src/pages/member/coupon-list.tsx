// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import ThemeRoot from '@/components/ThemeRoot'

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

  const load = useCallback(() => {
    setError(false)
    // 「可领取券」这一档后端还没有:GET /api/coupons 的 status 只收 unused/used/expired,
    // 传 available 会被 zod 拒成 400;而 promo_coupons(券模板)目前只有 admin 面 CRUD,
    // 没有面向用户的公开列表与按 id 领取。端点上线前本页落空态 —— 把"这个能力还没有"
    // 渲染成"加载失败"会让下一个接手的人以为这只是网络问题。
    setList([])
    setLoading(false)
  }, [])

  useDidShow(load)
  usePullDownRefresh(() => {
    load()
    Taro.stopPullDownRefresh()
  })

  const onReceive = useCallback(
    (_id: string) => {
      Taro.showToast({ title: tt('member.couponList.received', '领取成功'), icon: 'success' })
      load()
    },
    [tt, load],
  )

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background p-[20rpx] pb-[64rpx]">
        {loading ? (
          <View className="flex flex-col items-center py-[64rpx] text-muted-foreground text-[length:28rpx]">
            <Text>{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="flex flex-col items-center py-[64rpx] text-muted-foreground text-[length:28rpx]">
            <Text>{tt('member.couponList.loadFailed', '加载失败')}</Text>
            <Text
              className="mt-[16rpx] py-[8rpx] px-[32rpx] text-[length:28rpx] text-primary"
              onClick={load}
            >
              {t('common.retry')}
            </Text>
          </View>
        ) : list.length ? (
          <View className="flex flex-col gap-[16rpx]">
            {list.map((c) => (
              <View
                key={c.id}
                className="flex bg-card border border-[var(--color-border)] rounded-lg overflow-hidden"
              >
                <View className="w-[192rpx] bg-[var(--color-success-light)] flex flex-col items-center justify-center py-[32rpx]">
                  <View className="flex items-baseline">
                    <Text className="text-[length:44rpx] font-bold text-[var(--color-success)]">
                      {c.amount}
                    </Text>
                    <Text className="text-[length:22rpx] ml-[4rpx] text-muted-foreground">
                      {tt('member.couponList.unit', '元')}
                    </Text>
                  </View>
                  <Text className="mt-[16rpx] text-[length:22rpx] text-muted-foreground">
                    {tt('member.couponList.coupon', '优惠券')}
                  </Text>
                </View>
                <View className="flex-1 p-[24rpx] flex flex-col justify-between">
                  <Text className="block text-[length:32rpx] text-foreground font-semibold">
                    {c.title}
                  </Text>
                  <Text className="block mt-[16rpx] text-[length:22rpx] text-muted-foreground">
                    {tt('member.couponList.thresholdText', '满{threshold}元可用', {
                      threshold: c.threshold,
                    })}
                  </Text>
                  <Text className="block mt-[8rpx] text-[length:22rpx] text-[var(--color-text-tertiary)]">
                    {tt('member.couponList.expireText', '有效期至 {time}', { time: c.expireTime })}
                  </Text>
                  <Button
                    className="self-end mt-[16rpx] text-[length:24rpx] text-cta-foreground bg-cta rounded-sm px-[28rpx] leading-[56rpx]"
                    onClick={() => onReceive(c.id)}
                  >
                    {tt('member.couponList.receive', '立即领取')}
                  </Button>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="text-center py-[64rpx] text-[length:28rpx] text-[var(--color-text-tertiary)]">
            <Text>{tt('member.couponList.empty', '暂无可领取优惠券')}</Text>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
