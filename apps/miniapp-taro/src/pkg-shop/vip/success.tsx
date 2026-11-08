// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/topup-success/TopupSuccessScreen.tsx(直载共享屏 + 注入本端事实)
//
// 本端保留(不可丢的业务):
//   ① router 参数解码(订单号/套餐/时长/支付方式/支付时间,缺省值时按套餐类型推算)
//   ② 本地订单记录(VIP_ORDERS_KEY / VIP_PAID_STATUS_KEY,挂载时只记一次)
//   ③ 平台出口:查看权益(redirectTo)、返回首页(switchTab)、分享好友(switchTab 失败降级 navigateTo)、
//      复制订单号(setClipboardData)
// 版面(成功图标/标题/副标题/激活提示/信息卡/主次按钮/分享入口)全部由共享屏渲染。

import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '@/i18n'
import { VIP_ORDERS_KEY, VIP_PAID_STATUS_KEY } from '@/constants/storage'
import { formatDateByTemplate, safeDecodeURIComponent } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { TopupSuccessScreen as SharedTopupSuccessScreen } from '@ihui/rn-app/features/topup-success/TopupSuccessScreen'
import { confirmVipPaid } from './paid-verify'

/** 安全 decode router 参数 */
const decodeParam = (v: string | undefined): string => (v ? safeDecodeURIComponent(v) : '')

type Tt = (key: string, fallback: string, params?: Record<string, string | number>) => string

/** 推算支付方式文案(未传时默认微信) */
const resolvePayMethod = (raw: string | undefined, tt: Tt) => {
  const v = (raw || '').toLowerCase()
  if (v.includes('ali') || v.includes('zfb')) return tt('vip.success.payAlipay', '支付宝')
  if (v.includes('wechat') || v.includes('wx') || v === '')
    return tt('vip.success.payWechat', '微信支付')
  return decodeParam(raw)
}

/** 根据套餐类型推算会员时长 */
const resolveDuration = (tt: Tt, plan: string, days?: string): string => {
  const n = days || (plan === 'yearly' ? '365' : plan === 'quarterly' ? '90' : '30')
  return tt('vip.success.daysUnit', `${n} 天`, { n })
}

export default function VipSuccessPage() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const router = useRouter()

  const orderNo = router.params.orderNo || ''
  const amount = Number(router.params.amount) || 0
  const planName = decodeParam(router.params.planName)
  const planType = decodeParam(router.params.plan) || 'monthly'
  const daysParam = decodeParam(router.params.days)
  const payMethodRaw = router.params.payMethod
  const payTimeParam = decodeParam(router.params.payTime)

  const [saved, setSaved] = useState(false)

  const tt: Tt = useCallback(
    (key, fallback, params) => {
      const v = t(key, params)
      if (v === key) {
        if (!params) return fallback
        return fallback.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''))
      }
      return v
    },
    [t],
  )

  const payTime = payTimeParam
    ? formatDateByTemplate(payTimeParam, 'YYYY-MM-DD HH:mm:ss')
    : formatDateByTemplate(new Date().toISOString(), 'YYYY-MM-DD HH:mm:ss')
  const payMethod = resolvePayMethod(payMethodRaw, tt)
  const duration = resolveDuration(tt, planType, daysParam)
  const displayPlanName =
    planName ||
    (planType === 'yearly'
      ? tt('vip.success.yearlyPlan', '年度会员')
      : planType === 'quarterly'
        ? tt('vip.success.quarterlyPlan', '季度会员')
        : tt('vip.success.monthlyPlan', '月度会员'))

  // XUI-039:落本地账本前先查服务端订单状态(仅 status=paid 才算已支付),
  // 不再以客户端可伪造的 paid 标记为准。
  const verifyServerPaid = useCallback(async () => {
    if (!orderNo) return false
    return confirmVipPaid(orderNo, async (no) => {
      const res = await fetchApi<{ status?: string }>(
        `/vip/order/${encodeURIComponent(no)}/payinfo`,
      )
      return { status: res.success ? res.data?.status : undefined }
    })
  }, [orderNo])

  // 记录支付状态到本地(服务端确认已支付后才落盘)
  const recordPayment = useCallback(async () => {
    if (saved) return
    const paid = await verifyServerPaid()
    if (!paid) {
      Taro.showToast({ title: tt('vip.success.notPaid', '订单未支付,未记录会员'), icon: 'none' })
      return
    }
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
      const existing = Taro.getStorageSync(VIP_ORDERS_KEY) as Array<Record<string, unknown>> | null
      const list = Array.isArray(existing) ? existing : []
      list.push(orderData)
      Taro.setStorageSync(VIP_ORDERS_KEY, list)
      Taro.setStorageSync(VIP_PAID_STATUS_KEY, true)
      setSaved(true)
    } catch {
      // 静默忽略本地存储失败
    }
  }, [saved, verifyServerPaid, tt, orderNo, planType, displayPlanName, amount, payTime, payMethod, duration])

  // 首次渲染时记录一次
  useEffect(() => {
    void recordPayment()
  }, [recordPayment])

  const copyOrderNo = () => {
    if (!orderNo) return
    Taro.setClipboardData({ data: orderNo })
  }

  const rows = [
    { label: tt('vip.success.planName', '套餐名称'), value: displayPlanName },
    { label: tt('vip.success.duration', '会员时长'), value: duration },
    { label: tt('vip.success.amount', '支付金额'), value: `¥${amount}` },
    { label: tt('vip.success.payMethod', '支付方式'), value: payMethod },
    { label: tt('vip.success.payTime', '支付时间'), value: payTime },
    ...(orderNo
      ? [{ label: tt('order.orderNo', '订单号'), value: orderNo, onPress: copyOrderNo }]
      : []),
  ]

  return (
    <ThemeRoot>
      <SharedTopupSuccessScreen
        t={t}
        amount={amount}
        orderId={orderNo}
        time={payTime}
        title={tt('vip.index.successTitle', '开通成功')}
        subtitle={tt('vip.success.desc', '恭喜您已成功开通 VIP 会员')}
        notice={tt('vip.success.activationNotice', '会员权益已激活,立即可享受全部特权')}
        rows={rows}
        secondaryLabel={tt('vip.index.viewBenefits', '查看会员权益')}
        primaryLabel={tt('pay.backHome', '返回首页')}
        onViewOrder={() => {
          Taro.redirectTo({ url: '/pkg-shop/vip/index' })
        }}
        onGoHome={() => {
          Taro.switchTab({ url: '/pages/index/index' })
        }}
        footerLink={{
          title: tt('vip.success.shareTitle', '分享好友赚佣金'),
          desc: tt('vip.success.shareDesc', '邀请好友开通会员,享 20% 现金佣金'),
          onPress: () => {
            Taro.switchTab({ url: '/pages/distribution/index' }).catch(() => {
              Taro.navigateTo({ url: '/pages/distribution/index' })
            })
          },
        }}
        showBack={false}
        onBack={() => {
          void Taro.navigateBack()
        }}
        colorScheme={resolvedTheme}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
