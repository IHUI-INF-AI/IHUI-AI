import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getCouponList } from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import './coupon-list.css'

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
    <View className="page">
      {loading ? (
        <View className="status">
          <Text>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View className="status">
          <Text>{tt('member.couponList.loadFailed', '加载失败')}</Text>
          <Text className="retry" onClick={load}>
            {t('common.retry')}
          </Text>
        </View>
      ) : list.length ? (
        <View className="list">
          {list.map((c) => (
            <View key={c.id} className="coupon">
              <View className="coupon-left">
                <View className="c-amt-row">
                  <Text className="c-amt">{c.amount}</Text>
                  <Text className="c-unit">{tt('member.couponList.unit', '元')}</Text>
                </View>
                <Text className="c-type">{tt('member.couponList.coupon', '优惠券')}</Text>
              </View>
              <View className="coupon-right">
                <Text className="c-title">{c.title}</Text>
                <Text className="c-thres">
                  {tt('member.couponList.thresholdText', '满{threshold}元可用', {
                    threshold: c.threshold,
                  })}
                </Text>
                <Text className="c-time">
                  {tt('member.couponList.expireText', '有效期至 {time}', { time: c.expireTime })}
                </Text>
                <Button className="c-btn" onClick={() => onReceive(c.id)}>
                  {tt('member.couponList.receive', '立即领取')}
                </Button>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="empty">
          <Text>{tt('member.couponList.empty', '暂无可领取优惠券')}</Text>
        </View>
      )}
    </View>
  )
}
