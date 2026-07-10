import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef } from 'react'
import { getDistributionInfo, withdraw } from '@/api'

const TYPES = [
  { value: 'wechat', name: '微信' },
  { value: 'alipay', name: '支付宝' },
  { value: 'bank', name: '银行卡' },
]

const TIPS = [
  '提现说明：',
  '1. 最低提现金额 ¥10',
  '2. 提现申请将在1-3个工作日内审核',
  '3. 工作日17:00前申请当日到账',
]

export default function DistributionWithdraw() {
  const [available, setAvailable] = useState(0)
  const [amount, setAmount] = useState('')
  const [payType, setPayType] = useState('wechat')
  const [submitting, setSubmitting] = useState(false)
  const availableRef = useRef(0)

  const load = async () => {
    try {
      const info = await getDistributionInfo()
      setAvailable(info.available)
      availableRef.current = info.available
    } catch (e) {
      // ignore
    }
  }

  const onSubmit = async () => {
    const amt = Number(amount)
    if (!amt || amt < 10) {
      Taro.showToast({ title: '最低提现¥10', icon: 'none' })
      return
    }
    if (amt > availableRef.current) {
      Taro.showToast({ title: '余额不足', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await withdraw({ amount: amt, type: payType })
      Taro.showToast({ title: '提现申请已提交', icon: 'success' })
      setAmount('')
      load()
    } catch (e) {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  useDidShow(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-[#f7f8fa] pb-[40rpx]">
      <View className="m-[24rpx] p-[32rpx] bg-white rounded-[16rpx]">
        <Text className="text-[26rpx] text-[#999]">可提现金额</Text>
        <Text className="block text-[60rpx] text-[#333] font-bold my-[16rpx]">¥{available}</Text>
        <View className="flex items-center py-[24rpx] border-t-[2rpx] border-[#f5f5f5]">
          <Text className="text-[40rpx] text-[#333] font-semibold">¥</Text>
          <Input
            className="flex-1 ml-[16rpx] text-[40rpx]"
            type="digit"
            value={amount}
            onInput={e => setAmount(e.detail.value)}
            placeholder="请输入提现金额"
          />
        </View>
        <View className="mt-[32rpx]">
          <Text className="text-[26rpx] text-[#999]">提现方式</Text>
          <View className="flex mt-[16rpx] gap-[16rpx]">
            {TYPES.map(t => (
              <View
                key={t.value}
                className={`flex-1 py-[20rpx] text-center border-[2rpx] rounded-[12rpx] text-[26rpx] ${payType === t.value ? 'border-[#ff6e3c] text-[#ff6e3c]' : 'border-[#eee] text-[#333]'}`}
                onClick={() => setPayType(t.value)}
              >
                <Text>{t.name}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <Button
        className="mx-[32rpx] my-[32rpx] bg-[#ff6e3c] text-white rounded-[40rpx] text-[32rpx]"
        disabled={submitting}
        onClick={onSubmit}
      >
        立即提现
      </Button>
      <View className="px-[32rpx]">
        {TIPS.map((tip, idx) => (
          <Text key={idx} className="block text-[22rpx] text-[#999] leading-[1.8]">
            {tip}
          </Text>
        ))}
      </View>
    </View>
  )
}
