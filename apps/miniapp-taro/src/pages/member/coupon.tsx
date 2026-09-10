// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, type TtFn } from '@/i18n'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { getCouponList } from '@/api'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'

interface Coupon {
  id: string
  title: string
  amount: number
  threshold: number
  expireTime: string
  status: string
}

const TABS = (tt: TtFn) => [
  { key: 'unused', i18nKey: 'member.coupon.unused', fallback: tt('coupon.available', '未使用') },
  { key: 'used', i18nKey: 'member.coupon.used', fallback: tt('coupon.used', '已使用') },
  {
    key: 'expired',
    i18nKey: 'member.coupon.expired',
    fallback: tt('member.index.expired', '已过期'),
  },
]

const COUPON_STATUS_KEY: Record<string, string> = {
  unused: 'member.coupon.unused',
  used: 'member.coupon.used',
  expired: 'member.coupon.expired',
}

const PAGE_SIZE = 10

export default function CouponPage() {
  const { t } = useI18n()
  const [list, setList] = useState<Coupon[]>([])
  const [shown, setShown] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [status, setStatus] = useState('unused')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)

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

  const load = useCallback(
    async (s?: string) => {
      const st = s ?? status
      setLoading(true)
      setError(false)
      try {
        const res = await getCouponList({ status: st })
        const items = res.list || []
        setList(items)
        pageRef.current = 1
        hasMoreRef.current = items.length > PAGE_SIZE
        setShown(items.slice(0, PAGE_SIZE))
      } catch (e) {
        logger.error('member/coupon', tt('memberCoupon.q1', '获取优惠券'), e)
        setError(true)
        setList([])
        setShown([])
      } finally {
        setLoading(false)
      }
    },
    [status, tt],
  )

  const switchTab = useCallback(
    (s: string) => {
      setStatus(s)
      load(s)
    },
    [load],
  )

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || loading) return
    const next = pageRef.current + 1
    setShown(list.slice(0, next * PAGE_SIZE))
    hasMoreRef.current = next * PAGE_SIZE < list.length
    pageRef.current = next
  }, [list, loading])

  const useCoupon = useCallback(() => {
    Taro.showToast({ title: tt('member.coupon.useHint', '请前往商品页使用'), icon: 'none' })
  }, [tt])

  const goList = useCallback(() => {
    Taro.navigateTo({ url: '/pages/member/coupon-list' })
  }, [])

  useDidShow(() => load())
  useReachBottom(() => loadMore())
  usePullDownRefresh(() => load().finally(() => Taro.stopPullDownRefresh()))

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background pb-[140rpx]">
        {/* tab 胶囊切换栏(对齐 RN 共享 CouponScreen tabs:card 底胶囊 + 选中 brand 底) */}
        <View className="flex gap-[16rpx] px-[20rpx] py-[16rpx]">
          {TABS(tt).map((tb) => (
            <View
              key={tb.key}
              className={`px-[24rpx] py-[12rpx] rounded-[16rpx] ${status === tb.key ? 'bg-primary' : 'bg-card'}`}
              onClick={() => switchTab(tb.key)}
              hoverClass="opacity-60"
            >
              <Text
                className={`text-[28rpx] ${status === tb.key ? 'text-primary-foreground font-semibold' : 'text-muted-foreground'}`}
              >
                {tt(tb.i18nKey, tb.fallback)}
              </Text>
            </View>
          ))}
        </View>
        {loading ? (
          <View className="flex flex-col items-center py-[64rpx] text-muted-foreground text-[28rpx]">
            <Text>{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="flex flex-col items-center py-[64rpx] text-[28rpx]">
            <Text className="text-[var(--color-danger)]">
              {tt('member.coupon.loadFailed', '加载失败')}
            </Text>
            <Text
              className="mt-[16rpx] px-[32rpx] py-[8rpx] text-[28rpx] text-[var(--color-success)]"
              onClick={() => load()}
            >
              {t('common.retry')}
            </Text>
          </View>
        ) : shown.length ? (
          <View className="p-[20rpx] pb-[64rpx]">
            {shown.map((c) => (
              <View
                key={c.id}
                className="flex bg-card border border-[var(--color-border)] rounded-[24rpx] overflow-hidden mb-[16rpx]"
              >
                <View className="w-[192rpx] bg-[var(--color-success-light)] flex flex-col items-center justify-center py-[32rpx]">
                  <View className="flex items-baseline">
                    <Text className="text-[44rpx] font-bold text-[var(--color-success)]">
                      {c.amount}
                    </Text>
                    <Text className="text-[22rpx] ml-[8rpx] text-muted-foreground">
                      {tt('member.coupon.unit', '元')}
                    </Text>
                  </View>
                  <Text className="block mt-[16rpx] text-[22rpx] text-muted-foreground text-center">
                    {tt('member.coupon.thresholdText', '满{threshold}可用', {
                      threshold: c.threshold,
                    })}
                  </Text>
                </View>
                <View className="flex-1 p-[24rpx] flex flex-col justify-between">
                  <Text className="block text-[32rpx] text-foreground font-semibold">
                    {c.title}
                  </Text>
                  <Text className="block mt-[16rpx] text-[22rpx] text-[var(--color-text-tertiary)]">
                    {tt('member.coupon.expireText', '有效期至 {time}', { time: c.expireTime })}
                  </Text>
                  {c.status === 'unused' ? (
                    <Button
                      className="self-start mt-[16rpx] text-[22rpx] text-primary-foreground bg-primary rounded-[16rpx] px-[16rpx] leading-[44rpx]"
                      onClick={useCoupon}
                    >
                      {tt('member.coupon.use', '立即使用')}
                    </Button>
                  ) : (
                    <View
                      className={`self-start mt-[16rpx] px-[16rpx] py-[4rpx] rounded-[16rpx] ${c.status === 'used' ? 'bg-[var(--color-text-tertiary)]' : 'bg-[var(--color-danger)]'}`}
                    >
                      <Text className="text-[22rpx] text-[var(--color-surface-light)]">
                        {tt(
                          COUPON_STATUS_KEY[c.status] ?? 'member.coupon.expired',
                          c.status === 'used'
                            ? tt('coupon.used', '已使用')
                            : tt('member.index.expired', '已过期'),
                        )}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
            {hasMoreRef.current ? (
              <View className="text-center py-[24rpx] text-[22rpx] text-[var(--color-text-tertiary)]">
                <Text>{tt('member.coupon.loadMore', '上拉加载更多')}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="text-center py-[64rpx] text-[28rpx] text-[var(--color-text-tertiary)]">
            <Text>{tt('member.coupon.empty', '暂无优惠券')}</Text>
          </View>
        )}
        <Button
          className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] bg-primary text-primary-foreground rounded-[24rpx] text-[28rpx] h-[88rpx] leading-[88rpx]"
          onClick={goList}
        >
          {tt('member.coupon.couponCenter', '领券中心')}
        </Button>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
