import { View, Text, Textarea, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { refund } from '@/api'
import { useI18n } from '@/i18n'

export default function OrderRefund() {
  const { t } = useI18n()
  const router = useRouter()
  const [orderNo, setOrderNo] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setOrderNo(router.params.orderNo || '')
  }, [router.params.orderNo])

  const onSubmit = async () => {
    if (!reason) return
    setSubmitting(true)
    try {
      await refund({ orderNo, reason })
      Taro.showToast({ title: t('order.refund.submitted'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  const disabled = !reason || submitting

  return (
    <View className="min-h-screen bg-background pb-[120rpx]">
      <View className="m-[24rpx] p-[32rpx] bg-card rounded-[16rpx]">
        <View className="text-[32rpx] text-foreground font-semibold mb-[24rpx]">
          {t('order.refund.title')}
        </View>
        <View className="flex justify-between py-[16rpx]">
          <Text className="text-[26rpx] text-muted-foreground">{t('order.refund.orderNo')}</Text>
          <Text className="text-[26rpx] text-foreground">{orderNo}</Text>
        </View>
        <View className="mt-[24rpx]">
          <Text className="text-[26rpx] text-muted-foreground">{t('order.refund.reason')}</Text>
          <Textarea
            className="w-full min-h-[200rpx] mt-[16rpx] p-[20rpx] bg-background rounded-[12rpx] text-[26rpx] box-border"
            value={reason}
            onInput={(e) => setReason(e.detail.value)}
            placeholder={t('order.refund.reasonPlaceholder')}
            maxlength={200}
          />
        </View>
      </View>
      <Button
        className={`fixed bottom-[32rpx] left-[32rpx] right-[32rpx] text-white rounded-[40rpx] text-[32rpx] ${disabled ? 'bg-[#ccc]' : 'bg-primary'}`}
        disabled={disabled}
        onClick={onSubmit}
      >
        {t('order.refund.submit')}
      </Button>
    </View>
  )
}
