import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'

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
  planName = '月度会员',
  price = 29,
  originalPrice,
  paymentMethod = 'wechat',
  onConfirm,
  onCancel,
  onMethodChange,
}: VipPayConfirmProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  if (!visible) return null

  return (
    <View className="fixed inset-0 z-50 flex items-end" onClick={onCancel}>
      <View className="absolute inset-0 bg-black/50" />
      <View
        className="relative bg-card rounded-t-2xl w-full px-6 pb-6 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <View className="flex items-center justify-between mb-4">
          <Text className="text-base font-medium text-foreground">{tt('pay.confirmOrder', '确认订单')}</Text>
          <Text className="text-sm text-muted-foreground" onClick={onCancel}>
            ×
          </Text>
        </View>

        <View className="bg-muted rounded-xl p-4 mb-4">
          <View className="flex justify-between items-center mb-2">
            <Text className="text-sm text-foreground">{planName}</Text>
            <Text className="text-base font-bold text-[#f59e0b]">¥{price}</Text>
          </View>
          {originalPrice && (
            <View className="flex justify-between items-center">
              <Text className="text-xs text-muted-foreground">{tt('pay.originalPrice', '原价')}</Text>
              <Text className="text-xs text-muted-foreground line-through">¥{originalPrice}</Text>
            </View>
          )}
        </View>

        <Text className="block text-sm text-foreground mb-2">{tt('pay.paymentMethod', '支付方式')}</Text>
        <View className="flex space-x-3 mb-4">
          <View
            className={`flex-1 flex items-center justify-center py-3 rounded-lg border-2 ${
              paymentMethod === 'wechat' ? 'border-green-500 bg-primary/10' : 'border-border'
            }`}
            onClick={() => onMethodChange?.('wechat')}
          >
            <Text className="text-sm text-foreground">💚 微信支付</Text>
          </View>
          <View
            className={`flex-1 flex items-center justify-center py-3 rounded-lg border-2 ${
              paymentMethod === 'alipay' ? 'border-primary bg-primary/10' : 'border-border'
            }`}
            onClick={() => onMethodChange?.('alipay')}
          >
            <Text className="text-sm text-foreground">💙 支付宝</Text>
          </View>
        </View>

        <View
          className="w-full py-3 rounded-md text-center"
          style={{ background: 'linear-gradient(90deg, #fbbf24, #f59e0b)' }}
          onClick={onConfirm}
        >
          <Text className="text-sm text-white font-medium">{t('pay.confirmPay', { price })}</Text>
        </View>
      </View>
    </View>
  )
}
