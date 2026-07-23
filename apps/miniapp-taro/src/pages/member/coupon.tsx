import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useRef } from 'react'
import { getCouponList } from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import './coupon.css'

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
    <View className="page">
      <View className="tabs">
        {TABS.map((tb) => (
          <Text
            key={tb.key}
            className={`tab${status === tb.key ? ' active' : ''}`}
            onClick={() => switchTab(tb.key)}
          >
            {tt(tb.i18nKey, tb.fallback)}
          </Text>
        ))}
      </View>
      {loading ? (
        <View className="status">
          <Text>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View className="status">
          <Text>{tt('member.coupon.loadFailed', '加载失败')}</Text>
          <Text className="retry" onClick={() => load()}>
            {t('common.retry')}
          </Text>
        </View>
      ) : shown.length ? (
        <View className="list">
          {shown.map((c) => (
            <View key={c.id} className={`coupon${c.status !== 'unused' ? ' disabled' : ''}`}>
              <View className="coupon-left">
                <View className="c-amt-row">
                  <Text className="c-amt">{c.amount}</Text>
                  <Text className="c-unit">{tt('member.coupon.unit', '元')}</Text>
                </View>
                <Text className="c-thres">
                  {tt('member.coupon.thresholdText', '满{threshold}可用', { threshold: c.threshold })}
                </Text>
              </View>
              <View className="coupon-right">
                <Text className="c-title">{c.title}</Text>
                <Text className="c-time">
                  {tt('member.coupon.expireText', '有效期至 {time}', { time: c.expireTime })}
                </Text>
                {c.status === 'unused' ? (
                  <Button className="c-btn" onClick={useCoupon}>
                    {tt('member.coupon.use', '立即使用')}
                  </Button>
                ) : (
                  <Text className="c-status">
                    {tt(
                      `member.coupon.${c.status}`,
                      c.status === 'used' ? '已使用' : '已过期',
                    )}
                  </Text>
                )}
              </View>
            </View>
          ))}
          {hasMoreRef.current ? (
            <View className="load-more">
              <Text>{tt('member.coupon.loadMore', '上拉加载更多')}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View className="empty">
          <Text>{tt('member.coupon.empty', '暂无优惠券')}</Text>
        </View>
      )}
      <Button className="btn" onClick={goList}>
        {tt('member.coupon.couponCenter', '领券中心')}
      </Button>
    </View>
  )
}
