import { View, Text } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getOrderList, type Order } from '@/api'
import { useI18n } from '@/i18n'

const STATUS_COLOR: Record<string, string> = {
  paid: 'text-primary',
  pending: 'text-[#f59e0b]',
  refunding: 'text-[#f59e0b]',
  refunded: 'text-muted-foreground',
  cancelled: 'text-muted-foreground',
  completed: 'text-primary',
  failed: 'text-destructive',
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
    Taro.navigateTo({ url: `/pages/pay/index?orderNo=${item.orderNo}&amount=${item.amount}` })
  }

  function goDetail(item: Order) {
    Taro.navigateTo({ url: `/pages/order/detail?id=${item.id}` })
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
    <View className="min-h-screen px-[16px] py-[12px]">
      {/* 状态筛选 */}
      <View className="flex mb-[12px] bg-card rounded-[6px]">
        {tabs.map((tab) => (
          <View
            key={tab.key}
            className={`flex-1 text-center py-[10px] text-[13px] ${
              status === tab.key ? 'text-primary font-semibold' : 'text-muted-foreground'
            }`}
            onClick={() => switchStatus(tab.key)}
          >
            <Text>{tab.label}</Text>
          </View>
        ))}
      </View>

      {/* 订单列表 */}
      {list.length > 0 ? (
        <View>
          {list.map((item) => (
            <View
              key={item.id}
              className="bg-card rounded-[8px] px-[12px] py-[12px] mb-[12px]"
              onClick={() => goDetail(item)}
            >
              <View className="flex justify-between items-center">
                <Text className="text-[12px] text-muted-foreground">
                  {t('user.orders.orderNo')}
                  {item.orderNo}
                </Text>
                <Text className={`text-[13px] ${STATUS_COLOR[item.status] || 'text-muted-foreground'}`}>
                  {statusText(item.status)}
                </Text>
              </View>
              <View className="flex flex-col my-[10px]">
                <Text className="text-[15px] text-foreground font-semibold">{item.title}</Text>
                <Text className="mt-[4px] text-[12px] text-muted-foreground">{item.type}</Text>
              </View>
              <View className="flex items-center pt-[10px]">
                <Text className="flex-1 text-[12px] text-muted-foreground">{item.createTime}</Text>
                <View className="mr-[12px]">
                  <Text className="text-[12px] text-[#dd524d]">¥</Text>
                  <Text className="text-[17px] text-[#dd524d] font-bold">{item.amount}</Text>
                </View>
                {item.status === 'pending' ? (
                  <View
                    className="px-[16px] py-[5px] bg-primary text-white rounded-[6px] text-[13px]"
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
          ))}
        </View>
      ) : null}

      {!loading && list.length === 0 ? (
        <View className="text-center py-[60px] text-muted-foreground text-[13px]">
          <Text>{t('user.orders.empty')}</Text>
        </View>
      ) : null}
      {loading ? (
        <View className="text-center py-[60px] text-muted-foreground text-[13px]">
          <Text>{t('common.loading')}</Text>
        </View>
      ) : null}
    </View>
  )
}
