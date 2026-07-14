import { View, Text } from '@tarojs/components'

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
  if (!visible) return null

  return (
    <View className="fixed inset-0 z-50 flex items-end" onClick={onCancel}>
      <View className="absolute inset-0 bg-black/50" />
      <View
        className="relative bg-white rounded-t-2xl w-full px-6 pb-6 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <View className="flex items-center justify-between mb-4">
          <Text className="text-base font-medium text-gray-800">确认订单</Text>
          <Text className="text-sm text-gray-400" onClick={onCancel}>
            ×
          </Text>
        </View>

        <View className="bg-gray-50 rounded-xl p-4 mb-4">
          <View className="flex justify-between items-center mb-2">
            <Text className="text-sm text-gray-600">{planName}</Text>
            <Text className="text-base font-bold text-yellow-600">¥{price}</Text>
          </View>
          {originalPrice && (
            <View className="flex justify-between items-center">
              <Text className="text-xs text-gray-400">原价</Text>
              <Text className="text-xs text-gray-400 line-through">¥{originalPrice}</Text>
            </View>
          )}
        </View>

        <Text className="block text-sm text-gray-600 mb-2">支付方式</Text>
        <View className="flex space-x-3 mb-4">
          <View
            className={`flex-1 flex items-center justify-center py-3 rounded-lg border-2 ${
              paymentMethod === 'wechat' ? 'border-green-500 bg-green-50' : 'border-gray-100'
            }`}
            onClick={() => onMethodChange?.('wechat')}
          >
            <Text className="text-sm text-gray-700">💚 微信支付</Text>
          </View>
          <View
            className={`flex-1 flex items-center justify-center py-3 rounded-lg border-2 ${
              paymentMethod === 'alipay' ? 'border-blue-500 bg-blue-50' : 'border-gray-100'
            }`}
            onClick={() => onMethodChange?.('alipay')}
          >
            <Text className="text-sm text-gray-700">💙 支付宝</Text>
          </View>
        </View>

        <View
          className="w-full py-3 rounded-full text-center"
          style={{ background: 'linear-gradient(90deg, #fbbf24, #f59e0b)' }}
          onClick={onConfirm}
        >
          <Text className="text-sm text-white font-medium">确认支付 ¥{price}</Text>
        </View>
      </View>
    </View>
  )
}
