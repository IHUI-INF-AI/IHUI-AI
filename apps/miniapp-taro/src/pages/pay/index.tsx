import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { pay } from '@/api'

const METHODS = [
  { value: 'wechat' as const, name: '微信支付', icon: '微', color: '#09bb07' },
  { value: 'alipay' as const, name: '支付宝', icon: '支', color: '#1677ff' },
  { value: 'balance' as const, name: '余额支付', icon: '余', color: '#ff9a3c' },
]

export default function PayIndex() {
  const router = useRouter()
  const [orderNo, setOrderNo] = useState('')
  const [amount, setAmount] = useState(0)
  const [payType, setPayType] = useState<'wechat' | 'balance' | 'alipay'>('wechat')

  useEffect(() => {
    setOrderNo(router.params.orderNo || '')
    setAmount(Number(router.params.amount) || 0)
  }, [router.params.orderNo, router.params.amount])

  const onPay = async () => {
    if (!orderNo) {
      Taro.showToast({ title: '订单异常', icon: 'none' })
      return
    }
    try {
      const res = await pay({ orderNo, payType })
      if (res.success) {
        Taro.redirectTo({ url: `/pages/pay/result?orderNo=${orderNo}` })
      } else if (res.payUrl) {
        if (process.env.TARO_ENV === 'h5') {
          window.location.href = res.payUrl
        }
      }
    } catch {
      // ignore
    }
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa] pb-[120rpx]">
      <View className="m-[24rpx] p-[32rpx] bg-white rounded-[16rpx]">
        <View className="text-center">
          <Text className="block text-[26rpx] text-[#999]">订单金额</Text>
          <Text className="block text-[60rpx] text-[#dd524d] font-bold mt-[12rpx]">¥{amount}</Text>
        </View>
      </View>
      <View className="m-[24rpx] p-[32rpx] bg-white rounded-[16rpx]">
        <View className="text-[28rpx] text-[#333] font-semibold mb-[24rpx]">选择支付方式</View>
        {METHODS.map(m => (
          <View
            key={m.value}
            className="flex items-center py-[24rpx] border-b-[2rpx] border-[#f5f5f5]"
            onClick={() => setPayType(m.value)}
          >
            <View
              className="w-[60rpx] h-[60rpx] leading-[60rpx] text-center bg-[#f5f5f5] rounded-full text-[28rpx]"
              style={{ color: m.color }}
            >
              {m.icon}
            </View>
            <Text className="flex-1 ml-[24rpx] text-[28rpx] text-[#333]">{m.name}</Text>
            <View
              className={`w-[36rpx] h-[36rpx] rounded-full border-[2rpx] ${payType === m.value ? 'bg-[#007aff] border-[#007aff]' : 'border-[#ccc]'}`}
            />
          </View>
        ))}
      </View>
      <Button
        className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] bg-[#007aff] text-white rounded-[40rpx] text-[32rpx]"
        onClick={onPay}
      >
        确认支付 ¥{amount}
      </Button>
    </View>
  )
}
