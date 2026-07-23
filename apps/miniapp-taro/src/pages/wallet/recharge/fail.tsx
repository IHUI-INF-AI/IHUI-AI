import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'

// 充值失败页文案(wallet.recharge.fail.* i18n key 暂未定义,沿用原项目硬编码中文模式)
const FAIL_TEXT = {
  title: '充值失败',
  desc: '充值未成功,请稍后重试',
  retry: '重新充值',
  backWallet: '返回钱包',
  orderNoLabel: '订单号',
}

export default function RechargeFail() {
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
          {FAIL_TEXT.title}
        </Text>
        <Text className="block text-[26rpx] text-muted-foreground mt-[12rpx] px-[60rpx]">
          {FAIL_TEXT.desc}
        </Text>
        {orderNo ? (
          <Text className="block text-[22rpx] text-[#bbb] mt-[24rpx] px-[60rpx]">
            {FAIL_TEXT.orderNoLabel} {orderNo}
          </Text>
        ) : null}
      </View>
      <View className="px-[60rpx]">
        <Button
          className="mt-[32rpx] bg-primary text-white rounded-[40rpx] text-[30rpx]"
          onClick={retry}
        >
          {FAIL_TEXT.retry}
        </Button>
        <Button
          className="mt-[32rpx] bg-card text-foreground rounded-[40rpx] text-[30rpx]"
          onClick={goBack}
        >
          {FAIL_TEXT.backWallet}
        </Button>
      </View>
    </View>
  )
}
