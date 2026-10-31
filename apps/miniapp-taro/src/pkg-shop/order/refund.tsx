// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/order-refund/OrderRefundScreen.tsx
import { useTt, type TtFn, t } from '@/i18n'
import { View, Text, Button, RadioGroup, Radio } from '@tarojs/components'
import { FocusInput, FocusTextarea } from '@/components/FocusField'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { useUiField } from '@/lib/ui-field-registry'
import { refund, getOrderDetail, type Order } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { safeDecodeURIComponent } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'
import RefundHeader from './refund-header'
import RefundOrderCard from './refund-order-card'
import { getRnTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'

const REASONS = (tt: TtFn): Array<{ key: string; fb: string }> => [
  { key: 'orderRefund.d1', fb: tt('orderRefund.d1', '不想要了') },
  { key: 'orderRefund.d2', fb: tt('orderRefund.d2', '拍错/多拍') },
  { key: 'orderRefund.d3', fb: tt('orderRefund.d3', '质量问题') },
  { key: 'orderRefund.d4', fb: tt('orderRefund.d4', '与描述不符') },
  { key: 'orderRefund.d5', fb: tt('orderRefund.d5', '其他原因') },
]

export default function OrderRefund() {
  const tt = useTt()
  /* 微信 radio 的 color 走 wxml 原生属性位(与 style 槽是两个位置),不解析 CSS 变量、也不报错,
     只会静默回落宿主默认色 ⇒ 必须给 JS 派生色值。原意是墨档(主色),取 brand.DEFAULT
     (随主题明暗翻转),与同端已修好的那批 Switch 开关墨色同一先例(见 subscribe.tsx)。 */
  const { resolved } = useAppTheme()
  const radioInk = getRnTokens(resolved).brand.DEFAULT
  const router = useRouter()
  const gate = useAuthReadyGate()
  const [orderNo, setOrderNo] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  /** 订单详情取失败(与"没带订单号"分开:前者可重试,后者是空态) */
  const [loadError, setLoadError] = useState(false)
  const [reason, setReason] = useState('')
  /** 选「其他原因」时用户自己填的那句(拼进 reason 一起提交) */
  const [otherReason, setOtherReason] = useState('')
  const [desc, setDesc] = useState('')
  const [contact, setContact] = useState('')
  // AI 操控通道(2026-09-21):只登记联系方式(普通业务输入)。
  // 未登记:退款说明 —— 屏上文案含"退款",命中注册表 DESTRUCTIVE_RE,注册了也连快照都不出现,
  // 且退款单一旦提交不可逆 → 按"宁可不注册"跳过;提交按钮同样不注册。
  useUiField({
    kind: 'input',
    label: tt('order.refund.contactPlaceholder', '请输入手机号或邮箱'),
    placeholder: tt('order.refund.contactPlaceholder', '请输入手机号或邮箱'),
    readValue: () => contact,
    setValue: setContact,
  })
  const [submitting, setSubmitting] = useState(false)

  const loadOrder = useCallback((no: string) => {
    setLoadError(false)
    setLoading(true)
    getOrderDetail(no)
      .then((o) => setOrder(o))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const no = safeDecodeURIComponent(router.params.orderNo || '')
    setOrderNo(no)
    if (!no) {
      setLoading(false)
      return
    }
    // G-933 冷启动门控:需登录的订单详情在鉴权判定落定前不发(卸载时取消订阅)
    const cancel = gate.waitUntilReady(() => loadOrder(no))
    return cancel
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const fallbackLabel = found ? tt(found.key, found.fb) : reason
    // 「其他原因」:用户填的那句优先,空着就退到标签本身
    const reasonLabel =
      reason === 'orderRefund.d5' && otherReason.trim() ? otherReason.trim() : fallbackLabel
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

  // 空态 / 错误态:没带订单号 = 没有可退款的订单;详情取失败 = 可重试。
  // 两种都不摆一张 ¥0.00 的空表单(共享屏的 empty 与错误重试两态)。
  if (!loading && (!orderNo || loadError)) {
    return (
      <ThemeRoot>
        <View className="min-h-screen bg-background p-[20rpx]">
          <View className="flex flex-col items-center gap-[24rpx] rounded-lg border-[length:2rpx] border-border bg-card px-[24rpx] py-[80rpx]">
            <Text className="text-[length:28rpx] text-muted-foreground">
              {orderNo
                ? tt('order.loadFailed', '订单信息加载失败')
                : tt('orderRefund.empty', '暂无可退款的订单')}
            </Text>
            {orderNo ? (
              <View
                className="rounded-sm bg-cta px-[32rpx] py-[14rpx]"
                hoverClass="opacity-60"
                onClick={() => loadOrder(orderNo)}
              >
                <Text className="text-[length:26rpx] font-semibold text-cta-foreground">
                  {tt('orderRefund.retry', '重试')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot>
      {/* 对齐 RN SharedOrderRefundScreen:背景 surface.bg(bg-background)、内容 padding 20rpx、
          卡片 padding 24rpx / 圆角 24rpx / 2rpx 描边 / 白卡,金额 36rpx/600 success,
          输入框 2rpx 描边 / 圆角 24rpx / bg surface.muted,提交按钮 h100rpx 圆角 24rpx */}
      <View className="min-h-screen bg-background p-[20rpx] pb-[160rpx]">
        <View className="rounded-lg border-[length:2rpx] border-border bg-card p-[24rpx]">
          <RefundHeader />
          <RefundOrderCard
            loading={loading}
            order={order}
            orderNo={orderNo}
            refundAmount={refundAmount}
          />
        </View>

        <View className="mt-[24rpx] rounded-lg border-[length:2rpx] border-border bg-card p-[24rpx]">
          <Text className="block text-[length:28rpx] font-medium text-foreground mb-[20rpx]">
            {tt('order.refund.refundAmount', '退款金额')}
          </Text>
          <View className="flex items-center justify-between">
            <Text className="text-[length:36rpx] font-semibold text-[var(--color-success)]">
              ¥{refundAmount.toFixed(2)}
            </Text>
            <Text className="text-[length:22rpx] text-[var(--color-warning-amber-text)] px-[16rpx] py-[6rpx] bg-[var(--color-warning-amber-light)] rounded-sm">
              {tt('order.refund.amountReadOnly', '不可修改')}
            </Text>
          </View>
        </View>

        <View className="mt-[24rpx] rounded-lg border-[length:2rpx] border-border bg-card p-[24rpx]">
          <Text className="block text-[length:28rpx] font-medium text-foreground mb-[20rpx]">
            {tt('order.refund.reason', '退款原因')}
          </Text>
          <RadioGroup
            className="flex flex-col gap-[24rpx]"
            onChange={(e) => setReason(e.detail.value)}
          >
            {REASONS(tt).map((r) => (
              <View key={r.key} className="flex items-center gap-[16rpx]">
                <Radio value={r.key} checked={reason === r.key} color={radioInk} />
                <Text className="text-[length:28rpx] text-foreground">{tt(r.key, r.fb)}</Text>
              </View>
            ))}
          </RadioGroup>
          {/* 选「其他原因」才出现的手填框(共享屏 reasonPlaceholder):提交时并入 reason 一起发 */}
          {reason === 'orderRefund.d5' ? (
            <FocusTextarea
              className="mt-[24rpx] w-full min-h-[140rpx] py-[16rpx] px-[28rpx] bg-[var(--color-muted)] rounded-sm border-[length:2rpx] border-border text-[length:32rpx] text-foreground box-border"
              value={otherReason}
              onInput={(e) => setOtherReason(e.detail.value)}
              placeholder={tt('orderRefund.reasonPlaceholder', '请填写退款原因')}
              maxlength={100}
            />
          ) : null}
        </View>

        <View className="mt-[24rpx] rounded-lg border-[length:2rpx] border-border bg-card p-[24rpx]">
          <Text className="block text-[length:28rpx] font-medium text-foreground mb-[20rpx]">
            {tt('order.refund.descLabel', '退款说明')}
          </Text>
          <FocusTextarea
            className="w-full min-h-[160rpx] py-[16rpx] px-[28rpx] bg-[var(--color-muted)] rounded-sm border-[length:2rpx] border-border text-[length:32rpx] text-foreground box-border"
            value={desc}
            onInput={(e) => setDesc(e.detail.value)}
            placeholder={tt('order.refund.descPlaceholder', '请补充退款说明(选填)')}
            maxlength={200}
          />
        </View>

        <View className="mt-[24rpx] rounded-lg border-[length:2rpx] border-border bg-card p-[24rpx]">
          <Text className="block text-[length:28rpx] font-medium text-foreground mb-[20rpx]">
            {tt('order.refund.contactLabel', '联系方式')}
          </Text>
          <FocusInput
            className="w-full h-[88rpx] py-[16rpx] px-[28rpx] bg-[var(--color-muted)] rounded-sm border-[length:2rpx] border-border text-[length:32rpx] text-foreground box-border"
            value={contact}
            onInput={(e) => setContact(e.detail.value)}
            placeholder={tt('order.refund.contactPlaceholder', '请输入手机号或邮箱')}
          />
        </View>

        <Button
          className={`fixed bottom-[32rpx] left-[32rpx] right-[32rpx] h-[100rpx] leading-[100rpx] rounded-sm text-title font-semibold text-center border-none p-0 ${
            disabled ? 'opacity-50' : ''
          } bg-cta text-cta-foreground`}
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
