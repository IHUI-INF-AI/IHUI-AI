import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getDistributionInfo, withdraw } from '@/api'
import { useTt } from '@/i18n'

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
    <View className="min-h-screen bg-background p-[24rpx]">
      {/* 可提现金额卡片 — 对齐原项目 content-wrap 紫色渐变 */}
      <View className="p-[48rpx_32rpx] rounded-[24rpx] shadow-sm bg-primary/10 border-[2rpx] border-primary/20">
        <Text className="block text-[26rpx] text-muted-foreground">
          {tt('wallet.withdrawal.availableYuan', '可提现金额(元)')}
        </Text>
        <Text className="block text-[64rpx] font-bold text-foreground mt-[12rpx]">
          {priceFmt.format(available)}
        </Text>
      </View>

      {/* 提现金额 + 提现方式卡片 — 对齐原项目 withdrawalMethods 渐变容器 */}
      <View className="mt-[24rpx] p-[32rpx] bg-card rounded-[20rpx]">
        <Text className="block text-[26rpx] text-muted-foreground mb-[16rpx]">
          {tt('wallet.withdrawal.amountLabel', '提现金额')}
        </Text>
        <View className="flex items-center py-[20rpx] border-b-[2rpx] border-border">
          <Text className="text-[40rpx] font-semibold text-destructive">¥</Text>
          <Input
            className="flex-1 text-[40rpx] text-destructive font-bold ml-[12rpx]"
            type="digit"
            value={amount}
            onInput={(e) => setAmount(e.detail.value)}
            placeholder={tt('distribution.withdraw.amountPlaceholder', '请输入提现金额')}
          />
          <Text
            className="text-[26rpx] text-warning py-[8rpx] px-[16rpx] underline"
            onClick={fillAll}
          >
            {tt('distribution.withdraw.all', '全部提现')}
          </Text>
        </View>

        <Text className="block text-[26rpx] text-muted-foreground mb-[16rpx] mt-[32rpx]">
          {tt('distribution.withdraw.method', '提现方式')}
        </Text>
        <View className="flex gap-[16rpx]">
          {methods.map((m) => (
            <View
              key={m.value}
              className={`flex-1 flex items-center p-[20rpx] border-[2rpx] rounded-[12rpx] ${method === m.value ? 'bg-primary/10 border-primary/40' : 'bg-muted border-transparent'}`}
              onClick={() => setMethod(m.value)}
            >

              <View
                className={`w-[56rpx] h-[56rpx] rounded-[12rpx] flex items-center justify-center text-white text-[26rpx] font-bold mr-[16rpx] ${m.value === 'wechat' ? 'bg-[var(--color-wechat-green)]' : 'bg-[#1677ff]'}`}
              >
                {m.icon}
              </View>
              <Text className="flex-1 text-[28rpx] text-foreground">{m.label}</Text>
              <View
                className={`w-[36rpx] h-[36rpx] border-[2rpx] rounded-[8rpx] flex items-center justify-center ${method === m.value ? 'bg-primary border-primary' : 'border-border'}`}
              >
                {method === m.value && (
                  <Text className="text-primary-foreground text-[24rpx] font-bold">✓</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>

      <Button
        className="mt-[40rpx] bg-primary text-primary-foreground rounded-[30rpx] text-[32rpx] font-bold"
        loading={submitting}
        disabled={submitting}
        onClick={onSubmit}
      >
        {tt('distribution.withdraw.submit', '提交申请')}
      </Button>

      <View
        className="mt-[32rpx] text-center text-[26rpx] text-muted-foreground"
        onClick={goRecords}
      >
        <Text>{tt('wallet.withdrawal.records', '提现记录')}</Text>
      </View>
    </View>
  )
}
