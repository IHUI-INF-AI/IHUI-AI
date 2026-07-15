import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useMemo } from 'react'
import { getOrderDetail, type Order } from '@/api'
import { useI18n } from '@/i18n'

const STATUS_COLOR: Record<string, string> = {
  paid: 'text-[#4caf50]',
  pending: 'text-[#ff9a3c]',
  refunded: 'text-[#999]',
}

const STATUS_KEYS: Record<string, string> = {
  pending: 'order.status.pending',
  paid: 'order.status.paid',
  cancelled: 'order.status.cancelled',
  refunded: 'order.status.refunded',
}

export default function OrderDetail() {
  const { t } = useI18n()
  const router = useRouter()
  const [order, setOrder] = useState<Order>({} as Order)

  const statusText = useMemo(
    () => (STATUS_KEYS[order.status] ? t(STATUS_KEYS[order.status] as string) : order.status),
    [order.status, t],
  )

  useEffect(() => {
    const id = router.params.id
    if (!id) return
    getOrderDetail(id)
      .then((data) => setOrder(data))
      .catch((e) => {
        logger.error('unknown', '订单详情加载', e)
        Taro.showToast({ title: t('order.loadFailed'), icon: 'none' })
      })
  }, [router.params.id, t])

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
          <Text className="text-[26rpx] text-[#999]">{t('order.orderNo')}</Text>
          <Text className="text-[26rpx] text-[#333]">{order.orderNo}</Text>
        </View>
        <View className="flex justify-between py-[24rpx] border-b-[2rpx] border-[#f5f5f5]">
          <Text className="text-[26rpx] text-[#999]">{t('order.createTime')}</Text>
          <Text className="text-[26rpx] text-[#333]">{order.createTime}</Text>
        </View>
        <View className="flex justify-between py-[24rpx] border-b-[2rpx] border-[#f5f5f5]">
          <Text className="text-[26rpx] text-[#999]">{t('order.orderType')}</Text>
          <Text className="text-[26rpx] text-[#333]">{order.type}</Text>
        </View>
        <View className="flex justify-between py-[24rpx] border-b-[2rpx] border-[#f5f5f5]">
          <Text className="text-[26rpx] text-[#999]">{t('order.orderStatus')}</Text>
          <Text className={`text-[26rpx] ${STATUS_COLOR[order.status] || 'text-[#333]'}`}>
            {statusText}
          </Text>
        </View>
        <View className="flex justify-between py-[24rpx]">
          <Text className="text-[26rpx] text-[#999]">{t('order.orderAmount')}</Text>
          <Text className="text-[32rpx] text-[#dd524d] font-semibold">¥{order.amount}</Text>
        </View>
      </View>
      <View className="px-[32rpx]">
        {order.status === 'pending' && (
          <Button
            className="mt-[24rpx] bg-[#07c160] text-white rounded-[40rpx] text-[30rpx]"
            onClick={goPay}
          >
            {t('order.goPay')}
          </Button>
        )}
        {order.status === 'paid' && (
          <Button
            className="mt-[24rpx] bg-white text-[#333] rounded-[40rpx] text-[30rpx]"
            onClick={goRefund}
          >
            {t('order.applyRefund')}
          </Button>
        )}
        <Button
          className="mt-[24rpx] bg-white text-[#333] rounded-[40rpx] text-[30rpx]"
          onClick={goList}
        >
          {t('order.title')}
        </Button>
      </View>
    </View>
  )
}
