import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { pay } from '@/api'
import { useI18n } from '@/i18n'

export default function PayIndex() {
  const { t } = useI18n()
  const router = useRouter()
  const [orderNo, setOrderNo] = useState('')
  const [amount, setAmount] = useState(0)
  const [payType, setPayType] = useState<'wechat' | 'balance' | 'alipay'>('wechat')

  const methods = [
    { value: 'wechat' as const, name: t('pay.wechat'), icon: '微', color: '#09bb07' },
    { value: 'alipay' as const, name: t('pay.alipay'), icon: '支', color: '#1677ff' },
    { value: 'balance' as const, name: t('pay.balance'), icon: '余', color: '#ff9a3c' },
  ]

  useEffect(() => {
    setOrderNo(router.params.orderNo || '')
    setAmount(Number(router.params.amount) || 0)
  }, [router.params.orderNo, router.params.amount])

  const onPay = async () => {
    if (!orderNo) {
      Taro.showToast({ title: t('pay.orderAbnormal'), icon: 'none' })
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
          <Text className="block text-[26rpx] text-[#999]">{t('pay.orderAmount')}</Text>
          <Text className="block text-[60rpx] text-[#dd524d] font-bold mt-[12rpx]">¥{amount}</Text>
        </View>
      </View>
      <View className="m-[24rpx] p-[32rpx] bg-white rounded-[16rpx]">
        <View className="text-[28rpx] text-[#333] font-semibold mb-[24rpx]">
          {t('pay.selectMethod')}
        </View>
        {methods.map((m) => (
          <View
            key={m.value}
            className="flex items-center py-[24rpx] border-b-[2rpx] border-[#f5f5f5]"
            onClick={() => setPayType(m.value)}
          >
            <View
              className="w-[60rpx] h-[60rpx] leading-[60rpx] text-center bg-[#f5f5f5] rounded-md text-[28rpx]"
              style={{ color: m.color }}
            >
              {m.icon}
            </View>
            <Text className="flex-1 ml-[24rpx] text-[28rpx] text-[#333]">{m.name}</Text>
            <View
              className={`w-[36rpx] h-[36rpx] rounded-md border-[2rpx] ${payType === m.value ? 'bg-[#07c160] border-[#07c160]' : 'border-[#ccc]'}`}
            />
          </View>
        ))}
      </View>
      <Button
        className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] bg-[#07c160] text-white rounded-[40rpx] text-[32rpx]"
        onClick={onPay}
      >
        {t('pay.confirm')} ¥{amount}
      </Button>
    </View>
  )
}
