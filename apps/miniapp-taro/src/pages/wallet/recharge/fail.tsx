import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'

export default function RechargeFail() {
  const { t } = useI18n()
  const router = useRouter()
  const [orderNo, setOrderNo] = useState('')

  useEffect(() => {
    setOrderNo(router.params.orderNo || '')
  }, [router.params.orderNo])

  const retry = () => {
    Taro.redirectTo({ url: '/pages/wallet/recharge/index' })
  }

  const goBack = () => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/user/index' }) })
  }

  return (
    <View className="min-h-screen bg-background">
      <View className="pt-[120rpx] pb-[80rpx] text-center">
        <View className="w-[160rpx] h-[160rpx] leading-[160rpx] mx-auto rounded-md text-[80rpx] text-white bg-[#dd524d]">
          ×
        </View>
        <Text className="block text-[36rpx] text-foreground font-semibold mt-[32rpx]">
          {t('wallet.recharge.fail.title')}
        </Text>
        <Text className="block text-[26rpx] text-muted-foreground mt-[12rpx] px-[60rpx]">
          {t('wallet.recharge.fail.desc')}
        </Text>
        {orderNo ? (
          <Text className="block text-[22rpx] text-[#bbb] mt-[24rpx] px-[60rpx]">
            {t('order.orderNo')} {orderNo}
          </Text>
        ) : null}
      </View>
      <View className="px-[60rpx]">
        <Button
          className="mt-[32rpx] bg-primary text-white rounded-[40rpx] text-[30rpx]"
          onClick={retry}
        >
          {t('wallet.recharge.fail.retry')}
        </Button>
        <Button
          className="mt-[32rpx] bg-card text-foreground rounded-[40rpx] text-[30rpx]"
          onClick={goBack}
        >
          {t('wallet.recharge.fail.backWallet')}
        </Button>
      </View>
    </View>
  )
}
