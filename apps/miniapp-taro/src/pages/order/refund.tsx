import { View, Text, Textarea, Input, Button, RadioGroup, Radio } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { refund, getOrderDetail, type Order } from '@/api'
import { useI18n } from '@/i18n'
import './refund.css'

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
      Taro.showToast({ title: tt('order.refund.selectReasonFirst', '请选择退款原因'), icon: 'none' })
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
    <View className="rfd-page">
      <View className="rfd-order-card">
        <View className="rfd-order-title">{tt('order.refund.title', '申请退款')}</View>
        {loading ? (
          <Text className="rfd-order-loading">{tt('common.loading', '加载中…')}</Text>
        ) : (
          <View className="rfd-order-body">
            <View className="rfd-order-row">
              <Text className="rfd-order-label">{tt('order.refund.orderNo', '订单号')}</Text>
              <Text className="rfd-order-value rfd-order-value--mono">{orderNo}</Text>
            </View>
            {order?.title ? (
              <View className="rfd-order-row">
                <Text className="rfd-order-label">{tt('order.refund.productLabel', '商品名称')}</Text>
                <Text className="rfd-order-value">{order.title}</Text>
              </View>
            ) : null}
            <View className="rfd-order-row">
              <Text className="rfd-order-label">{tt('order.refund.amountLabel', '订单金额')}</Text>
              <Text className="rfd-order-value rfd-order-value--amount">¥{refundAmount.toFixed(2)}</Text>
            </View>
            {order?.createTime ? (
              <View className="rfd-order-row">
                <Text className="rfd-order-label">{tt('order.refund.orderTimeLabel', '下单时间')}</Text>
                <Text className="rfd-order-value">{order.createTime}</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      <View className="rfd-section">
        <Text className="rfd-section-label">{tt('order.refund.refundAmount', '退款金额')}</Text>
        <View className="rfd-amount-bar">
          <Text className="rfd-amount-num">¥{refundAmount.toFixed(2)}</Text>
          <Text className="rfd-amount-tag">{tt('order.refund.amountReadOnly', '不可修改')}</Text>
        </View>
      </View>

      <View className="rfd-section">
        <Text className="rfd-section-label">{tt('order.refund.reason', '退款原因')}</Text>
        <RadioGroup className="rfd-radio-group" onChange={(e) => setReason(e.detail.value)}>
          {REASONS.map((r) => (
            <View key={r.key} className="rfd-radio-item">
              <Radio value={r.key} checked={reason === r.key} color="var(--color-primary)" />
              <Text className="rfd-radio-text">{tt(r.key, r.fb)}</Text>
            </View>
          ))}
        </RadioGroup>
      </View>

      <View className="rfd-section">
        <Text className="rfd-section-label">{tt('order.refund.descLabel', '退款说明')}</Text>
        <Textarea
          className="rfd-textarea"
          value={desc}
          onInput={(e) => setDesc(e.detail.value)}
          placeholder={tt('order.refund.descPlaceholder', '请补充退款说明(选填)')}
          maxlength={200}
        />
      </View>

      <View className="rfd-section">
        <Text className="rfd-section-label">{tt('order.refund.contactLabel', '联系方式')}</Text>
        <Input
          className="rfd-input"
          value={contact}
          onInput={(e) => setContact(e.detail.value)}
          placeholder={tt('order.refund.contactPlaceholder', '请输入手机号或邮箱')}
        />
      </View>

      <Button
        className={`rfd-submit ${disabled ? 'rfd-submit--disabled' : ''}`}
        disabled={disabled}
        loading={submitting}
        onClick={onSubmit}
      >
        {submitting ? tt('order.refund.submitting', '提交中…') : tt('order.refund.submit', '提交申请')}
      </Button>
    </View>
  )
}
