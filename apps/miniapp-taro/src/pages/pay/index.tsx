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
        Taro.showToast({ title: '支付参数缺失', icon: 'none' })
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
      Taro.showToast({ title: '请使用微信扫码支付', icon: 'none' })
      return
    }
    if (payInfo.mock && payInfo.error) {
      Taro.showToast({ title: '支付配置未就绪,请联系管理员', icon: 'none' })
    }
    Taro.redirectTo({ url: `/pages/pay/result?orderNo=${no}` })
  }

  return (
    <View className="min-h-screen bg-[#f7f8fa] pb-[120rpx]">
      <View className="m-[24rpx] p-[32rpx] bg-white rounded-[16rpx]">
        <View className="text-center">
          <Text className="block text-[26rpx] text-[#999]">{t('pay.orderAmount')}</Text>
          <Text className="block text-[60rpx] text-[#dd524d] font-bold mt-[12rpx]">¥{amount}</Text>
        </View>
      </View>
      <View className="m-[24rpx] p-[32rpx] bg-white rounded-[16rpx]">
        <View className="text-[28rpx] text-[#333] font-semibold mb-[24rpx]">
          {t('pay.selectMethod')}
        </View>
        <View className="flex items-center py-[24rpx]">
          <View className="w-[60rpx] h-[60rpx] leading-[60rpx] text-center bg-[#f5f5f5] rounded-md text-[28rpx] text-[#09bb07]">
            微
          </View>
          <Text className="flex-1 ml-[24rpx] text-[28rpx] text-[#333]">{t('pay.wechat')}</Text>
          <View className="w-[36rpx] h-[36rpx] rounded-md border-[2rpx] bg-[#07c160] border-[#07c160]" />
        </View>
      </View>
      <Button
        className="fixed bottom-[32rpx] left-[32rpx] right-[32rpx] bg-[#07c160] text-white rounded-[40rpx] text-[32rpx]"
        loading={submitting}
        disabled={submitting}
        onClick={onPay}
      >
        {t('pay.confirm')} ¥{amount}
      </Button>
    </View>
  )
}
