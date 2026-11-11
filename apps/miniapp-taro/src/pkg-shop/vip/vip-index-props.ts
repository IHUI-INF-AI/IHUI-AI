// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 批次 4:VIP 首页薄壳的纯映射层。状态机留在页面,渲染描述由共享屏消费。

import { resolveVipIndexFeatures } from '@ihui/rn-app/features/vip/view-model'
import type { VipBenefitCardItem, VipFeatureItem, VipOverlay } from '@ihui/types'

/** i18n 取词(key 缺失回落 fallback;params 走既有插值) */
export type VipIndexTt = (
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) => string

interface VipIndexOverlayPlan {
  name: string
  price: number
  period?: string
  originalPrice?: number
}

export interface VipIndexOverlayState {
  showBenefits: boolean
  showPayConfirm: boolean
  showIntroduce: boolean
  showConfirm: boolean
  showNotice: boolean
  showPayMethod: boolean
  showSuccess: boolean
  noticeAgreed: boolean
  payMethod: 'wechat' | 'alipay'
  plan: VipIndexOverlayPlan | null
  benefits: VipBenefitCardItem[]
}

export interface VipIndexOverlayHandlers {
  onCloseBenefits: () => void
  onUpgradeFromBenefits: () => void
  onClosePayConfirm: () => void
  onConfirmPay: () => void
  onSelectPayMethod: (method: 'wechat' | 'alipay') => void
  onCloseIntroduce: () => void
  onIntroduceSubscribe: () => void
  onCloseConfirm: () => void
  onConfirmNext: () => void
  onCloseNotice: () => void
  onToggleNoticeAgree: () => void
  onNoticeContinue: () => void
  onClosePayMethod: () => void
  onPayMethodConfirm: () => void
  onSuccessViewBenefits: () => void
}

/** 首页特权目录(图标由共享屏按 id 兜底) */
export function buildVipIndexFeatures(tt: VipIndexTt): VipFeatureItem[] {
  return resolveVipIndexFeatures(tt)
}

function payMethods(
  state: VipIndexOverlayState,
  handlers: VipIndexOverlayHandlers,
  tt: VipIndexTt,
): VipOverlay['methods'] {
  return [
    {
      id: 'wechat',
      label: tt('pay.wechat', '微信支付'),
      badge: tt('pay.wechat', '微'),
      active: state.payMethod === 'wechat',
      onPress: () => handlers.onSelectPayMethod('wechat'),
    },
    {
      id: 'alipay',
      label: tt('pay.alipay', '支付宝'),
      badge: tt('pay.alipay', '付'),
      active: state.payMethod === 'alipay',
      onPress: () => handlers.onSelectPayMethod('alipay'),
    },
  ]
}

/**
 * 把 7 个互斥弹层合成单个共享屏 overlay。
 * 优先级:成功 > 支付方式 > 购买须知 > 确认购买 > 等级介绍 > 支付确认 > 权益列表。
 * 全部关闭 ⇒ null(共享屏不渲染遮罩)。
 */
export function buildVipIndexOverlay(
  state: VipIndexOverlayState,
  handlers: VipIndexOverlayHandlers,
  tt: VipIndexTt,
): VipOverlay | null {
  const plan = state.plan
  if (state.showSuccess) {
    return {
      kind: 'success',
      title: tt('vip.index.successTitle', '开通成功'),
      lines: [tt('vip.index.successDesc', '您已成为VIP会员,尊享全部特权')],
      primaryLabel: tt('vip.index.viewBenefits', '查看会员权益'),
      onPrimary: handlers.onSuccessViewBenefits,
    }
  }
  if (state.showPayMethod) {
    return {
      kind: 'method',
      title: tt('vip.index.payMethodTitle', '选择支付方式'),
      methods: payMethods(state, handlers, tt),
      primaryLabel: tt('vip.index.confirmPay', '确认支付'),
      onPrimary: handlers.onPayMethodConfirm,
      onClose: handlers.onClosePayMethod,
    }
  }
  if (state.showNotice) {
    return {
      kind: 'notice',
      title: tt('vip.index.noticeTitle', '购买须知'),
      lines: [
        tt('vip.index.noticeRule1', 'vip.index.noticeRule1'),
        tt('vip.index.noticeRule2', 'vip.index.noticeRule2'),
        tt('vip.index.noticeRule3', 'vip.index.noticeRule3'),
        tt('vip.index.noticeRule4', 'vip.index.noticeRule4'),
      ],
      agree: {
        label: tt('vip.index.noticeAgree', '我已阅读并同意购买须知'),
        checked: state.noticeAgreed,
        onToggle: handlers.onToggleNoticeAgree,
      },
      primaryLabel: tt('vip.index.continuePay', '继续支付'),
      onPrimary: handlers.onNoticeContinue,
      onClose: handlers.onCloseNotice,
    }
  }
  if (state.showConfirm && plan) {
    return {
      kind: 'confirm',
      title: tt('vip.index.confirmTitle', '确认购买'),
      plan: { name: `${plan.name} VIP`, price: plan.price, period: plan.period },
      primaryLabel: `${tt('vip.index.payNow', '立即支付')} ¥${plan.price}`,
      onPrimary: handlers.onConfirmNext,
      onClose: handlers.onCloseConfirm,
    }
  }
  if (state.showIntroduce) {
    return {
      kind: 'intro',
      title: tt('vip.index.introduceTitle', '会员等级介绍'),
      lines: [tt('vip.index.introduceDesc', 'vip.index.introduceDesc')],
      primaryLabel: tt('vip.subscribe', '立即订阅'),
      onPrimary: handlers.onIntroduceSubscribe,
      onClose: handlers.onCloseIntroduce,
    }
  }
  if (state.showPayConfirm && plan) {
    return {
      kind: 'payConfirm',
      title: tt('pay.confirmOrder', '确认订单'),
      plan: {
        name: `${plan.name}VIP`,
        price: plan.price,
        originalPrice: plan.originalPrice,
      },
      methods: payMethods(state, handlers, tt),
      primaryLabel: tt('pay.confirmPay', `确认支付 ¥${plan.price}`),
      onPrimary: handlers.onConfirmPay,
      onClose: handlers.onClosePayConfirm,
    }
  }
  if (state.showBenefits) {
    return {
      kind: 'benefits',
      title: tt('vip.benefitsTitle', '会员权益'),
      benefits: state.benefits,
      primaryLabel: tt('vip.upgradeNow', '立即升级'),
      onPrimary: handlers.onUpgradeFromBenefits,
      onClose: handlers.onCloseBenefits,
    }
  }
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
