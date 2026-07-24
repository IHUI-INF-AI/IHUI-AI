import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'

export default function RechargeFail() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const router = useRouter()
  const [orderNo, setOrderNo] = useState('')
  const [amount, setAmount] = useState(0)
  const [reason, setReason] = useState('')

  useEffect(() => {
    setOrderNo(decodeURIComponent(router.params.orderNo || ''))
    setAmount(Number(router.params.amount) || 0)
    setReason(decodeURIComponent(router.params.reason || ''))
  }, [router.params.orderNo, router.params.amount, router.params.reason])

  const retry = () => {
    Taro.redirectTo({ url: '/pages/wallet/recharge/index' })
  }

  const goBack = () => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/user/index' }) })
  }

  const viewDetail = () => {
    Taro.navigateTo({ url: '/pages/token/balance' })
  }

  return (
    <View className="min-h-screen bg-background pb-[80rpx]">
      <View className="pt-[120rpx] px-[60rpx] pb-[60rpx] text-center">
        <View className="w-[160rpx] h-[160rpx] mx-auto rounded-[16rpx] bg-[rgba(255,59,59,0.12)] border-[2rpx] border-[rgba(255,59,59,0.4)] flex items-center justify-center">
          <Text className="text-[80rpx] text-destructive leading-none">✕</Text>
        </View>
        <Text className="block text-[36rpx] text-foreground font-semibold mt-[32rpx]">{tt('wallet.recharge.fail.title', '充值失败')}</Text>
        <Text className="block text-[26rpx] text-muted-foreground mt-[12rpx] leading-[1.6]">{tt('wallet.recharge.fail.desc', '充值未成功,请稍后重试')}</Text>
      </View>

      <View className="mx-[32rpx] mb-[24rpx] px-[28rpx] py-[24rpx] bg-[rgba(245,158,11,0.08)] rounded-[12rpx]">
        <Text className="block text-[26rpx] text-warning font-semibold mb-[12rpx]">{tt('wallet.recharge.fail.hintTitle', '温馨提示')}</Text>
        <Text className="text-[24rpx] text-muted-foreground leading-[1.6]">
          {tt(
            'wallet.recharge.fail.hintText',
            '如充值未到账,请确认支付是否完成。款项将在 1-3 个工作日内原路退回,或联系客服协助处理。',
          )}
        </Text>
      </View>

      {(reason || orderNo || amount > 0) && (
        <View className="mx-[32rpx] my-[24rpx] px-[32rpx] py-[8rpx] bg-card rounded-[16rpx]">
          {reason ? (
            <View className="flex items-start justify-between py-[28rpx] gap-[24rpx] mt-[8rpx] first:mt-0">
              <Text className="text-[26rpx] text-muted-foreground flex-shrink-0">{tt('wallet.recharge.fail.reasonLabel', '失败原因')}</Text>
              <Text className="text-destructive text-[24rpx] text-right break-all">{reason}</Text>
            </View>
          ) : null}
          {orderNo ? (
            <View className="flex items-start justify-between py-[28rpx] gap-[24rpx] mt-[8rpx] first:mt-0">
              <Text className="text-[26rpx] text-muted-foreground flex-shrink-0">{tt('wallet.recharge.fail.orderNoLabel', '订单号')}</Text>
              <Text className="text-[24rpx] text-muted-foreground text-right break-all">{orderNo}</Text>
            </View>
          ) : null}
          {amount > 0 ? (
            <View className="flex items-start justify-between py-[28rpx] gap-[24rpx] mt-[8rpx] first:mt-0">
              <Text className="text-[26rpx] text-muted-foreground flex-shrink-0">{tt('wallet.recharge.fail.amountLabel', '充值金额')}</Text>
              <Text className="text-[26rpx] text-foreground text-right break-all font-semibold">¥{amount.toFixed(2)}</Text>
            </View>
          ) : null}
        </View>
      )}

      <View className="pt-[48rpx] px-[60rpx]">
        <Button className="mt-[24rpx] h-[88rpx] leading-[88rpx] rounded-[16rpx] text-[30rpx] text-center border-none p-0 bg-primary text-primary-foreground" onClick={retry}>
          {tt('wallet.recharge.fail.retry', '重新充值')}
        </Button>
        <Button className="mt-[24rpx] h-[88rpx] leading-[88rpx] rounded-[16rpx] text-[30rpx] text-center border-none p-0 bg-card text-foreground border-[2rpx] border-border" onClick={goBack}>
          {tt('wallet.recharge.fail.backWallet', '返回钱包')}
        </Button>
        <Button className="mt-[24rpx] h-[88rpx] leading-[88rpx] rounded-[16rpx] text-[30rpx] text-center border-none p-0 bg-card text-foreground border-[2rpx] border-border" onClick={viewDetail}>
          {tt('wallet.recharge.fail.viewDetail', '查看明细')}
        </Button>
        <Button className="mt-[24rpx] rounded-[16rpx] text-center border-none p-0 bg-transparent text-muted-foreground text-[26rpx] h-[72rpx] leading-[72rpx]" openType="contact">
          {tt('wallet.recharge.fail.contactService', '联系客服')}
        </Button>
      </View>

      <View className="mx-[32rpx] mt-[32rpx] px-[28rpx] py-[24rpx] bg-card rounded-[12rpx]">
        <Text className="block text-[26rpx] text-foreground font-semibold mb-[12rpx]">{tt('wallet.recharge.fail.faqQ', '充值失败会扣款吗?')}</Text>
        <Text className="text-[24rpx] text-muted-foreground leading-[1.6]">
          {tt(
            'wallet.recharge.fail.faqA',
            '若支付未完成则不会扣款;若已扣款但显示失败,款项将原路退回,请留意账户变动。',
          )}
        </Text>
      </View>
    </View>
  )
}
