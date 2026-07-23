import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'
import './success.css'

/** 安全 decode router 参数 */
const decodeParam = (v: string | undefined): string => (v ? decodeURIComponent(v) : '')

/** 格式化时间戳/字符串 → YYYY-MM-DD HH:mm:ss */
const formatDateTime = (v: string | undefined): string => {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`
}

/** 推算支付方式文案(未传时默认微信) */
const resolvePayMethod = (raw: string | undefined, tt: (k: string, fb: string) => string) => {
  const v = (raw || '').toLowerCase()
  if (v.includes('ali') || v.includes('zfb')) return tt('vip.success.payAlipay', '支付宝')
  if (v.includes('wechat') || v.includes('wx') || v === '') return tt('vip.success.payWechat', '微信支付')
  return decodeParam(raw)
}

/** 根据套餐类型推算会员时长 */
const resolveDuration = (plan: string, days?: string): string => {
  if (days) return `${days} 天`
  if (plan === 'yearly') return '365 天'
  if (plan === 'quarterly') return '90 天'
  return '30 天'
}

export default function VipSuccessPage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const router = useRouter()

  const orderNo = router.params.orderNo || ''
  const amount = Number(router.params.amount) || 0
  const planName = decodeParam(router.params.planName)
  const planType = decodeParam(router.params.plan) || 'monthly'
  const daysParam = decodeParam(router.params.days)
  const payMethodRaw = router.params.payMethod
  const payTimeParam = decodeParam(router.params.payTime)

  const [saved, setSaved] = useState(false)

  const payTime = payTimeParam
    ? formatDateTime(payTimeParam)
    : formatDateTime(new Date().toISOString())
  const payMethod = resolvePayMethod(payMethodRaw, tt)
  const duration = resolveDuration(planType, daysParam)
  const displayPlanName =
    planName ||
    (planType === 'yearly'
      ? tt('vip.success.yearlyPlan', '年度会员')
      : planType === 'quarterly'
        ? tt('vip.success.quarterlyPlan', '季度会员')
        : tt('vip.success.monthlyPlan', '月度会员'))

  // 记录支付状态到本地(对齐原 uniapp recordPayment 逻辑)
  const recordPayment = () => {
    if (saved) return
    try {
      const orderData = {
        orderNo,
        plan: planType,
        planName: displayPlanName,
        amount,
        payTime,
        payMethod,
        duration,
        savedAt: Date.now(),
      }
      const existing = Taro.getStorageSync('vipOrders') as Array<Record<string, unknown>> | null
      const list = Array.isArray(existing) ? existing : []
      list.push(orderData)
      Taro.setStorageSync('vipOrders', list)
      Taro.setStorageSync('paidStatus', true)
      setSaved(true)
    } catch {
      // 静默忽略本地存储失败
    }
  }

  // 首次渲染时记录一次
  useEffect(() => {
    recordPayment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goBenefits = () => {
    Taro.redirectTo({ url: '/pages/vip/index' })
  }

  const goHome = () => {
    Taro.switchTab({ url: '/pages/index/index' })
  }

  const goShare = () => {
    Taro.switchTab({
      url: '/pages/distribution/index',
    }).catch(() => {
      Taro.navigateTo({ url: '/pages/distribution/index' })
    })
  }

  const copyOrderNo = () => {
    if (!orderNo) return
    Taro.setClipboardData({ data: orderNo })
  }

  return (
    <View className="vs-page">
      {/* ===== 成功图标 + 标题 ===== */}
      <View className="vs-icon-wrap">
        <Text className="vs-icon">✓</Text>
      </View>
      <Text className="vs-title">{tt('vip.index.successTitle', '开通成功')}</Text>
      <Text className="vs-desc">{tt('vip.success.desc', '恭喜您已成功开通 VIP 会员')}</Text>

      {/* ===== 会员权益激活提示 ===== */}
      <View className="vs-activation">
        <Text className="vs-activation-icon">✦</Text>
        <Text className="vs-activation-text">
          {tt('vip.success.activationNotice', '会员权益已激活,立即可享受全部特权')}
        </Text>
      </View>

      {/* ===== 订单信息卡片 ===== */}
      <View className="vs-info-card">
        <View className="vs-info-row">
          <Text className="vs-info-label">{tt('vip.success.planName', '套餐名称')}</Text>
          <Text className="vs-info-value">{displayPlanName}</Text>
        </View>
        <View className="vs-info-row">
          <Text className="vs-info-label">{tt('vip.success.duration', '会员时长')}</Text>
          <Text className="vs-info-value">{duration}</Text>
        </View>
        <View className="vs-info-row">
          <Text className="vs-info-label">{tt('vip.success.amount', '支付金额')}</Text>
          <Text className="vs-info-value vs-amount">¥{amount}</Text>
        </View>
        <View className="vs-info-row">
          <Text className="vs-info-label">{tt('vip.success.payMethod', '支付方式')}</Text>
          <Text className="vs-info-value">{payMethod}</Text>
        </View>
        <View className="vs-info-row">
          <Text className="vs-info-label">{tt('vip.success.payTime', '支付时间')}</Text>
          <Text className="vs-info-value">{payTime}</Text>
        </View>
        {orderNo ? (
          <View className="vs-info-row" onClick={copyOrderNo}>
            <Text className="vs-info-label">{tt('order.orderNo', '订单号')}</Text>
            <Text className="vs-info-value vs-order-no">{orderNo}</Text>
          </View>
        ) : null}
      </View>

      {/* ===== 主操作按钮 ===== */}
      <View className="vs-btn-group">
        <Button className="vs-btn-primary" onClick={goBenefits}>
          {tt('vip.index.viewBenefits', '查看会员权益')}
        </Button>
        <Button className="vs-btn-outline" onClick={goHome}>
          {tt('pay.backHome', '返回首页')}
        </Button>
      </View>

      {/* ===== 分享好友赚佣金入口 ===== */}
      <View className="vs-share" onClick={goShare}>
        <View className="vs-share-icon">
          <Text className="vs-share-icon-text">🎁</Text>
        </View>
        <View className="vs-share-content">
          <Text className="vs-share-title">
            {tt('vip.success.shareTitle', '分享好友赚佣金')}
          </Text>
          <Text className="vs-share-desc">
            {tt('vip.success.shareDesc', '邀请好友开通会员,享 20% 现金佣金')}
          </Text>
        </View>
        <Text className="vs-share-arrow">›</Text>
      </View>
    </View>
  )
}
