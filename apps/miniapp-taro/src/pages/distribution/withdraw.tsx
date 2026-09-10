// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getDistributionInfo, withdraw } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

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
    <ThemeRoot className="min-h-screen bg-background">
      {/* 对齐 RN WithdrawScreen balanceCard:白卡 + 28rpx 标签 + 56rpx 加粗余额 */}
      <View className="mx-[20rpx] mt-[20rpx] bg-card rounded-[24rpx] p-[28rpx]">
        <Text className="text-[28rpx] text-muted-foreground">
          {t('distribution.withdraw.available')}
        </Text>
        <Text className="block text-[56rpx] text-foreground font-bold mt-[16rpx]">
          ¥{available}
        </Text>
      </View>
      {/* 对齐 RN card:白卡 + 描边 + 输入框(muted 底 + 描边圆角) */}
      <View className="mx-[20rpx] mt-[24rpx] bg-card border border-border rounded-[24rpx] p-[24rpx]">
        <View className="flex items-center h-[100rpx] px-[28rpx] rounded-[24rpx] border border-border bg-[var(--color-muted)]">
          <Text className="text-[32rpx] font-semibold text-foreground">¥</Text>
          <Input
            className="flex-1 ml-[16rpx] text-[32rpx] text-foreground"
            type="digit"
            value={amount}
            onInput={(e) => setAmount(e.detail.value)}
            placeholder={t('distribution.withdraw.amountPlaceholder')}
            placeholder-style="color: var(--color-text-tertiary)"
          />
          <Button
            className="text-[24rpx] text-[var(--color-brand-orange)] bg-transparent border-none leading-[48rpx] p-0 min-h-0"
            onClick={fillAll}
          >
            {t('distribution.withdraw.all')}
          </Button>
        </View>
        <View className="mt-[24rpx]">
          <Text className="text-[28rpx] text-muted-foreground">
            {t('distribution.withdraw.method')}
          </Text>
          <View className="flex mt-[16rpx] gap-[16rpx]">
            {payTypes.map((pt) => (
              <View
                key={pt.value}
                className={`flex-1 py-[12rpx] text-center rounded-[24rpx] text-[28rpx] ${payType === pt.value ? 'bg-primary text-primary-foreground font-semibold' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}`}
                onClick={() => setPayType(pt.value)}
                hoverClass="opacity-60"
              >
                <Text>{pt.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      {/* 对齐 RN submitBtn:brand 底(语义 primary)+ 100rpx 高 + 24rpx 圆角;disabled 取 text-tertiary */}
      <Button
        className={`mx-[20rpx] mt-[40rpx] rounded-[24rpx] text-[32rpx] font-semibold h-[100rpx] leading-[100rpx] ${submitting ? 'bg-[var(--color-text-tertiary)] text-[var(--color-surface-light)]' : 'bg-primary text-primary-foreground'}`}
        disabled={submitting}
        onClick={onSubmit}
      >
        {t('distribution.withdraw.submit')}
      </Button>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
