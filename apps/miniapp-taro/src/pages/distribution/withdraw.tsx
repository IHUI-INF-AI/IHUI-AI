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
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] mt-[12px] bg-white rounded-[8px] p-[16px]">
        <Text className="text-[12px] text-[#999]">{t('distribution.withdraw.available')}</Text>
        <Text className="block text-[40px] text-[#333] font-bold mt-[4px]">¥{available}</Text>
        <View className="flex items-center py-[12px] mt-[8px] border-t-[1px] border-[#f5f5f5]">
          <Text className="text-[24px] text-[#333] font-semibold">¥</Text>
          <Input
            className="flex-1 ml-[8px] text-[24px]"
            type="digit"
            value={amount}
            onInput={(e) => setAmount(e.detail.value)}
            placeholder={t('distribution.withdraw.amountPlaceholder')}
          />
          <Button
            className="text-[12px] text-[#ff6b35] bg-transparent border-none leading-[24px]"
            onClick={fillAll}
          >
            {t('distribution.withdraw.all')}
          </Button>
        </View>
        <View className="mt-[16px]">
          <Text className="text-[12px] text-[#999]">{t('distribution.withdraw.method')}</Text>
          <View className="flex mt-[8px] gap-[12px]">
            {payTypes.map((pt) => (
              <View
                key={pt.value}
                className={`flex-1 py-[10px] text-center rounded-[8px] text-[14px] ${payType === pt.value ? 'bg-[#ff6b35] text-white' : 'bg-[#f5f5f5] text-[#333]'}`}
                onClick={() => setPayType(pt.value)}
              >
                <Text>{pt.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <Button
        className="mx-[12px] mt-[24px] bg-[#ff6b35] text-white rounded-[8px] text-[16px]"
        disabled={submitting}
        onClick={onSubmit}
      >
        {t('distribution.withdraw.submit')}
      </Button>
    </View>
  )
}
