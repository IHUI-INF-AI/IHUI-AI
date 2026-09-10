// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, type TtFn, t } from '@/i18n'
import { View, Text, Textarea, Input, Button, RadioGroup, Radio } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { refund, getOrderDetail, type Order } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

const REASONS = (tt: TtFn): Array<{ key: string; fb: string }> => [
  { key: 'order.refund.reasonUnwanted', fb: tt('orderRefund.d1', '不想要了') },
  { key: 'order.refund.reasonWrongItem', fb: tt('orderRefund.d2', '拍错/多拍') },
  { key: 'order.refund.reasonQuality', fb: tt('orderRefund.d3', '质量问题') },
  { key: 'order.refund.reasonMismatch', fb: tt('orderRefund.d4', '与描述不符') },
  { key: 'order.refund.reasonOther', fb: tt('orderRefund.d5', '其他原因') },
]

export default function OrderRefund() {
  const tt = useTt()
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
    if (!order?.id) {
      Taro.showToast({ title: tt('order.loadFailed', '订单信息加载失败'), icon: 'none' })
      return
    }
    const found = REASONS(tt).find((r) => r.key === reason)
    const reasonLabel = found ? tt(found.key, found.fb) : reason
    const composed = [
      reasonLabel,
      desc && t('orderRefund.y1', { p1: desc }),
      contact && t('orderRefund.y2', { p1: contact }),
    ]
      .filter(Boolean)
      .join(' | ')
    setSubmitting(true)
    try {
      await refund({ orderId: String(order.id), reason: composed })
      Taro.showToast({ title: tt('order.refund.submitted', '退款申请已提交'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch {
      Taro.showToast({ title: tt('setting.operationFailed', '操作失败'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const disabled = !reason || submitting || !order?.id

  return (
    <ThemeRoot>
      {/* 对齐 RN SharedOrderRefundScreen:背景 surface.bg(bg-background)、内容 padding 20rpx、
          卡片 padding 24rpx / 圆角 24rpx / 2rpx 描边 / 白卡,金额 36rpx/600 success,
          输入框 2rpx 描边 / 圆角 24rpx / bg surface.muted,提交按钮 h100rpx 圆角 24rpx */}
      <View className="min-h-screen bg-background p-[20rpx] pb-[160rpx]">
        <View className="rounded-[24rpx] border-[2rpx] border-border bg-card p-[24rpx]">
          <View className="text-[32rpx] font-semibold text-foreground mb-[24rpx]">
            {tt('order.refund.title', '申请退款')}
          </View>
          {loading ? (
            <Text className="text-[28rpx] text-muted-foreground">
              {tt('common.loading', '加载中…')}
            </Text>
          ) : (
            <View className="flex flex-col gap-[16rpx]">
              <View className="flex items-start justify-between gap-[24rpx]">
                <Text className="text-[28rpx] text-muted-foreground shrink-0">
                  {tt('order.refund.orderNo', '订单号')}
                </Text>
                <Text className="text-[28rpx] text-muted-foreground text-right break-all">
                  {orderNo}
                </Text>
              </View>
              {order?.title ? (
                <View className="flex items-start justify-between gap-[24rpx]">
                  <Text className="text-[28rpx] text-muted-foreground shrink-0">
                    {tt('order.refund.productLabel', '商品名称')}
                  </Text>
                  <Text className="text-[28rpx] text-foreground text-right break-all">
                    {order.title}
                  </Text>
                </View>
              ) : null}
              <View className="flex items-start justify-between gap-[24rpx]">
                <Text className="text-[28rpx] text-muted-foreground shrink-0">
                  {tt('order.refund.amountLabel', '订单金额')}
                </Text>
                <Text className="text-[36rpx] font-semibold text-[var(--color-success)] text-right break-all">
                  ¥{refundAmount.toFixed(2)}
                </Text>
              </View>
              {order?.createTime ? (
                <View className="flex items-start justify-between gap-[24rpx]">
                  <Text className="text-[28rpx] text-muted-foreground shrink-0">
                    {tt('order.refund.orderTimeLabel', '下单时间')}
                  </Text>
                  <Text className="text-[28rpx] text-foreground text-right break-all">
                    {order.createTime}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View className="mt-[24rpx] rounded-[24rpx] border-[2rpx] border-border bg-card p-[24rpx]">
          <Text className="block text-[28rpx] font-medium text-foreground mb-[20rpx]">
            {tt('order.refund.refundAmount', '退款金额')}
          </Text>
          <View className="flex items-center justify-between">
            <Text className="text-[36rpx] font-semibold text-[var(--color-success)]">
              ¥{refundAmount.toFixed(2)}
            </Text>
            <Text className="text-[22rpx] text-[var(--color-warning-amber-text)] px-[16rpx] py-[6rpx] bg-[var(--color-warning-amber-light)] rounded-[8rpx]">
              {tt('order.refund.amountReadOnly', '不可修改')}
            </Text>
          </View>
        </View>

        <View className="mt-[24rpx] rounded-[24rpx] border-[2rpx] border-border bg-card p-[24rpx]">
          <Text className="block text-[28rpx] font-medium text-foreground mb-[20rpx]">
            {tt('order.refund.reason', '退款原因')}
          </Text>
          <RadioGroup
            className="flex flex-col gap-[24rpx]"
            onChange={(e) => setReason(e.detail.value)}
          >
            {REASONS(tt).map((r) => (
              <View key={r.key} className="flex items-center gap-[16rpx]">
                <Radio value={r.key} checked={reason === r.key} color="var(--color-primary)" />
                <Text className="text-[28rpx] text-foreground">{tt(r.key, r.fb)}</Text>
              </View>
            ))}
          </RadioGroup>
        </View>

        <View className="mt-[24rpx] rounded-[24rpx] border-[2rpx] border-border bg-card p-[24rpx]">
          <Text className="block text-[28rpx] font-medium text-foreground mb-[20rpx]">
            {tt('order.refund.descLabel', '退款说明')}
          </Text>
          <Textarea
            className="w-full min-h-[160rpx] py-[16rpx] px-[28rpx] bg-[var(--color-muted)] rounded-[24rpx] border-[2rpx] border-border text-[32rpx] text-foreground box-border"
            value={desc}
            onInput={(e) => setDesc(e.detail.value)}
            placeholder={tt('order.refund.descPlaceholder', '请补充退款说明(选填)')}
            maxlength={200}
          />
        </View>

        <View className="mt-[24rpx] rounded-[24rpx] border-[2rpx] border-border bg-card p-[24rpx]">
          <Text className="block text-[28rpx] font-medium text-foreground mb-[20rpx]">
            {tt('order.refund.contactLabel', '联系方式')}
          </Text>
          <Input
            className="w-full h-[88rpx] py-[16rpx] px-[28rpx] bg-[var(--color-muted)] rounded-[24rpx] border-[2rpx] border-border text-[32rpx] text-foreground box-border"
            value={contact}
            onInput={(e) => setContact(e.detail.value)}
            placeholder={tt('order.refund.contactPlaceholder', '请输入手机号或邮箱')}
          />
        </View>

        <Button
          className={`fixed bottom-[32rpx] left-[32rpx] right-[32rpx] h-[100rpx] leading-[100rpx] rounded-[24rpx] text-[32rpx] font-semibold text-center border-none p-0 ${
            disabled ? 'opacity-50' : ''
          } bg-primary text-primary-foreground`}
          disabled={disabled}
          loading={submitting}
          onClick={onSubmit}
        >
          {submitting
            ? tt('order.refund.submitting', '提交中…')
            : tt('order.refund.submit', '提交申请')}
        </Button>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
