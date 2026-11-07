// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n, t } from '@/i18n'
import { View, Text } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'

export interface VipPayConfirmProps {
  visible?: boolean
  planName?: string
  price?: number
  originalPrice?: number
  paymentMethod?: 'wechat' | 'alipay'
  onConfirm?: () => void
  onCancel?: () => void
  onMethodChange?: (method: 'wechat' | 'alipay') => void
}

export default function VipPayConfirm({
  visible = false,
  planName = t('vip.details.monthlyPlan'),
  price = 29,
  originalPrice,
  paymentMethod = 'wechat',
  onConfirm,
  onCancel,
  onMethodChange,
}: VipPayConfirmProps) {
  const { t } = useI18n()
  const tt = useTt()
  if (!visible) return null

  return (
    <View className="fixed inset-0 z-[2000] flex items-end" onClick={onCancel}>
      <View className="absolute inset-0 bg-[var(--color-black-50)]" />
      <View
        className="relative vip-surface rounded-t-2xl w-full px-2xl pb-2xl pt-lg"
        onClick={(e) => e.stopPropagation()}
        hoverClass="opacity-60"
      >
        <View className="flex items-center justify-between mb-lg">
          <Text className="text-title font-medium vip-text">
            {tt('pay.confirmOrder', '确认订单')}
          </Text>
          <Text className="text-body vip-text-muted" onClick={onCancel}>
            ×
          </Text>
        </View>

        <View className="bg-muted rounded-xl p-lg mb-lg">
          <View className="flex justify-between items-center mb-sm">
            <Text className="text-body vip-text">{planName}</Text>
            <Text className="text-title font-bold text-warning">¥{price}</Text>
          </View>
          {originalPrice && (
            <View className="flex justify-between items-center">
              <Text className="text-label vip-text-muted">{tt('pay.originalPrice', '原价')}</Text>
              <Text className="text-label vip-text-muted line-through">¥{originalPrice}</Text>
            </View>
          )}
        </View>

        <Text className="block text-body vip-text mb-sm">
          {tt('pay.paymentMethod', '支付方式')}
        </Text>
        <View className="flex space-x-md mb-lg">
          <View
            className={`flex-1 flex items-center justify-center py-md rounded-lg border-2 ${
              paymentMethod === 'wechat' ? 'border-brand-accent-deep bg-primary/10' : 'vip-border'
            }`}
            onClick={() => onMethodChange?.('wechat')}
            hoverClass="opacity-60"
          >
            <LineIcon
              className="mr-xs"
              name="wallet"
              size={28}
              color="var(--color-muted-foreground)"
            />
            <Text className="text-body vip-text">{tt('pay.wechat', '微信支付')}</Text>
          </View>
          <View
            className={`flex-1 flex items-center justify-center py-md rounded-lg border-2 ${
              paymentMethod === 'alipay' ? 'border-brand-accent-deep bg-primary/10' : 'vip-border'
            }`}
            onClick={() => onMethodChange?.('alipay')}
            hoverClass="opacity-60"
          >
            <LineIcon
              className="mr-xs"
              name="wallet"
              size={28}
              color="var(--color-muted-foreground)"
            />
            <Text className="text-body vip-text">{tt('pay.alipay', '支付宝')}</Text>
          </View>
        </View>

        <View
          className="w-full py-md rounded-md text-center"
          style={{ background: 'var(--color-warning)' }}
          onClick={onConfirm}
          hoverClass="opacity-60"
        >
          <Text className="text-body text-warning-foreground font-medium">
            {t('pay.confirmPay', { price })}
          </Text>
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
