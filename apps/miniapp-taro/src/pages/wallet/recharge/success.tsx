import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'

export default function RechargeSuccess() {
  const { t } = useI18n()
  const router = useRouter()
  const [amount, setAmount] = useState(0)
  const [orderNo, setOrderNo] = useState('')

  useEffect(() => {
    setAmount(Number(router.params.amount) || 0)
    setOrderNo(router.params.orderNo || '')
  }, [router.params.amount, router.params.orderNo])

  const goHome = () => {
    Taro.switchTab({ url: '/pages/index/index' })
  }

  const goBack = () => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/user/index' }) })
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="pt-[120rpx] pb-[80rpx] text-center">
        <View className="w-[160rpx] h-[160rpx] leading-[160rpx] mx-auto rounded-md text-[80rpx] text-white bg-[#4caf50]">
          ✓
        </View>
        <Text className="block text-[36rpx] text-[#333] font-semibold mt-[32rpx]">
          {t('wallet.recharge.success.title')}
        </Text>
        <Text className="block text-[26rpx] text-[#999] mt-[12rpx]">
          {t('wallet.recharge.success.desc')}
        </Text>
        {amount > 0 && (
          <View className="mt-[32rpx]">
            <Text className="block text-[26rpx] text-[#999]">
              {t('wallet.recharge.success.amount')}
            </Text>
            <Text className="block text-[60rpx] text-[#dd524d] font-bold mt-[8rpx]">¥{amount}</Text>
          </View>
        )}
        {orderNo ? (
          <Text className="block text-[22rpx] text-[#bbb] mt-[24rpx] px-[60rpx]">
            {t('order.orderNo')} {orderNo}
          </Text>
        ) : null}
      </View>
      <View className="px-[60rpx]">
        <Button
          className="mt-[32rpx] bg-[#07c160] text-white rounded-[40rpx] text-[30rpx]"
          onClick={goHome}
        >
          {t('wallet.recharge.success.backHome')}
        </Button>
        <Button
          className="mt-[32rpx] bg-white text-[#333] rounded-[40rpx] text-[30rpx]"
          onClick={goBack}
        >
          {t('wallet.recharge.success.backWallet')}
        </Button>
      </View>
    </View>
  )
}
