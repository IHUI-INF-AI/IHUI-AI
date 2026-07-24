import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
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

const TABS = [
  { key: 'unused', i18nKey: 'member.coupon.unused', fallback: '未使用' },
  { key: 'used', i18nKey: 'member.coupon.used', fallback: '已使用' },
  { key: 'expired', i18nKey: 'member.coupon.expired', fallback: '已过期' },
]

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
        logger.error('member/coupon', '获取优惠券', e)
        setError(true)
        setList([])
        setShown([])
      } finally {
        setLoading(false)
      }
    },
    [status],
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
    <View className="min-h-screen bg-background pb-[140rpx]">
      <View className="flex bg-card">
        {TABS.map((tb) => (
          <Text
            key={tb.key}
            className={`flex-1 text-center text-[26rpx] py-[24rpx] ${status === tb.key ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
            onClick={() => switchTab(tb.key)}
          >
            {tt(tb.i18nKey, tb.fallback)}
          </Text>
        ))}
      </View>
      {loading ? (
        <View className="flex flex-col items-center py-[80rpx] text-muted-foreground text-[26rpx]">
          <Text>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View className="flex flex-col items-center py-[80rpx] text-muted-foreground text-[26rpx]">
          <Text>{tt('member.coupon.loadFailed', '加载失败')}</Text>
          <Text
            className="mt-[16rpx] px-[32rpx] py-[8rpx] text-[24rpx] text-primary"
            onClick={() => load()}
          >
            {t('common.retry')}
          </Text>
        </View>
      ) : shown.length ? (
        <View className="p-[24rpx]">
          {shown.map((c) => (
            <View
              key={c.id}
              className={`flex bg-card rounded-[16rpx] overflow-hidden mb-[24rpx] ${c.status !== 'unused' ? 'opacity-50' : ''}`}
            >
              <View
                className={`w-[200rpx] flex flex-col items-center justify-center py-[24rpx] ${c.status !== 'unused' ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}
              >
                <View className="flex items-baseline">
                  <Text className="text-[56rpx] font-bold">{c.amount}</Text>
                  <Text className="text-[24rpx] ml-[8rpx]">{tt('member.coupon.unit', '元')}</Text>
                </View>
                <Text className="block mt-[8rpx] text-[20rpx] opacity-90">
                  {tt('member.coupon.thresholdText', '满{threshold}可用', {
                    threshold: c.threshold,
                  })}
                </Text>
              </View>
              <View className="flex-1 p-[24rpx] flex flex-col justify-between">
                <Text className="block text-[28rpx] text-foreground font-semibold">{c.title}</Text>
                <Text className="block mt-[12rpx] text-[22rpx] text-muted-foreground">
                  {tt('member.coupon.expireText', '有效期至 {time}', { time: c.expireTime })}
                </Text>
                {c.status === 'unused' ? (
                  <Button
                    className="self-end mt-[16rpx] text-[24rpx] text-primary-foreground bg-primary rounded-[28rpx] px-[28rpx] leading-[56rpx]"
                    onClick={useCoupon}
                  >
                    {tt('member.coupon.use', '立即使用')}
                  </Button>
                ) : (
                  <Text className="self-end mt-[16rpx] text-[22rpx] text-muted-foreground">
                    {tt(`member.coupon.${c.status}`, c.status === 'used' ? '已使用' : '已过期')}
                  </Text>
                )}
              </View>
            </View>
          ))}
          {hasMoreRef.current ? (
            <View className="text-center py-[24rpx] text-[22rpx] text-muted-foreground">
              <Text>{tt('member.coupon.loadMore', '上拉加载更多')}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View className="text-center py-[120rpx] text-muted-foreground text-[26rpx]">
          <Text>{tt('member.coupon.empty', '暂无优惠券')}</Text>
        </View>
      )}
      <Button
        className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] bg-primary text-primary-foreground rounded-[40rpx] text-[28rpx]"
        onClick={goList}
      >
        {tt('member.coupon.couponCenter', '领券中心')}
      </Button>
    </View>
  )
}
