import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useRef, useCallback } from 'react'
import { getIntegral, getMemberInfo } from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import './integral.css'

interface IntegralItem {
  id: string
  type: string
  amount: number
  time: string
}

const PAGE_SIZE = 20

export default function IntegralPage() {
  const { t } = useI18n()
  const [list, setList] = useState<IntegralItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [total, setTotal] = useState(0)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

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
    async (reset = false) => {
      if (loadingRef.current) return
      if (reset) {
        pageRef.current = 1
        hasMoreRef.current = true
        setList([])
        setError(false)
      }
      if (!hasMoreRef.current) return
      loadingRef.current = true
      setLoading(true)
      try {
        const res = await getIntegral({ page: pageRef.current, pageSize: PAGE_SIZE })
        const items = res.list || []
        setList((prev) => (reset ? items : [...prev, ...items]))
        hasMoreRef.current = pageRef.current * PAGE_SIZE < res.total
        pageRef.current++
      } catch (e) {
        logger.error('member/integral', '获取积分明细', e)
        if (reset) setError(true)
        else Taro.showToast({ title: tt('member.integral.loadFailed', '加载失败'), icon: 'none' })
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [tt],
  )

  const loadTotal = useCallback(async () => {
    try {
      const info = await getMemberInfo()
      setTotal(info.integral || 0)
    } catch (e) {
      logger.error('member/integral', '获取积分余额', e)
    }
  }, [])

  useDidShow(() => {
    loadTotal()
    load(true)
  })
  useReachBottom(() => load())
  usePullDownRefresh(() =>
    Promise.all([loadTotal(), load(true)]).finally(() => Taro.stopPullDownRefresh()),
  )

  return (
    <View className="page">
      <View className="balance">
        <Text className="balance-num">{total}</Text>
        <Text className="balance-label">{tt('member.integral.current', '当前积分')}</Text>
      </View>
      <View className="list">
        {list.map((it) => (
          <View key={it.id} className="item">
            <View className="item-left">
              <Text className="item-type">{it.type}</Text>
              <Text className="item-time">{it.time}</Text>
            </View>
            <Text className={`item-amt${it.amount > 0 ? ' income' : ' expense'}`}>
              {it.amount > 0 ? '+' : ''}
              {it.amount}
            </Text>
          </View>
        ))}
        {loading && !list.length ? (
          <View className="status">
            <Text>{t('common.loading')}</Text>
          </View>
        ) : null}
        {error && !list.length ? (
          <View className="status">
            <Text>{tt('member.integral.loadFailed', '加载失败')}</Text>
            <Text className="retry" onClick={() => load(true)}>
              {t('common.retry')}
            </Text>
          </View>
        ) : null}
        {!loading && !list.length && !error ? (
          <View className="empty">
            <Text>{tt('member.integral.empty', '暂无积分记录')}</Text>
          </View>
        ) : null}
        {loading && list.length ? (
          <View className="load-more">
            <Text>{tt('member.integral.loading', '加载中…')}</Text>
          </View>
        ) : null}
        {!loading && list.length && !hasMoreRef.current ? (
          <View className="load-more">
            <Text>{tt('member.integral.noMore', '没有更多了')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
