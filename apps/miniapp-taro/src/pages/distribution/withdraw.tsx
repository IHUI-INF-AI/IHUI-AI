import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getDistributionInfo, withdraw } from '@/api'
import { useI18n } from '@/i18n'

export default function DistributionWithdraw() {
  const { t } = useI18n()
  const [available, setAvailable] = useState(0)
  const [amount, setAmount] = useState('')
  const [payType, setPayType] = useState('wechat')
  const [submitting, setSubmitting] = useState(false)
  const availableRef = useRef(0)

  const payTypes = [
    { value: 'wechat', label: t('distribution.withdraw.methodWechat') },
    { value: 'alipay', label: t('distribution.withdraw.methodAlipay') },
  ]

  const load = async () => {
    try {
      const info = await getDistributionInfo()
      setAvailable(info.available)
      availableRef.current = info.available
    } catch {
      // ignore
    }
  }

  const fillAll = () => {
    setAmount(String(availableRef.current))
  }

  const onSubmit = async () => {
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      Taro.showToast({ title: t('distribution.withdraw.invalidAmount'), icon: 'none' })
      return
    }
    if (amt > availableRef.current) {
      Taro.showToast({ title: t('distribution.withdraw.insufficient'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await withdraw({ amount: amt, type: payType })
      Taro.showToast({ title: t('distribution.withdraw.submitted'), icon: 'success' })
      setTimeout(() => {
        Taro.navigateBack()
      }, 800)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  useDidShow(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-background">
      <View className="mx-[24rpx] mt-[24rpx] bg-card rounded-[16rpx] p-[32rpx]">
        <Text className="text-[24rpx] text-muted-foreground">
          {t('distribution.withdraw.available')}
        </Text>
        <Text className="block text-[80rpx] text-foreground font-bold mt-[8rpx]">¥{available}</Text>
        <View className="flex items-center py-[24rpx] mt-[32rpx]">
          <Text className="text-[48rpx] text-foreground font-semibold">¥</Text>
          <Input
            className="flex-1 ml-[16rpx] text-[48rpx]"
            type="digit"
            value={amount}
            onInput={(e) => setAmount(e.detail.value)}
            placeholder={t('distribution.withdraw.amountPlaceholder')}
          />
          <Button
            className="text-[24rpx] text-[#ff6b35] bg-transparent border-none leading-[48rpx]"
            onClick={fillAll}
          >
            {t('distribution.withdraw.all')}
          </Button>
        </View>
        <View className="mt-[32rpx]">
          <Text className="text-[24rpx] text-muted-foreground">
            {t('distribution.withdraw.method')}
          </Text>
          <View className="flex mt-[16rpx] gap-[24rpx]">
            {payTypes.map((pt) => (
              <View
                key={pt.value}
                className={`flex-1 py-[20rpx] text-center rounded-[16rpx] text-[28rpx] ${payType === pt.value ? 'bg-[#ff6b35] text-white' : 'bg-muted text-foreground'}`}
                onClick={() => setPayType(pt.value)}
              >
                <Text>{pt.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <Button
        className="mx-[24rpx] mt-[48rpx] bg-[#ff6b35] text-white rounded-[16rpx] text-[32rpx]"
        disabled={submitting}
        onClick={onSubmit}
      >
        {t('distribution.withdraw.submit')}
      </Button>
    </View>
  )
}
