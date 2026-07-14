import { View, Text } from '@tarojs/components'

export interface PayInfo {
  payType?: number
  payCrowd?: number
  amount?: number
  isVip?: number
  title?: string
}

export interface PayPopupProps {
  visible?: boolean
  pay?: PayInfo
  onClose?: () => void
  onPay?: () => void
}

export default function PayPopup({ visible = false, pay = {}, onClose, onPay }: PayPopupProps) {
  if (!visible) return null

  const { payType = 0, payCrowd = 0, amount = 0, isVip = 0 } = pay
  const isFree = payType === 0
  const isLimitFree = payType === 1 && payCrowd === 0
  const isVipFree = payCrowd === 1 && isVip > 0
  const isPaid = !isFree && !isLimitFree && !isVipFree
  const displayAmount = (amount / 100).toFixed(2)

  return (
    <View className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <View className="absolute inset-0 bg-black/40" />
      <View
        className="relative bg-white rounded-t-2xl w-full px-6 pb-6 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <View className="flex items-center justify-between mb-4">
          <Text className="text-base font-medium text-gray-800">{pay.title || '购买内容'}</Text>
          <Text className="text-sm text-gray-400" onClick={onClose}>
            关闭
          </Text>
        </View>
        <View className="mb-4">
          {isFree ? (
            <Text className="text-2xl font-bold text-green-500">免费</Text>
          ) : isLimitFree ? (
            <Text className="text-2xl font-bold text-orange-500">限时免费</Text>
          ) : isVipFree ? (
            <Text className="text-2xl font-bold text-yellow-600">会员免费</Text>
          ) : (
            <Text className="text-2xl font-bold text-red-500">¥{displayAmount}</Text>
          )}
        </View>
        <View className="flex space-x-3">
          {!isFree && !isLimitFree && (
            <View
              className="flex-1 py-3 rounded-full border border-yellow-400 bg-yellow-50 text-center"
              onClick={onPay}
            >
              <Text className="text-sm text-yellow-600">会员免费</Text>
            </View>
          )}
          {isPaid && (
            <View className="flex-1 py-3 rounded-full bg-indigo-500 text-center" onClick={onPay}>
              <Text className="text-sm text-white">立即购买</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
