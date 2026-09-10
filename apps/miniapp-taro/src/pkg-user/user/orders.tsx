// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getOrderList, type Order } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-[var(--color-warning-amber-light)] text-[var(--color-warning-amber-text)]',
  paid: 'bg-[var(--color-success-light)] text-[var(--color-success-deep-text)]',
  refunding: 'bg-[var(--color-warning-amber-light)] text-[var(--color-warning-amber-text)]',
  refunded: 'bg-[var(--color-muted)] text-[var(--color-text-tertiary)]',
  cancelled: 'bg-[var(--color-danger-light)] text-[var(--color-danger)]',
  completed: 'bg-[var(--color-success-light)] text-[var(--color-success-deep-text)]',
  failed: 'bg-[var(--color-muted)] text-[var(--color-text-tertiary)]',
}

const STATUS_KEY: Record<string, string> = {
  pending: 'order.status.pending',
  paid: 'order.status.paid',
  cancelled: 'order.status.cancelled',
  refunding: 'order.status.refunding',
  refunded: 'order.status.refunded',
  completed: 'order.status.completed',
  failed: 'order.status.failed',
}

export default function Orders() {
  const { t } = useI18n()
  const [list, setList] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const pageSize = 10

  const statusText = (s: string) => (STATUS_KEY[s] ? t(STATUS_KEY[s]) : s)

  const load = useCallback(
    async (reset = false) => {
      if (loading) return
      let curPage = page
      let curList = list
      if (reset) {
        curPage = 1
        curList = []
        setList([])
        setHasMore(true)
      }
      if (!hasMore && !reset) return
      setLoading(true)
      try {
        const res = await getOrderList({ page: curPage, pageSize, status })
        const newList = [...curList, ...(res.list || [])]
        setList(newList)
        setHasMore(newList.length < res.total)
        setPage(curPage + 1)
      } catch {
        // 统一提示
      } finally {
        setLoading(false)
      }
    },
    [loading, page, hasMore, status, list, pageSize],
  )

  function switchStatus(s: string) {
    setStatus(s)
    setTimeout(() => load(true), 0)
  }

  function handlePay(item: Order) {
    Taro.navigateTo({ url: `/pkg-shop/pay/index?orderNo=${item.orderNo}&amount=${item.amount}` })
  }

  function goDetail(item: Order) {
    Taro.navigateTo({ url: `/pkg-shop/order/detail?id=${item.id}` })
  }

  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    load(true)
  }, [load])

  usePullDownRefresh(() => {
    load(true).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    load()
  })

  const tabs = [
    { key: '', label: t('user.orders.tabsAll') },
    { key: 'pending', label: t('user.orders.tabsPending') },
    { key: 'paid', label: t('user.orders.tabsPaid') },
    { key: 'cancelled', label: t('user.orders.tabsCancelled') },
    { key: 'refunded', label: t('order.status.refunded') },
  ]

  return (
    <ThemeRoot>
      {/* 对齐 RN 共享 OrderScreen:tab 药丸(白底/激活品牌底白字 28rpx 圆角 24rpx)+
          订单卡(描边 border.light + 圆角 24rpx + 内边距 24rpx):标题 32rpx/600 + 状态徽章
          (浅底深字 22rpx)+ 单号/时间 22rpx 三级字色 + 金额 36rpx/700 主字色 */}
      <View className="min-h-screen bg-background pb-[20rpx]">
        {/* 状态筛选 */}
        <View className="flex flex-wrap gap-[16rpx] px-[20rpx] py-[16rpx]">
          {tabs.map((tab) => (
            <View
              key={tab.key}
              className={`px-[28rpx] py-[12rpx] rounded-[24rpx] text-[28rpx] ${
                status === tab.key
                  ? 'bg-primary font-semibold text-[var(--color-surface-light)]'
                  : 'bg-card text-muted-foreground'
              }`}
              hoverClass="opacity-60"
              onClick={() => switchStatus(tab.key)}
            >
              <Text>{tab.label}</Text>
            </View>
          ))}
        </View>

        {/* 订单列表 */}
        {list.length > 0 ? (
          <View className="px-[20rpx]">
            {list.map((item) => (
              <View
                key={item.id}
                className="mb-[24rpx] rounded-[24rpx] border border-[var(--color-border)] bg-card p-[24rpx]"
                hoverClass="opacity-60"
                onClick={() => goDetail(item)}
              >
                <View className="flex items-center justify-between gap-[16rpx]">
                  <Text className="flex-1 truncate text-[32rpx] font-semibold text-foreground">
                    {item.title}
                  </Text>
                  <View
                    className={`shrink-0 rounded-[8rpx] px-[12rpx] py-[4rpx] ${
                      STATUS_COLOR[item.status] ||
                      'bg-[var(--color-muted)] text-[var(--color-text-tertiary)]'
                    }`}
                  >
                    <Text className="text-[22rpx]">{statusText(item.status)}</Text>
                  </View>
                </View>
                <View className="mt-[16rpx] flex items-center justify-between">
                  <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                    {t('user.orders.orderNo')}
                    {item.orderNo}
                  </Text>
                  <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                    {item.createTime}
                  </Text>
                </View>
                <View className="mt-[16rpx] flex items-end justify-between">
                  <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                    {item.type}
                  </Text>
                  <View className="flex items-center gap-[24rpx]">
                    <Text className="text-[36rpx] font-bold text-foreground">¥{item.amount}</Text>
                    {item.status === 'pending' ? (
                      <View
                        className="rounded-[24rpx] bg-primary px-[24rpx] py-[12rpx] text-[28rpx] text-[var(--color-surface-light)]"
                        hoverClass="opacity-60"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePay(item)
                        }}
                      >
                        <Text>{t('user.orders.pay')}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {!loading && list.length === 0 ? (
          <View className="py-[96rpx] text-center text-[28rpx] text-muted-foreground">
            <Text>{t('user.orders.empty')}</Text>
          </View>
        ) : null}
        {loading ? (
          <View className="py-[96rpx] text-center text-[28rpx] text-muted-foreground">
            <Text>{t('common.loading')}</Text>
          </View>
        ) : null}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
