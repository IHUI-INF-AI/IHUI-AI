import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { getVipOrderPayInfo, type VipPayInfo } from '@/api'
import { requestWxPayment, type AnyPayParams } from '@/utils/pay'
import { useI18n } from '@/i18n'

export default function PayIndex() {
  const { t } = useI18n()
  const router = useRouter()
  const [orderNo, setOrderNo] = useState('')
  const [amount, setAmount] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setOrderNo(router.params.orderNo || '')
    setAmount(Number(router.params.amount) || 0)
  }, [router.params.orderNo, router.params.amount])

  const onPay = async () => {
    if (!orderNo) {
      Taro.showToast({ title: t('pay.orderAbnormal'), icon: 'none' })
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await getVipOrderPayInfo(orderNo)
      if (res.status === 'paid') {
        Taro.redirectTo({ url: `/pages/pay/result?orderNo=${orderNo}` })
        return
      }
      if (!res.payInfo) {
        Taro.showToast({ title: t('pay.missingParams'), icon: 'none' })
        return
      }
      dispatchPay(res.payInfo, orderNo)
    } catch {
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  function dispatchPay(payInfo: VipPayInfo, no: string) {
    if (
      payInfo.method === 'jsapi' &&
      payInfo.timeStamp &&
      payInfo.nonceStr &&
      payInfo.package &&
      payInfo.signType &&
      payInfo.paySign
    ) {
      requestWxPayment(payInfo as AnyPayParams)
        .then(() => Taro.redirectTo({ url: `/pages/pay/result?orderNo=${no}` }))
        .catch(() => Taro.redirectTo({ url: `/pages/wallet/recharge/fail?orderNo=${no}` }))
      return
    }
    if (payInfo.method === 'h5' && payInfo.h5Url && process.env.TARO_ENV === 'h5') {
      window.location.href = payInfo.h5Url
      return
    }
    if (payInfo.method === 'native') {
      Taro.showToast({ title: t('pay.useWechatScan'), icon: 'none' })
      return
    }
    if (payInfo.mock && payInfo.error) {
      Taro.showToast({ title: t('pay.configNotReady'), icon: 'none' })
    }
    Taro.redirectTo({ url: `/pages/pay/result?orderNo=${no}` })
  }

  return (
    <View className="min-h-screen bg-background pb-[120rpx]">
      <View className="m-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
        <View className="text-center">
          <Text className="block text-[26rpx] text-muted-foreground">{t('pay.orderAmount')}</Text>
          <Text className="block text-[60rpx] text-[#dd524d] font-bold mt-[12rpx]">¥{amount}</Text>
        </View>
      </View>
      <View className="m-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
        <View className="text-[28rpx] text-foreground font-semibold mb-[24rpx]">
          {t('pay.selectMethod')}
        </View>
        <View className="flex items-center py-[24rpx]">
          <View className="w-[60rpx] h-[60rpx] leading-[60rpx] text-center bg-muted rounded-md text-[28rpx] text-[#09bb07]">
            微
          </View>
          <Text className="flex-1 ml-[24rpx] text-[28rpx] text-foreground">{t('pay.wechat')}</Text>
          <View className="w-[36rpx] h-[36rpx] rounded-md border-[2rpx] bg-primary border-primary" />
        </View>
      </View>
      <Button
        className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] bg-primary text-white rounded-[40rpx] text-[32rpx]"
        loading={submitting}
        disabled={submitting}
        onClick={onPay}
      >
        {t('pay.confirm')} ¥{amount}
      </Button>
    </View>
  )
}
