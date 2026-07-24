import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useMemo } from 'react'
import { getOrderDetail, closeOrder, type Order } from '@/api'
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

const STATUS_KEYS: Record<string, string> = {
  pending: 'order.status.pending',
  paid: 'order.status.paid',
  cancelled: 'order.status.cancelled',
  refunding: 'order.status.refunding',
  refunded: 'order.status.refunded',
  completed: 'order.status.completed',
  failed: 'order.status.failed',
}

export default function OrderDetail() {
  const { t } = useI18n()
  const router = useRouter()
  const [order, setOrder] = useState<Order>({} as Order)
  const [canceling, setCanceling] = useState(false)

  const statusText = useMemo(
    () => (STATUS_KEYS[order.status] ? t(STATUS_KEYS[order.status] as string) : order.status),
    [order.status, t],
  )

  const reload = (id: string | number) => {
    getOrderDetail(id)
      .then((data) => setOrder(data))
      .catch((e) => {
        logger.error('unknown', '订单详情加载', e)
        Taro.showToast({ title: t('order.loadFailed'), icon: 'none' })
      })
  }

  useEffect(() => {
    const id = router.params.id
    if (!id) return
    reload(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const onCancel = async () => {
    if (!order.id || canceling) return
    Taro.showModal({
      title: t('common.hint'),
      content: t('order.cancelConfirm'),
      success: async (res) => {
        if (!res.confirm) return
        setCanceling(true)
        try {
          await closeOrder(String(order.id))
          Taro.showToast({ title: t('order.cancelSuccess'), icon: 'success' })
          reload(order.id)
        } catch (e) {
          logger.error('order/detail', '取消订单', e)
          Taro.showToast({ title: t('order.cancelFailed'), icon: 'none' })
        } finally {
          setCanceling(false)
        }
      },
    })
  }

  return (
    <View className="min-h-screen bg-background pb-[120rpx]">
      <View className="m-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
        <View className="text-[32rpx] text-foreground font-semibold pb-[24rpx] mb-[8rpx]">
          {order.title}
        </View>
        <View className="flex justify-between py-[24rpx]">
          <Text className="text-[26rpx] text-muted-foreground">{t('order.orderNo')}</Text>
          <Text className="text-[26rpx] text-foreground">{order.orderNo}</Text>
        </View>
        <View className="flex justify-between py-[24rpx]">
          <Text className="text-[26rpx] text-muted-foreground">{t('order.createTime')}</Text>
          <Text className="text-[26rpx] text-foreground">{order.createTime}</Text>
        </View>
        <View className="flex justify-between py-[24rpx]">
          <Text className="text-[26rpx] text-muted-foreground">{t('order.orderType')}</Text>
          <Text className="text-[26rpx] text-foreground">{order.type}</Text>
        </View>
        <View className="flex justify-between py-[24rpx]">
          <Text className="text-[26rpx] text-muted-foreground">{t('order.orderStatus')}</Text>
          <Text className={`text-[26rpx] ${STATUS_COLOR[order.status] || 'text-foreground'}`}>
            {statusText}
          </Text>
        </View>
        <View className="flex justify-between py-[24rpx]">
          <Text className="text-[26rpx] text-muted-foreground">{t('order.orderAmount')}</Text>
          <Text className="text-[32rpx] text-destructive font-semibold">¥{order.amount}</Text>
        </View>
      </View>
      <View className="px-[32rpx]">
        {order.status === 'pending' && (
          <>
            <Button
              className="mt-[24rpx] bg-primary text-white rounded-[40rpx] text-[30rpx]"
              onClick={goPay}
            >
              {t('order.goPay')}
            </Button>
            <Button
              className={`mt-[24rpx] bg-card text-foreground rounded-[40rpx] text-[30rpx] ${canceling ? 'opacity-50' : ''}`}
              disabled={canceling}
              onClick={onCancel}
            >
              {t('order.cancel')}
            </Button>
          </>
        )}
        {order.status === 'paid' && (
          <Button
            className="mt-[24rpx] bg-card text-foreground rounded-[40rpx] text-[30rpx]"
            onClick={goRefund}
          >
            {t('order.applyRefund')}
          </Button>
        )}
        <Button
          className="mt-[24rpx] bg-card text-foreground rounded-[40rpx] text-[30rpx]"
          onClick={goList}
        >
          {t('order.title')}
        </Button>
      </View>
    </View>
  )
}
