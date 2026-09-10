// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useMemo } from 'react'
import { getOrderDetail, closeOrder, type Order } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

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
    Taro.navigateTo({ url: `/pkg-shop/pay/index?orderNo=${order.orderNo}&amount=${order.amount}` })
  }

  const goRefund = () => {
    Taro.navigateTo({ url: `/pkg-shop/order/refund?orderNo=${order.orderNo}` })
  }

  const goList = () => {
    Taro.navigateTo({ url: '/pkg-shop/order/list' })
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
    <ThemeRoot>
      {/* 对齐 RN SharedOrderDetailScreen:背景 surface.bg(bg-background)、body padding 20rpx、
          卡片 padding 24rpx / 圆角 24rpx / 2rpx 描边 / 白卡;字段 label 22rpx tertiary + value 32rpx,金额 44rpx/700 success */}
      <View className="min-h-screen bg-background pb-[140rpx]">
        <View className="p-[20rpx]">
          <View className="rounded-[24rpx] border-[2rpx] border-border bg-card p-[24rpx]">
            <Text className="block text-[32rpx] text-foreground">{order.title}</Text>
            <Text className="mt-[16rpx] block text-[22rpx] text-[var(--color-text-tertiary)]">
              {t('order.orderNo')}
            </Text>
            <Text className="mt-[16rpx] block text-[32rpx] text-foreground">{order.orderNo}</Text>
            <Text className="mt-[16rpx] block text-[22rpx] text-[var(--color-text-tertiary)]">
              {t('order.createTime')}
            </Text>
            <Text className="mt-[16rpx] block text-[32rpx] text-foreground">
              {order.createTime}
            </Text>
            <Text className="mt-[16rpx] block text-[22rpx] text-[var(--color-text-tertiary)]">
              {t('order.orderType')}
            </Text>
            <Text className="mt-[16rpx] block text-[32rpx] text-foreground">{order.type}</Text>
            <Text className="mt-[16rpx] block text-[22rpx] text-[var(--color-text-tertiary)]">
              {t('order.orderStatus')}
            </Text>
            <Text className="mt-[16rpx] block text-[32rpx] text-foreground">{statusText}</Text>
            <Text className="mt-[16rpx] block text-[22rpx] text-[var(--color-text-tertiary)]">
              {t('order.orderAmount')}
            </Text>
            <Text className="mt-[16rpx] block text-[44rpx] font-bold text-[var(--color-success)]">
              ¥{order.amount}
            </Text>
          </View>
        </View>
      </View>

      {/* 底部操作栏对齐 RN BottomActionBar:固定底部 / bg-card / 顶部 2rpx 描边 /
          gap 24rpx / 按钮 h88rpx 圆角 16rpx,主按钮 bg-primary 白字 30rpx/500,次按钮 2rpx 描边 */}
      <View
        className="fixed bottom-0 left-0 right-0 z-10 flex items-center gap-[24rpx] border-t-[2rpx] border-border bg-card px-[24rpx] pt-[8rpx]"
        style={{ paddingBottom: 'calc(8rpx + env(safe-area-inset-bottom))' }}
      >
        {order.status === 'pending' && (
          <View
            className={`h-[88rpx] flex-1 items-center justify-center rounded-[16rpx] border-[2rpx] border-border bg-card ${
              canceling ? 'opacity-50' : ''
            }`}
            /* RN BottomActionBar secondaryButtonPressed 为换背景 surface.muted,hoverClass 追加类无法覆盖 bg-card,统一以 opacity 反馈 */
            hoverClass="opacity-60"
            onClick={onCancel}
          >
            <Text className="text-[30rpx] font-medium text-foreground">{t('order.cancel')}</Text>
          </View>
        )}
        {order.status === 'pending' && (
          <View
            className="h-[88rpx] flex-1 items-center justify-center rounded-[16rpx] bg-primary"
            hoverClass="opacity-80"
            onClick={goPay}
          >
            <Text className="text-[30rpx] font-medium text-primary-foreground">
              {t('order.goPay')}
            </Text>
          </View>
        )}
        {order.status === 'paid' && (
          <View
            className="h-[88rpx] flex-1 items-center justify-center rounded-[16rpx] border-[2rpx] border-border bg-card"
            /* RN BottomActionBar secondaryButtonPressed 为换背景 surface.muted,hoverClass 追加类无法覆盖 bg-card,统一以 opacity 反馈 */
            hoverClass="opacity-60"
            onClick={goRefund}
          >
            <Text className="text-[30rpx] font-medium text-foreground">
              {t('order.applyRefund')}
            </Text>
          </View>
        )}
        {order.status !== 'pending' && order.status !== 'paid' && (
          <View
            className="h-[88rpx] flex-1 items-center justify-center rounded-[16rpx] bg-primary"
            hoverClass="opacity-80"
            onClick={goList}
          >
            <Text className="text-[30rpx] font-medium text-primary-foreground">
              {t('order.title')}
            </Text>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
