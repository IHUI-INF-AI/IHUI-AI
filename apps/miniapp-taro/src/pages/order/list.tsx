import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getOrderList, type Order } from '@/api'
import { useI18n } from '@/i18n'

const STATUS_COLOR: Record<string, string> = {
  paid: 'text-primary',
  pending: 'text-[#f59e0b]',
  refunded: 'text-muted-foreground',
}

const STATUS_KEYS: Record<string, string> = {
  pending: 'order.status.pending',
  paid: 'order.status.paid',
  cancelled: 'order.status.cancelled',
  refunded: 'order.status.refunded',
}

const TABS = [
  { value: '', labelKey: 'order.tabs.all' },
  { value: 'pending', labelKey: 'order.tabs.pending' },
  { value: 'paid', labelKey: 'order.tabs.paid' },
  { value: 'refunded', labelKey: 'order.tabs.refunded' },
]

const PAGE_SIZE = 10

export default function OrderList() {
  const { t } = useI18n()
  const [list, setList] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const statusRef = useRef('')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setList([])
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getOrderList({
        page: pageRef.current,
        pageSize: PAGE_SIZE,
        status: statusRef.current || undefined,
      })
      const items = res.list || []
      setList((prev) => (reset ? items : [...prev, ...items]))
      hasMoreRef.current = pageRef.current * PAGE_SIZE < res.total
      pageRef.current++
    } catch {
      // ignore
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  const switchTab = (s: string) => {
    statusRef.current = s
    setStatus(s)
    load(true)
  }

  const goDetail = (id: string | number) => {
    Taro.navigateTo({ url: `/pages/order/detail?id=${id}` })
  }

  const goRefund = (o: Order) => {
    Taro.navigateTo({ url: `/pages/order/refund?orderNo=${o.orderNo}` })
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
    <View className="min-h-screen bg-background">
      <View className="flex bg-card sticky top-0 z-10">
        {TABS.map((tab) => (
          <Text
            key={tab.value}
            className={`flex-1 text-center text-[26rpx] py-[24rpx] ${status === tab.value ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
            onClick={() => switchTab(tab.value)}
          >
            {t(tab.labelKey)}
          </Text>
        ))}
      </View>
      {list.length > 0 && (
        <View className="p-[24rpx]">
          {list.map((o) => (
            <View
              key={o.id}
              className="bg-card rounded-[16rpx] p-[32rpx] mb-[24rpx]"
              onClick={() => goDetail(o.id)}
            >
              <View className="flex justify-between items-center">
                <Text className="text-[30rpx] text-foreground font-semibold">{o.title}</Text>
                <Text className={`text-[24rpx] ${STATUS_COLOR[o.status] || ''}`}>
                  {STATUS_KEYS[o.status] ? t(STATUS_KEYS[o.status] as string) : o.status}
                </Text>
              </View>
              <Text className="block text-[22rpx] text-muted-foreground mt-[12rpx]">
                {t('order.orderNo')}：{o.orderNo}
              </Text>
              <View className="flex justify-between mt-[16rpx]">
                <Text className="text-[24rpx] text-muted-foreground">{o.createTime}</Text>
                <Text className="text-[32rpx] text-destructive font-semibold">¥{o.amount}</Text>
              </View>
              {o.status === 'paid' && (
                <View className="mt-[24rpx] text-right">
                  <Text
                    className="inline-block text-[24rpx] text-primary px-[24rpx] py-[8rpx] border-[2rpx] border-primary rounded-[24rpx]"
                    onClick={(e) => {
                      e.stopPropagation()
                      goRefund(o)
                    }}
                  >
                    {t('order.applyRefund')}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
      {list.length === 0 && !loading && (
        <View className="text-center py-[120rpx] text-muted-foreground">
          <Text>{t('order.empty')}</Text>
        </View>
      )}
      {loading && (
        <View className="text-center py-[120rpx] text-muted-foreground">
          <Text>{t('common.loading')}</Text>
        </View>
      )}
    </View>
  )
}
