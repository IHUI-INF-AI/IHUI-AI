import { View, Text, Textarea, Input, Button, RadioGroup, Radio } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { refund, getOrderDetail, type Order } from '@/api'
import { useI18n } from '@/i18n'

const REASONS: Array<{ key: string; fb: string }> = [
  { key: 'order.refund.reasonUnwanted', fb: '不想要了' },
  { key: 'order.refund.reasonWrongItem', fb: '拍错/多拍' },
  { key: 'order.refund.reasonQuality', fb: '质量问题' },
  { key: 'order.refund.reasonMismatch', fb: '与描述不符' },
  { key: 'order.refund.reasonOther', fb: '其他原因' },
]

export default function OrderRefund() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const router = useRouter()
  const [orderNo, setOrderNo] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [desc, setDesc] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const no = decodeURIComponent(router.params.orderNo || '')
    setOrderNo(no)
    if (!no) {
      setLoading(false)
      return
    }
    getOrderDetail(no)
      .then((o) => setOrder(o))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false))
  }, [router.params.orderNo])

  const refundAmount = order ? order.amount : 0

  const onSubmit = async () => {
    if (!reason) {
      Taro.showToast({
        title: tt('order.refund.selectReasonFirst', '请选择退款原因'),
        icon: 'none',
      })
      return
    }
    const found = REASONS.find((r) => r.key === reason)
    const reasonLabel = found ? tt(found.key, found.fb) : reason
    const composed = [reasonLabel, desc && `说明:${desc}`, contact && `联系:${contact}`]
      .filter(Boolean)
      .join(' | ')
    setSubmitting(true)
    try {
      await refund({ orderNo, reason: composed })
      Taro.showToast({ title: tt('order.refund.submitted', '退款申请已提交'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch {
      Taro.showToast({ title: tt('setting.operationFailed', '操作失败'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const disabled = !reason || submitting || !orderNo

  return (
    <View className="min-h-screen bg-background pt-[24rpx] pr-[24rpx] pb-[160rpx] pl-[24rpx]">
      <View className="bg-card rounded-[16rpx] p-[32rpx]">
        <View className="text-[32rpx] font-semibold text-foreground mb-[24rpx]">
          {tt('order.refund.title', '申请退款')}
        </View>
        {loading ? (
          <Text className="text-[26rpx] text-muted-foreground">
            {tt('common.loading', '加载中…')}
          </Text>
        ) : (
          <View className="flex flex-col gap-[20rpx]">
            <View className="flex items-start justify-between gap-[24rpx]">
              <Text className="text-[26rpx] text-muted-foreground shrink-0">
                {tt('order.refund.orderNo', '订单号')}
              </Text>
              <Text className="text-[24rpx] text-muted-foreground text-right break-all">
                {orderNo}
              </Text>
            </View>
            {order?.title ? (
              <View className="flex items-start justify-between gap-[24rpx]">
                <Text className="text-[26rpx] text-muted-foreground shrink-0">
                  {tt('order.refund.productLabel', '商品名称')}
                </Text>
                <Text className="text-[26rpx] text-foreground text-right break-all">
                  {order.title}
                </Text>
              </View>
            ) : null}
            <View className="flex items-start justify-between gap-[24rpx]">
              <Text className="text-[26rpx] text-muted-foreground shrink-0">
                {tt('order.refund.amountLabel', '订单金额')}
              </Text>
              <Text className="text-[26rpx] text-primary font-semibold text-right break-all">
                ¥{refundAmount.toFixed(2)}
              </Text>
            </View>
            {order?.createTime ? (
              <View className="flex items-start justify-between gap-[24rpx]">
                <Text className="text-[26rpx] text-muted-foreground shrink-0">
                  {tt('order.refund.orderTimeLabel', '下单时间')}
                </Text>
                <Text className="text-[26rpx] text-foreground text-right break-all">
                  {order.createTime}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      <View className="mt-[24rpx] bg-card rounded-[16rpx] p-[32rpx]">
        <Text className="block text-[28rpx] text-foreground mb-[20rpx]">
          {tt('order.refund.refundAmount', '退款金额')}
        </Text>
        <View className="flex items-center justify-between">
          <Text className="text-[40rpx] font-bold text-primary">¥{refundAmount.toFixed(2)}</Text>
          <Text className="text-[22rpx] text-warning px-[16rpx] py-[6rpx] bg-[rgba(245,158,11,0.12)] rounded-[8rpx]">
            {tt('order.refund.amountReadOnly', '不可修改')}
          </Text>
        </View>
      </View>

      <View className="mt-[24rpx] bg-card rounded-[16rpx] p-[32rpx]">
        <Text className="block text-[28rpx] text-foreground mb-[20rpx]">
          {tt('order.refund.reason', '退款原因')}
        </Text>
        <RadioGroup
          className="flex flex-col gap-[24rpx]"
          onChange={(e) => setReason(e.detail.value)}
        >
          {REASONS.map((r) => (
            <View key={r.key} className="flex items-center gap-[16rpx]">
              <Radio value={r.key} checked={reason === r.key} color="var(--color-primary)" />
              <Text className="text-[28rpx] text-foreground">{tt(r.key, r.fb)}</Text>
            </View>
          ))}
        </RadioGroup>
      </View>

      <View className="mt-[24rpx] bg-card rounded-[16rpx] p-[32rpx]">
        <Text className="block text-[28rpx] text-foreground mb-[20rpx]">
          {tt('order.refund.descLabel', '退款说明')}
        </Text>
        <Textarea
          className="w-full min-h-[180rpx] p-[20rpx] bg-background rounded-[12rpx] text-[26rpx] text-foreground box-border"
          value={desc}
          onInput={(e) => setDesc(e.detail.value)}
          placeholder={tt('order.refund.descPlaceholder', '请补充退款说明(选填)')}
          maxlength={200}
        />
      </View>

      <View className="mt-[24rpx] bg-card rounded-[16rpx] p-[32rpx]">
        <Text className="block text-[28rpx] text-foreground mb-[20rpx]">
          {tt('order.refund.contactLabel', '联系方式')}
        </Text>
        <Input
          className="w-full h-[80rpx] px-[20rpx] bg-background rounded-[12rpx] text-[26rpx] text-foreground box-border"
          value={contact}
          onInput={(e) => setContact(e.detail.value)}
          placeholder={tt('order.refund.contactPlaceholder', '请输入手机号或邮箱')}
        />
      </View>

      <Button
        className={`fixed bottom-[32rpx] left-[32rpx] right-[32rpx] h-[88rpx] leading-[88rpx] rounded-[16rpx] text-[32rpx] text-center border-none p-0 ${disabled ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}
        disabled={disabled}
        loading={submitting}
        onClick={onSubmit}
      >
        {submitting
          ? tt('order.refund.submitting', '提交中…')
          : tt('order.refund.submit', '提交申请')}
      </Button>
    </View>
  )
}
