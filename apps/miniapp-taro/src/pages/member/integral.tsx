// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useRef, useCallback } from 'react'
import { getIntegral, getMemberInfo } from '@/api'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'

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
    <ThemeRoot>
      <View className="min-h-screen bg-background">
        {/* 余额卡(对齐 RN 共享 PointsRecordScreen balanceCard:success-light 底 + 深绿文字) */}
        <View className="mx-[20rpx] mt-[20rpx] rounded-[24rpx] bg-[var(--color-success-light)] py-[28rpx] px-[28rpx] text-center">
          <Text className="block text-[28rpx] text-[var(--color-success-deep-text)]">
            {tt('member.integral.current', '当前积分')}
          </Text>
          <Text className="block mt-[16rpx] text-[60rpx] font-bold text-[var(--color-success-deep-text)]">
            {total}
          </Text>
        </View>
        <View className="p-[20rpx] pb-[64rpx]">
          {list.map((it) => (
            <View
              key={it.id}
              className="mb-[16rpx] rounded-[24rpx] border border-[var(--color-border)] bg-background px-[28rpx] py-[28rpx]"
            >
              <View className="flex justify-between items-center">
                <Text className="flex-1 mr-[16rpx] text-[32rpx] font-semibold text-foreground">
                  {it.type}
                </Text>
                <Text
                  className={`text-[32rpx] font-semibold ${it.amount > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
                >
                  {it.amount > 0 ? '+' : ''}
                  {it.amount}
                </Text>
              </View>
              <View className="mt-[16rpx] flex justify-end">
                <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">{it.time}</Text>
              </View>
            </View>
          ))}
          {loading && !list.length ? (
            <View className="flex flex-col items-center py-[96rpx] text-muted-foreground text-[28rpx]">
              <Text>{t('common.loading')}</Text>
            </View>
          ) : null}
          {error && !list.length ? (
            <View className="flex flex-col items-center py-[96rpx] text-muted-foreground text-[28rpx]">
              <Text>{tt('member.integral.loadFailed', '加载失败')}</Text>
              <Text
                className="mt-[16rpx] py-[8rpx] px-[32rpx] text-[28rpx] text-primary"
                onClick={() => load(true)}
              >
                {t('common.retry')}
              </Text>
            </View>
          ) : null}
          {!loading && !list.length && !error ? (
            <View className="text-center py-[96rpx] text-[28rpx] text-muted-foreground">
              <Text>{tt('member.integral.empty', '暂无积分记录')}</Text>
            </View>
          ) : null}
          {loading && list.length ? (
            <View className="text-center py-[24rpx] text-[22rpx] text-[var(--color-text-tertiary)]">
              <Text>{tt('member.integral.loading', '加载中…')}</Text>
            </View>
          ) : null}
          {!loading && list.length && !hasMoreRef.current ? (
            <View className="text-center py-[24rpx] text-[22rpx] text-[var(--color-text-tertiary)]">
              <Text>{tt('member.integral.noMore', '没有更多了')}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
