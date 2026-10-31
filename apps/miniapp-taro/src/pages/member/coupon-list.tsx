// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { claimAvailableCoupon, getAvailableCoupons } from '@/api'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'

interface Coupon {
  id: string
  title: string
  amount: number
  threshold: number
  expireTime: string
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
      const res = await getAvailableCoupons({ page: 1, pageSize: 50 })
      setList(res.list)
    } catch (e) {
      logger.error('member/coupon-list', '获取可领券', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => void load())
  usePullDownRefresh(() => {
    void load().finally(() => Taro.stopPullDownRefresh())
  })

  const onReceive = useCallback(
    async (id: string) => {
      // 按券模板 id 领(不是按码):后端 /coupons/available 刻意不返回 code,
      // 码只出现在用户自己已领取的券上。归属主体由后端取自鉴权结果,这里不传 userId。
      try {
        await claimAvailableCoupon(id)
        Taro.showToast({ title: tt('member.couponList.received', '领取成功'), icon: 'success' })
      } catch (e) {
        logger.error('member/coupon-list', '领取优惠券', e)
        Taro.showToast({
          title: tt('member.couponList.receiveFailed', '领取失败'),
          icon: 'none',
        })
      }
      await load()
    },
    [tt, load],
  )

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background p-[20rpx] pb-[64rpx]">
        {loading ? (
          <View className="flex flex-col items-center py-[64rpx] text-muted-foreground text-body">
            <Text>{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="flex flex-col items-center py-[64rpx] text-muted-foreground text-body">
            <Text>{tt('member.couponList.loadFailed', '加载失败')}</Text>
            <Text
              className="mt-[16rpx] py-[8rpx] px-[32rpx] text-body text-primary"
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
                    <Text className="text-caption ml-[4rpx] text-muted-foreground">
                      {tt('member.couponList.unit', '元')}
                    </Text>
                  </View>
                  <Text className="mt-[16rpx] text-caption text-muted-foreground">
                    {tt('member.couponList.coupon', '优惠券')}
                  </Text>
                </View>
                <View className="flex-1 p-[24rpx] flex flex-col justify-between">
                  <Text className="block text-title text-foreground font-semibold">
                    {c.title}
                  </Text>
                  <Text className="block mt-[16rpx] text-caption text-muted-foreground">
                    {tt('member.couponList.thresholdText', '满{threshold}元可用', {
                      threshold: c.threshold,
                    })}
                  </Text>
                  <Text className="block mt-[8rpx] text-caption text-[var(--color-text-tertiary)]">
                    {tt('member.couponList.expireText', '有效期至 {time}', { time: c.expireTime })}
                  </Text>
                  <Button
                    className="self-end mt-[16rpx] text-label text-cta-foreground bg-cta rounded-sm px-[28rpx] leading-[56rpx]"
                    onClick={() => onReceive(c.id)}
                  >
                    {tt('member.couponList.receive', '立即领取')}
                  </Button>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="text-center py-[64rpx] text-body text-[var(--color-text-tertiary)]">
            <Text>{tt('member.couponList.empty', '暂无可领取优惠券')}</Text>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
