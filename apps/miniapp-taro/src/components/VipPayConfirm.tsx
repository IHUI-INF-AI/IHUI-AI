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
        className="relative bg-card rounded-t-2xl w-full px-6 pb-6 pt-4"
        onClick={(e) => e.stopPropagation()}
        hoverClass="opacity-60">
        <View className="flex items-center justify-between mb-4">
          <Text className="text-base font-medium text-foreground">
            {tt('pay.confirmOrder', '确认订单')}
          </Text>
          <Text className="text-sm text-muted-foreground" onClick={onCancel}>
            ×
          </Text>
        </View>

        <View className="bg-muted rounded-xl p-4 mb-4">
          <View className="flex justify-between items-center mb-2">
            <Text className="text-sm text-foreground">{planName}</Text>
            <Text className="text-base font-bold text-warning">¥{price}</Text>
          </View>
          {originalPrice && (
            <View className="flex justify-between items-center">
              <Text className="text-xs text-muted-foreground">
                {tt('pay.originalPrice', '原价')}
              </Text>
              <Text className="text-xs text-muted-foreground line-through">¥{originalPrice}</Text>
            </View>
          )}
        </View>

        <Text className="block text-sm text-foreground mb-2">
          {tt('pay.paymentMethod', '支付方式')}
        </Text>
        <View className="flex space-x-3 mb-4">
          <View
            className={`flex-1 flex items-center justify-center py-3 rounded-lg border-2 ${
              paymentMethod === 'wechat' ? 'border-primary bg-primary/10' : 'border-border'
            }`}
            onClick={() => onMethodChange?.('wechat')}
            hoverClass="opacity-60">
            <LineIcon
              className="mr-1"
              name="wallet"
              size={28}
              color="var(--color-muted-foreground)"
            />
            <Text className="text-sm text-foreground">{tt('pay.wechat', '微信支付')}</Text>
          </View>
          <View
            className={`flex-1 flex items-center justify-center py-3 rounded-lg border-2 ${
              paymentMethod === 'alipay' ? 'border-primary bg-primary/10' : 'border-border'
            }`}
            onClick={() => onMethodChange?.('alipay')}
            hoverClass="opacity-60">
            <LineIcon
              className="mr-1"
              name="wallet"
              size={28}
              color="var(--color-muted-foreground)"
            />
            <Text className="text-sm text-foreground">{tt('pay.alipay', '支付宝')}</Text>
          </View>
        </View>

        <View
          className="w-full py-3 rounded-md text-center"
          style={{ background: 'var(--color-warning)' }}
          onClick={onConfirm}
          hoverClass="opacity-60">
          <Text className="text-sm text-warning-foreground font-medium">{t('pay.confirmPay', { price })}</Text>
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
