// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text, Input, Button } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getDistributionInfo, withdraw } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

const priceFmt = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export default function WithdrawalPage() {
  const tt = useTt()
  const [available, setAvailable] = useState(0)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('wechat')
  const [submitting, setSubmitting] = useState(false)
  const availableRef = useRef(0)

  const methods = [
    { value: 'wechat', label: tt('distribution.withdraw.methodWechat', '微信'), icon: '微' },
    { value: 'alipay', label: tt('distribution.withdraw.methodAlipay', '支付宝'), icon: '支' },
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
    setAmount(priceFmt.format(availableRef.current))
  }

  const onSubmit = async () => {
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      Taro.showToast({
        title: tt('distribution.withdraw.invalidAmount', '请输入有效金额'),
        icon: 'none',
      })
      return
    }
    if (amt > availableRef.current) {
      Taro.showToast({
        title: tt('distribution.withdraw.insufficient', '可提现余额不足'),
        icon: 'none',
      })
      return
    }
    setSubmitting(true)
    try {
      await withdraw({ amount: amt, type: method })
      Taro.showToast({
        title: tt('distribution.withdraw.submitted', '提现申请已提交'),
        icon: 'success',
      })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  const goRecords = () => {
    Taro.navigateTo({ url: '/pages/developer/withdrawal' })
  }

  useDidShow(() => {
    load()
  })

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background p-[20rpx]">
        {/* 可提现金额卡片 — 对齐 RN WithdrawScreen balanceCard(padding 14/radius 12/白卡) */}
        <View className="p-[28rpx] rounded-[24rpx] bg-card mb-[24rpx]">
          <Text className="block text-[28rpx] text-muted-foreground">
            {tt('wallet.withdrawal.availableYuan', '可提现金额(元)')}
          </Text>
          <Text className="block text-[56rpx] font-bold text-foreground mt-[16rpx]">
            {priceFmt.format(available)}
          </Text>
        </View>

        {/* 提现金额 + 提现方式卡片 — 对齐 RN WithdrawScreen card(padding 12/radius 12/border.light) */}
        <View className="rounded-[24rpx] border-[2rpx] border-border bg-card p-[24rpx]">
          <Text className="block text-[28rpx] text-muted-foreground">
            {tt('wallet.withdrawal.amountLabel', '提现金额')}
          </Text>
          <View className="flex items-center mt-[16rpx] h-[100rpx] px-[28rpx] rounded-[24rpx] border-[2rpx] border-border bg-[var(--color-muted)]">
            <Text className="text-[32rpx] font-semibold text-foreground">¥</Text>
            <Input
              className="flex-1 text-[32rpx] text-foreground ml-[12rpx]"
              type="digit"
              value={amount}
              onInput={(e) => setAmount(e.detail.value)}
              placeholder={tt('distribution.withdraw.amountPlaceholder', '请输入提现金额')}
            />
            <Text className="text-[22rpx] text-[var(--color-text-tertiary)]" onClick={fillAll}>
              {tt('distribution.withdraw.all', '全部提现')}
            </Text>
          </View>

          <Text className="block text-[28rpx] text-muted-foreground mt-[32rpx] mb-[16rpx]">
            {tt('distribution.withdraw.method', '提现方式')}
          </Text>
          <View className="flex gap-[20rpx]">
            {methods.map((m) => (
              <View
                key={m.value}
                className={`flex-1 flex items-center p-[28rpx] border-[2rpx] rounded-[24rpx] bg-card ${method === m.value ? 'border-[var(--color-primary)]' : 'border-border'}`}
                onClick={() => setMethod(m.value)}
                hoverClass="opacity-60"
              >
                <View
                  className={`w-[56rpx] h-[56rpx] rounded-[16rpx] flex items-center justify-center text-[26rpx] font-semibold mr-[20rpx] text-[var(--color-surface-light)] ${m.value === 'wechat' ? 'bg-[var(--color-wechat-green)]' : 'bg-[var(--color-alipay-blue)]'}`}
                >
                  {m.icon}
                </View>
                <Text className="flex-1 text-[32rpx] text-foreground">{m.label}</Text>
                <View
                  className={`w-[36rpx] h-[36rpx] border-[2rpx] rounded-[8rpx] flex items-center justify-center ${method === m.value ? 'bg-primary border-primary' : 'border-border bg-card'}`}
                >
                  {method === m.value && (
                    <LineIcon name="check" size={24} color="var(--color-primary-foreground)" />
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        <Button
          className="mt-[40rpx] bg-primary text-primary-foreground rounded-[24rpx] text-[32rpx] font-semibold"
          loading={submitting}
          disabled={submitting}
          onClick={onSubmit}
        >
          {tt('distribution.withdraw.submit', '提交申请')}
        </Button>

        <View
          className="mt-[24rpx] text-center text-[22rpx] text-[var(--color-text-tertiary)]"
          onClick={goRecords}
          hoverClass="opacity-60"
        >
          <Text>{tt('wallet.withdrawal.records', '提现记录')}</Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
