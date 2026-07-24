import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useRef } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'

interface OrderItem {
  id: string
  orderNo: string
  product: string
  amount: number
  commission: number
  status: string
  time: string
}

type TabValue = '' | 'settled' | 'pending'

interface Tab {
  value: TabValue
  labelKey: string
  fallback: string
}

const TABS: Tab[] = [
  { value: '', labelKey: 'distribution.orderList.all', fallback: '全部' },
  { value: 'settled', labelKey: 'distribution.orderList.settled', fallback: '已结算' },
  { value: 'pending', labelKey: 'distribution.orderList.pending', fallback: '待结算' },
]

const STATUS_LABELS: Record<string, { key: string; fb: string; cls: string }> = {
  settled: { key: 'distribution.orderList.settled', fb: '已结算', cls: 'text-[#22c55e]' },
  pending: { key: 'distribution.orderList.pending', fb: '待结算', cls: 'text-[#f59e0b]' },
  paid: { key: 'distribution.orderList.settled', fb: '已结算', cls: 'text-[#22c55e]' },
  unpaid: { key: 'distribution.orderList.pending', fb: '待结算', cls: 'text-[#f59e0b]' },
}

const PAGE_SIZE = 20

export default function DistributionOrderList() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }
  const [list, setList] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [activeTab, setActiveTab] = useState<TabValue>('')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const tabRef = useRef<TabValue>('')

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setHasMore(true)
      setList([])
      setError(false)
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = (await api.get('/distribution/orders', {
        page: pageRef.current,
        pageSize: PAGE_SIZE,
        status: tabRef.current || undefined,
      })) as unknown as {
        list: Array<Record<string, unknown>>
        total: number
      }
      const items: OrderItem[] = (res.list || []).map((o) => ({
        id: String(o.id ?? ''),
        orderNo: (o.orderNo as string) || (o.order_no as string) || '',
        product:
          (o.product as string) ||
          (o.title as string) ||
          (o.goodsName as string) ||
          tt('distribution.orderList.product', '商品'),
        amount: (o.amount as number) ?? (o.totalAmount as number) ?? 0,
        commission: (o.commission as number) ?? (o.commissionAmount as number) ?? 0,
        status: (o.status as string) ?? 'pending',
        time: (o.createTime as string) || (o.createdAt as string) || (o.time as string) || '',
      }))
      setList((prev) => (reset ? items : [...prev, ...items]))
      const more = pageRef.current * PAGE_SIZE < (res.total ?? 0)
      hasMoreRef.current = more
      setHasMore(more)
      pageRef.current++
    } catch (e) {
      logger.error('unknown', '加载分销订单', e)
      setError(true)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  const switchTab = (tab: TabValue) => {
    tabRef.current = tab
    setActiveTab(tab)
    load(true)
  }

  const onItemClick = (id: string) => {
    Taro.navigateTo({ url: `/pages/order/detail?id=${id}` })
  }

  useDidShow(() => {
    load(true)
  })

  useReachBottom(() => {
    load()
  })

  usePullDownRefresh(() => {
    load(true).finally(() => Taro.stopPullDownRefresh())
  })

  return (
    <View className="min-h-screen bg-background pb-[60rpx]">
      <View className="flex bg-card sticky top-0 z-10">
        {TABS.map((tab) => (
          <View
            key={tab.value}
            className={`flex-1 text-center py-[24rpx] text-[26rpx] text-muted-foreground relative ${activeTab === tab.value ? 'text-[#00f2ff] font-semibold' : ''}`}
            onClick={() => switchTab(tab.value)}
          >
            <Text>{tt(tab.labelKey, tab.fallback)}</Text>
          </View>
        ))}
      </View>

      {list.length > 0 && (
        <View className="flex flex-col gap-[16rpx] p-[24rpx]">
          {list.map((o) => {
            const statusInfo = STATUS_LABELS[o.status] || {
              key: '',
              fb: o.status,
              cls: 'text-[#f59e0b]',
            }
            return (
              <View
                key={o.id}
                className="p-[28rpx] bg-card border-[2rpx] border-[rgba(0,242,255,0.1)] rounded-[12rpx]"
                onClick={() => onItemClick(o.id)}
              >
                <View className="flex items-center justify-between">
                  <Text className="text-[22rpx] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">
                    {tt('distribution.orderList.orderNo', '订单号')}:{o.orderNo || '-'}
                  </Text>
                  <Text
                    className={`text-[24rpx] font-semibold ml-[16rpx] shrink-0 ${statusInfo.cls}`}
                  >
                    {statusInfo.key ? tt(statusInfo.key, statusInfo.fb) : statusInfo.fb}
                  </Text>
                </View>
                <Text className="block text-[28rpx] font-medium text-foreground mt-[16rpx] overflow-hidden text-ellipsis whitespace-nowrap">
                  {o.product}
                </Text>
                <View className="flex items-center justify-between mt-[20rpx]">
                  <View className="flex items-center gap-[24rpx]">
                    <Text className="text-[24rpx] text-muted-foreground">
                      {tt('distribution.orderList.amount', '金额')} ¥{o.amount}
                    </Text>
                    <Text className="text-[26rpx] font-semibold text-[#00f2ff]">
                      {tt('distribution.orderList.commission', '佣金')} ¥{o.commission}
                    </Text>
                  </View>
                  <Text className="text-[22rpx] text-muted-foreground">{o.time || '-'}</Text>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {list.length === 0 && !loading && !error && (
        <Text className="block text-center text-[26rpx] text-muted-foreground py-[80rpx]">
          {t('distribution.orderList.empty')}
        </Text>
      )}

      {error && !loading && (
        <View className="flex flex-col items-center py-[60rpx]" onClick={() => load(true)}>
          <Text className="text-[26rpx] text-destructive">
            {tt('distribution.orderList.error', '加载失败')}
          </Text>
          <Text className="text-[26rpx] text-[#00f2ff] mt-[12rpx]">
            {tt('distribution.orderList.retry', '点击重试')}
          </Text>
        </View>
      )}

      {loading && (
        <Text className="block text-center text-[26rpx] text-muted-foreground py-[80rpx]">
          {t('distribution.orderList.loading')}
        </Text>
      )}

      {!loading && !hasMore && list.length > 0 && (
        <Text className="block text-center text-[26rpx] text-muted-foreground py-[80rpx]">
          {tt('distribution.orderList.noMore', '没有更多了')}
        </Text>
      )}
    </View>
  )
}
