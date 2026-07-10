import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { getPayResult } from '@/api'

type PayStatus = 'pending' | 'paid' | 'failed'

const STATUS_TEXT: Record<PayStatus, string> = {
  pending: '支付处理中',
  paid: '支付成功',
  failed: '支付失败',
}

const STATUS_ICON: Record<PayStatus, string> = {
  pending: '…',
  paid: '✓',
  failed: '×',
}

const STATUS_BG: Record<PayStatus, string> = {
  pending: 'bg-[#ff9a3c]',
  paid: 'bg-[#4caf50]',
  failed: 'bg-[#dd524d]',
}

export default function PayResult() {
  const router = useRouter()
  const [status, setStatus] = useState<PayStatus>('pending')
  const [amount, setAmount] = useState(0)
  const orderNoRef = useRef('')

  useEffect(() => {
    orderNoRef.current = router.params.orderNo || ''
    check()
  }, [router.params.orderNo])

  async function check() {
    if (!orderNoRef.current) return
    try {
      const res = await getPayResult(orderNoRef.current)
      setStatus(res.status)
      setAmount(res.amount)
    } catch (e) {
      // ignore
    }
  }

  const goHome = () => {
    Taro.switchTab({ url: '/pages/index/index' })
  }

  const goOrders = () => {
    Taro.navigateTo({ url: '/pages/order/list' })
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="pt-[120rpx] pb-[120rpx] text-center">
        <View
          className={`w-[160rpx] h-[160rpx] leading-[160rpx] mx-auto rounded-full text-[80rpx] text-white ${STATUS_BG[status]}`}
        >
          {STATUS_ICON[status]}
        </View>
        <Text className="block text-[36rpx] text-[#333] font-semibold mt-[32rpx]">
          {STATUS_TEXT[status]}
        </Text>
        {amount > 0 && (
          <Text className="block text-[40rpx] text-[#dd524d] mt-[16rpx]">¥{amount}</Text>
        )}
      </View>
      {status !== 'pending' ? (
        <View className="px-[60rpx]">
          <Button
            className="mt-[32rpx] bg-[#007aff] text-white rounded-[40rpx] text-[30rpx]"
            onClick={goHome}
          >
            返回首页
          </Button>
          <Button
            className="mt-[32rpx] bg-white text-[#333] rounded-[40rpx] text-[30rpx]"
            onClick={goOrders}
          >
            查看订单
          </Button>
        </View>
      ) : (
        <View className="px-[60rpx]">
          <Button
            className="mt-[32rpx] bg-[#007aff] text-white rounded-[40rpx] text-[30rpx]"
            onClick={check}
          >
            刷新状态
          </Button>
        </View>
      )}
    </View>
  )
}
