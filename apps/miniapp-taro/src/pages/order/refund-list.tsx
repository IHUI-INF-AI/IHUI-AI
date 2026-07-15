import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getRefundList, type Order } from '@/api'
import { useI18n } from '@/i18n'

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-[#ff9a3c]',
  refunded: 'text-[#f44336]',
}

const STATUS_KEY: Record<string, string> = {
  pending: 'order.refundList.status.pending',
  refunded: 'order.refundList.status.refunded',
}

const PAGE_SIZE = 10

export default function RefundList() {
  const { t } = useI18n()
  const [list, setList] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const statusText = (s: string) => (STATUS_KEY[s] ? t(STATUS_KEY[s]) : s)

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
      const res = await getRefundList({ page: pageRef.current, pageSize: PAGE_SIZE })
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

  const goRefund = (o: Order) => {
    Taro.navigateTo({ url: `/pages/order/refund?id=${o.id}` })
  }

  useDidShow(() => {
    load(true)
  })
  useReachBottom(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      {list.length > 0 && (
        <View className="p-[24rpx]">
          {list.map((o) => (
            <View
              key={o.id}
              className="bg-white rounded-[16rpx] p-[32rpx] mb-[24rpx]"
              onClick={() => goRefund(o)}
            >
              <View className="flex justify-between items-center">
                <Text className="text-[30rpx] text-[#333] font-semibold">{o.title}</Text>
                <Text className={`text-[24rpx] ${STATUS_COLOR[o.status] || 'text-[#999]'}`}>
                  {statusText(o.status)}
                </Text>
              </View>
              <Text className="block text-[22rpx] text-[#999] mt-[12rpx]">
                {t('order.refundList.orderNo', { no: o.orderNo })}
              </Text>
              <View className="flex justify-between mt-[16rpx]">
                <Text className="text-[24rpx] text-[#999]">{o.createTime}</Text>
                <Text className="text-[32rpx] text-[#dd524d] font-semibold">¥{o.amount}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      {list.length === 0 && !loading && (
        <View className="text-center py-[120rpx] text-[#999]">
          <Text>{t('order.refundList.empty')}</Text>
        </View>
      )}
      {loading && (
        <View className="text-center py-[120rpx] text-[#999]">
          <Text>{t('common.loading')}</Text>
        </View>
      )}
    </View>
  )
}
