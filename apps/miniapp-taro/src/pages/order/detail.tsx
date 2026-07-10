import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useMemo } from 'react'
import { getOrderDetail, type Order } from '@/api'

const STATUS_TEXT: Record<string, string> = {
  pending: '待支付',
  paid: '已支付',
  cancelled: '已取消',
  refunded: '已退款',
}

const STATUS_COLOR: Record<string, string> = {
  paid: 'text-[#4caf50]',
  pending: 'text-[#ff9a3c]',
  refunded: 'text-[#999]',
}

export default function OrderDetail() {
  const router = useRouter()
  const [order, setOrder] = useState<Order>({} as Order)

  const statusText = useMemo(
    () => STATUS_TEXT[order.status] || order.status,
    [order.status]
  )

  useEffect(() => {
    const id = router.params.id
    if (!id) return
    getOrderDetail(id)
      .then(data => setOrder(data))
      .catch(() => {})
  }, [router.params.id])

  const goPay = () => {
    Taro.navigateTo({ url: `/pages/pay/index?orderNo=${order.orderNo}&amount=${order.amount}` })
  }

  const goRefund = () => {
    Taro.navigateTo({ url: `/pages/order/refund?orderNo=${order.orderNo}` })
  }

  const goList = () => {
    Taro.navigateTo({ url: '/pages/order/list' })
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa] pb-[120rpx]">
      <View className="m-[24rpx] p-[32rpx] bg-white rounded-[16rpx]">
        <View className="text-[32rpx] text-[#333] font-semibold pb-[24rpx] border-b-[2rpx] border-[#f5f5f5]">
          {order.title}
        </View>
        <View className="flex justify-between py-[24rpx] border-b-[2rpx] border-[#f5f5f5]">
          <Text className="text-[26rpx] text-[#999]">订单号</Text>
          <Text className="text-[26rpx] text-[#333]">{order.orderNo}</Text>
        </View>
        <View className="flex justify-between py-[24rpx] border-b-[2rpx] border-[#f5f5f5]">
          <Text className="text-[26rpx] text-[#999]">创建时间</Text>
          <Text className="text-[26rpx] text-[#333]">{order.createTime}</Text>
        </View>
        <View className="flex justify-between py-[24rpx] border-b-[2rpx] border-[#f5f5f5]">
          <Text className="text-[26rpx] text-[#999]">订单类型</Text>
          <Text className="text-[26rpx] text-[#333]">{order.type}</Text>
        </View>
        <View className="flex justify-between py-[24rpx] border-b-[2rpx] border-[#f5f5f5]">
          <Text className="text-[26rpx] text-[#999]">订单状态</Text>
          <Text className={`text-[26rpx] ${STATUS_COLOR[order.status] || 'text-[#333]'}`}>
            {statusText}
          </Text>
        </View>
        <View className="flex justify-between py-[24rpx]">
          <Text className="text-[26rpx] text-[#999]">订单金额</Text>
          <Text className="text-[32rpx] text-[#dd524d] font-semibold">¥{order.amount}</Text>
        </View>
      </View>
      <View className="px-[32rpx]">
        {order.status === 'pending' && (
          <Button
            className="mt-[24rpx] bg-[#007aff] text-white rounded-[40rpx] text-[30rpx]"
            onClick={goPay}
          >
            去支付
          </Button>
        )}
        {order.status === 'paid' && (
          <Button
            className="mt-[24rpx] bg-white text-[#333] rounded-[40rpx] text-[30rpx]"
            onClick={goRefund}
          >
            申请退款
          </Button>
        )}
        <Button
          className="mt-[24rpx] bg-white text-[#333] rounded-[40rpx] text-[30rpx]"
          onClick={goList}
        >
          订单列表
        </Button>
      </View>
    </View>
  )
}
