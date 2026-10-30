// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text } from '@tarojs/components'
import { useTt } from '@/i18n'
import type { Order } from '@/api'
import { ScreenSkeleton } from '@/components/ScreenStates.taro'

interface RefundOrderCardProps {
  loading: boolean
  order: Order | null
  orderNo: string
  refundAmount: number
}

/**
 * 订单信息卡内容(从 refund.tsx 拆出,字节与拆分前一致)。
 * 对齐共享屏 OrderRefundScreen 的 cardHeaderRow / cardMetaRow:订单号 + 商品 + 金额 + 下单时间。
 */
export default function RefundOrderCard({
  loading,
  order,
  orderNo,
  refundAmount,
}: RefundOrderCardProps) {
  const tt = useTt()
  if (loading) return <ScreenSkeleton variant="list" count={4} />
  return (
    <View className="flex flex-col gap-[16rpx]">
      <View className="flex items-start justify-between gap-[24rpx]">
        <Text className="text-[length:28rpx] text-muted-foreground shrink-0">
          {tt('order.refund.orderNo', '订单号')}
        </Text>
        <Text className="text-[length:28rpx] text-muted-foreground text-right break-all">
          {orderNo}
        </Text>
      </View>
      {order?.title ? (
        <View className="flex items-start justify-between gap-[24rpx]">
          <Text className="text-[length:28rpx] text-muted-foreground shrink-0">
            {tt('order.refund.productLabel', '商品名称')}
          </Text>
          <Text className="text-[length:28rpx] text-foreground text-right break-all">
            {order.title}
          </Text>
        </View>
      ) : null}
      <View className="flex items-start justify-between gap-[24rpx]">
        <Text className="text-[length:28rpx] text-muted-foreground shrink-0">
          {tt('order.refund.amountLabel', '订单金额')}
        </Text>
        <Text className="text-[length:36rpx] font-semibold text-[var(--color-success)] text-right break-all">
          ¥{refundAmount.toFixed(2)}
        </Text>
      </View>
      {order?.createTime ? (
        <View className="flex items-start justify-between gap-[24rpx]">
          <Text className="text-[length:28rpx] text-muted-foreground shrink-0">
            {tt('order.refund.orderTimeLabel', '下单时间')}
          </Text>
          <Text className="text-[length:28rpx] text-foreground text-right break-all">
            {order.createTime}
          </Text>
        </View>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
