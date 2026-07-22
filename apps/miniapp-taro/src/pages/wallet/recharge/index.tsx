import { View, Text, Button, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { createRecharge } from '@/api'
import { useI18n } from '@/i18n'
import { requestWxPayment, type AnyPayParams } from '@/utils/pay'

const PRESET_AMOUNTS = [10, 50, 100, 500, 1000]

export default function RechargePage() {
  const { t } = useI18n()
  const [preset, setPreset] = useState(100)
  const [custom, setCustom] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const customNum = Number(custom) || 0
  const finalAmount = useCustom ? customNum : preset

  const onSelectPreset = (v: number) => {
    setPreset(v)
    setUseCustom(false)
  }

  const onInputCustom = (e: { detail: { value: string } }) => {
    setCustom(e.detail.value)
    setUseCustom(true)
  }

  const onSubmit = useCallback(async () => {
    if (!finalAmount || finalAmount < 1) {
      Taro.showToast({ title: t('wallet.recharge.invalidAmount'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const res = await createRecharge(finalAmount, 'wechat')
      const orderNo = res.outTradeNo || ''
      if (res.payParams) {
        try {
          await requestWxPayment(res.payParams as AnyPayParams)
          Taro.redirectTo({ url: `/pages/pay/result?orderNo=${orderNo}` })
        } catch {
          Taro.redirectTo({ url: `/pages/wallet/recharge/fail?orderNo=${orderNo}` })
        }
      } else {
        Taro.redirectTo({ url: `/pages/pay/result?orderNo=${orderNo}` })
      }
    } catch {
      Taro.redirectTo({ url: '/pages/wallet/recharge/fail?orderNo=' })
    } finally {
      setSubmitting(false)
    }
  }, [finalAmount, t])

  return (
    <View className="min-h-screen bg-background pb-[160rpx]">
      <View className="m-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
        <Text className="block text-[28rpx] text-foreground font-semibold mb-[24rpx]">
          {t('wallet.recharge.amount')}
        </Text>
        <View className="flex flex-wrap gap-[20rpx]">
          {PRESET_AMOUNTS.map((v) => (
            <View
              key={v}
              className={`w-[200rpx] py-[24rpx] text-center rounded-[12rpx] border-[2rpx] ${
                !useCustom && preset === v
                  ? 'border-primary bg-[#00f2ff0d]'
                  : 'border-[var(--color-border)] bg-card'
              }`}
              onClick={() => onSelectPreset(v)}
            >
              <Text className="block text-[36rpx] text-foreground font-bold">¥{v}</Text>
            </View>
          ))}
        </View>
        <View className="mt-[24rpx]">
          <Text className="block text-[26rpx] text-muted-foreground mb-[12rpx]">
            {t('wallet.recharge.customAmount')}
          </Text>
          <Input
            className={`h-[80rpx] px-[24rpx] text-[28rpx] border-[2rpx] rounded-[12rpx] ${
              useCustom ? 'border-primary bg-[#00f2ff0d]' : 'border-[var(--color-border)] bg-card'
            }`}
            type="digit"
            placeholder={t('wallet.recharge.customPlaceholder')}
            value={custom}
            onInput={onInputCustom}
          />
        </View>
      </View>

      <View className="m-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
        <Text className="block text-[28rpx] text-foreground font-semibold mb-[24rpx]">
          {t('wallet.recharge.method')}
        </Text>
        <View className="flex items-center py-[16rpx]">
          <View className="w-[60rpx] h-[60rpx] leading-[60rpx] text-center bg-muted rounded-md text-[28rpx] text-[#09bb07]">
            微
          </View>
          <Text className="flex-1 ml-[24rpx] text-[28rpx] text-foreground">
            {t('wallet.recharge.methodWechat')}
          </Text>
          <View className="w-[36rpx] h-[36rpx] rounded-md border-[2rpx] bg-primary border-primary" />
        </View>
      </View>

      <Button
        className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] bg-primary text-white rounded-[40rpx] text-[32rpx]"
        loading={submitting}
        disabled={submitting || !finalAmount}
        onClick={onSubmit}
      >
        {submitting
          ? t('wallet.recharge.submitting')
          : `${t('wallet.recharge.submit')} ¥${finalAmount || 0}`}
      </Button>
    </View>
  )
}
