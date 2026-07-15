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
          Taro.redirectTo({
            url: `/pages/wallet/recharge/success?orderNo=${orderNo}&amount=${finalAmount}`,
          })
        } catch {
          Taro.redirectTo({ url: `/pages/wallet/recharge/fail?orderNo=${orderNo}` })
        }
      } else {
        Taro.redirectTo({
          url: `/pages/wallet/recharge/success?orderNo=${orderNo}&amount=${finalAmount}`,
        })
      }
    } catch {
      Taro.redirectTo({ url: '/pages/wallet/recharge/fail?orderNo=' })
    } finally {
      setSubmitting(false)
    }
  }, [finalAmount, t])

  return (
    <View className="min-h-screen bg-[#f7f8fa] pb-[160rpx]">
      <View className="m-[24rpx] p-[32rpx] bg-white rounded-[16rpx]">
        <Text className="block text-[28rpx] text-[#333] font-semibold mb-[24rpx]">
          {t('wallet.recharge.amount')}
        </Text>
        <View className="flex flex-wrap gap-[20rpx]">
          {PRESET_AMOUNTS.map((v) => (
            <View
              key={v}
              className={`w-[200rpx] py-[24rpx] text-center rounded-[12rpx] border-[2rpx] ${
                !useCustom && preset === v
                  ? 'border-[#07c160] bg-[#07c1600d]'
                  : 'border-[#eee] bg-white'
              }`}
              onClick={() => onSelectPreset(v)}
            >
              <Text className="block text-[36rpx] text-[#333] font-bold">¥{v}</Text>
            </View>
          ))}
        </View>
        <View className="mt-[24rpx]">
          <Text className="block text-[26rpx] text-[#999] mb-[12rpx]">
            {t('wallet.recharge.customAmount')}
          </Text>
          <Input
            className={`h-[80rpx] px-[24rpx] text-[28rpx] border-[2rpx] rounded-[12rpx] ${
              useCustom ? 'border-[#07c160] bg-[#07c1600d]' : 'border-[#eee] bg-white'
            }`}
            type="digit"
            placeholder={t('wallet.recharge.customPlaceholder')}
            value={custom}
            onInput={onInputCustom}
          />
        </View>
      </View>

      <View className="m-[24rpx] p-[32rpx] bg-white rounded-[16rpx]">
        <Text className="block text-[28rpx] text-[#333] font-semibold mb-[24rpx]">
          {t('wallet.recharge.method')}
        </Text>
        <View className="flex items-center py-[16rpx]">
          <View className="w-[60rpx] h-[60rpx] leading-[60rpx] text-center bg-[#f5f5f5] rounded-full text-[28rpx] text-[#09bb07]">
            微
          </View>
          <Text className="flex-1 ml-[24rpx] text-[28rpx] text-[#333]">
            {t('wallet.recharge.methodWechat')}
          </Text>
          <View className="w-[36rpx] h-[36rpx] rounded-full border-[2rpx] bg-[#07c160] border-[#07c160]" />
        </View>
      </View>

      <Button
        className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] bg-[#07c160] text-white rounded-[40rpx] text-[32rpx]"
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
