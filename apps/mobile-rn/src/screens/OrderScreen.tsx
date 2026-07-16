import { useEffect, useState } from 'react'
import { FlatList, Text, View } from 'react-native'
import { Card } from '@ihui/ui-native'
import { getOrders, type Order, type OrderStatus } from '@ihui/api-client'

const PAGE_SIZE = 20

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  cancelled: '已取消',
  refunding: '退款中',
  refunded: '已退款',
  completed: '已完成',
  failed: '失败',
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-neutral-200 text-neutral-600',
  refunding: 'bg-blue-100 text-blue-700',
  refunded: 'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
}

function formatAmount(n: number | undefined | null): string {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function OrderScreen() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getOrders({ page: 1, pageSize: PAGE_SIZE })
      if (cancelled) return
      if (res.success) setOrders(res.data.list)
      else setError(res.error || '加载失败')
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <View className="flex-1 bg-white dark:bg-black">
      {error ? (
        <View className="px-4 py-2">
          <Text className="text-sm text-red-600">{error}</Text>
        </View>
      ) : null}
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          loading ? (
            <View className="items-center py-12">
              <Text className="text-sm text-neutral-500">加载中...</Text>
            </View>
          ) : (
            <View className="items-center py-12">
              <Text className="text-sm text-neutral-500">暂无订单</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const amountClass = item.status === 'refunded' ? 'text-emerald-600' : 'text-red-600'
          return (
            <Card>
              <View className="flex-row items-center justify-between">
                <Text
                  className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-50"
                  numberOfLines={1}
                >
                  {item.targetTitle}
                </Text>
                <View
                  className={`rounded-full px-2 py-0.5 ${STATUS_STYLE[item.status] ?? 'bg-neutral-200 text-neutral-600'}`}
                >
                  <Text className="text-xs">{STATUS_LABEL[item.status] ?? item.status}</Text>
                </View>
              </View>
              <View className="mt-1 flex-row justify-between">
                <Text className="text-xs text-neutral-500">订单号:{item.orderNo}</Text>
                <Text className="text-xs text-neutral-500">
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </Text>
              </View>
              <View className="mt-2 flex-row items-end justify-between">
                <Text className="text-xs text-neutral-500">实付金额</Text>
                <Text className={`text-lg font-semibold ${amountClass}`}>
                  ¥ {formatAmount(item.payAmount)}
                </Text>
              </View>
            </Card>
          )
        }}
      />
    </View>
  )
}
