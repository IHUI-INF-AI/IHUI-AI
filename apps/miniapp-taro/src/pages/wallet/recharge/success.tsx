import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'

const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export default function RechargeSuccess() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const router = useRouter()
  const [amount, setAmount] = useState(0)
  const [orderNo, setOrderNo] = useState('')
  const [arriveTime, setArriveTime] = useState('')

  useEffect(() => {
    setAmount(Number(router.params.amount) || 0)
    setOrderNo(decodeURIComponent(router.params.orderNo || ''))
    setArriveTime(timeFmt.format(new Date()))
  }, [router.params.amount, router.params.orderNo])

  const goBack = () => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/user/index' }) })
  }

  const goHome = () => {
    Taro.switchTab({ url: '/pages/index/index' })
  }

  const viewDetail = () => {
    Taro.navigateTo({ url: '/pages/token/balance' })
  }

  return (
    <View className="min-h-screen bg-background pb-[80rpx]">
      <View className="pt-[120rpx] px-[60rpx] pb-[60rpx] text-center">
        <View className="w-[160rpx] h-[160rpx] mx-auto rounded-[16rpx] bg-[rgba(34,197,94,0.12)] border-[2rpx] border-[rgba(34,197,94,0.4)] flex items-center justify-center">
          <Text className="text-[80rpx] text-success leading-none">✓</Text>
        </View>
        <Text className="block text-[36rpx] text-foreground font-semibold mt-[32rpx]">
          {tt('wallet.recharge.success.title', '充值成功')}
        </Text>
        <Text className="block text-[26rpx] text-muted-foreground mt-[12rpx]">
          {tt('wallet.recharge.success.desc', '充值已到账')}
        </Text>
        {amount > 0 && (
          <View className="mt-[32rpx] flex items-baseline justify-center">
            <Text className="text-[32rpx] text-primary font-semibold">¥</Text>
            <Text className="text-[64rpx] text-primary font-bold ml-[4rpx]">
              {amount.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      <View className="mx-[32rpx] mb-[24rpx] py-[24rpx] px-[28rpx] bg-[rgba(34,197,94,0.08)] rounded-[12rpx]">
        <Text className="block text-[26rpx] text-success font-semibold mb-[12rpx]">
          {tt('wallet.recharge.success.tipsTitle', '温馨提示')}
        </Text>
        <Text className="text-[24rpx] text-muted-foreground leading-[1.6]">
          {tt(
            'wallet.recharge.success.tipsText',
            '充值金额已到账,可在钱包明细中查看变动记录。如有疑问请联系客服。',
          )}
        </Text>
      </View>

      {(orderNo || arriveTime) && (
        <View className="mx-[24rpx] my-[24rpx] py-[8rpx] px-[32rpx] bg-card rounded-[16rpx]">
          {orderNo ? (
            <View className="flex items-start justify-between py-[28rpx] gap-[24rpx]">
              <Text className="text-[26rpx] text-muted-foreground shrink-0">
                {tt('wallet.recharge.success.orderNoLabel', '订单号')}
              </Text>
              <Text className="text-[26rpx] text-foreground text-right break-all">{orderNo}</Text>
            </View>
          ) : null}
          {arriveTime ? (
            <View
              className={`flex items-start justify-between py-[28rpx] gap-[24rpx] ${orderNo ? 'mt-[8rpx]' : ''}`}
            >
              <Text className="text-[26rpx] text-muted-foreground shrink-0">
                {tt('wallet.recharge.success.arriveTime', '到账时间')}
              </Text>
              <Text className="text-[26rpx] text-foreground text-right break-all">
                {arriveTime}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <View className="pt-[48rpx] px-[60rpx]">
        <Button
          className="mt-[24rpx] h-[88rpx] leading-[88rpx] rounded-[16rpx] text-[30rpx] text-center p-0 after:content-[''] after:border-none bg-primary text-primary-foreground"
          onClick={goBack}
        >
          {tt('wallet.recharge.success.backWallet', '返回钱包')}
        </Button>
        <Button
          className="mt-[24rpx] h-[88rpx] leading-[88rpx] rounded-[16rpx] text-[30rpx] text-center p-0 after:content-[''] after:border-none border-[2rpx] border-solid border-border bg-card text-foreground"
          onClick={viewDetail}
        >
          {tt('wallet.recharge.success.viewDetail', '查看明细')}
        </Button>
        <Button
          className="mt-[24rpx] h-[88rpx] leading-[88rpx] rounded-[16rpx] text-[30rpx] text-center p-0 after:content-[''] after:border-none border-[2rpx] border-solid border-border bg-card text-foreground"
          onClick={goHome}
        >
          {tt('wallet.recharge.success.backHome', '返回首页')}
        </Button>
        <Button
          className="mt-[24rpx] h-[72rpx] leading-[72rpx] rounded-[16rpx] text-[26rpx] text-center p-0 after:content-[''] after:border-none bg-transparent text-muted-foreground"
          openType="share"
        >
          {tt('wallet.recharge.success.shareFriend', '分享给好友')}
        </Button>
      </View>
    </View>
  )
}
