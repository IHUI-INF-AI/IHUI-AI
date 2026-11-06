// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 充值壳页的纯映射(无 Taro/RN 依赖,供页面与单测共用)。

import type { AppTopupRateTier, AppTopupScreenTexts, AppTopupUserInfo } from '@ihui/types'

export const PRESET_AMOUNTS = [10, 50, 100, 500, 1000]
export const TOKEN_RATE = 10

type Tt = (key: string, fallback: string, params?: Record<string, string | number>) => string

export interface RechargeUserSource {
  avatar?: string
  nickname?: string
  phone?: string
}

export function buildAmountOptions(presets: readonly number[]) {
  return presets.map((v) => ({
    id: String(v),
    amount: Math.round(v * 100),
    label: `¥${v}`,
  }))
}

export function buildPayMethods(tt: Tt) {
  return [
    { id: 'wechat', label: tt('wallet.recharge.methodWechat', '微信支付') },
    { id: 'alipay', label: tt('wallet.recharge.methodAlipay', '支付宝') },
  ]
}

export function buildRateTiers(rate: number): AppTopupRateTier[] {
  return [{ key: 'normal', label: '', tokens: rate }]
}

export function buildRechargeUser(user: RechargeUserSource | null): AppTopupUserInfo | undefined {
  if (!user) return undefined
  return {
    avatar: user.avatar,
    nickname: user.nickname,
    subtitle: user.phone,
  }
}

export function buildRechargeTexts(tt: Tt): AppTopupScreenTexts {
  return {
    title: tt('wallet.recharge.title', '充值'),
    balanceLabel: tt('wallet.recharge.balance', '账户余额'),
    amountTitle: tt('wallet.recharge.amount', '充值金额'),
    rateTitle: tt('wallet.recharge.rate', '充值比例'),
    customPlaceholder: tt('wallet.recharge.customPlaceholder', '请输入金额'),
    methodTitle: tt('wallet.recharge.method', '充值方式'),
    submit: tt('wallet.recharge.submit', '充值'),
    submitting: tt('wallet.recharge.submitting', '充值中…'),
    introTitle: tt('wallet.recharge.introTitle', '充值说明'),
    introBody: tt('wallet.recharge.introBody', '充值金额将立即到账，可用于购买课程、服务等。'),
    gotIt: tt('common.gotIt', '我知道了'),
    guest: tt('wallet.recharge.guest', '游客'),
  }
}

/** 档位与自定义互斥:选中档位用档位值,否则解析自定义输入 */
export function resolveRechargeAmount(selectedId: string, customAmount: string): number {
  if (selectedId) {
    const v = Number(selectedId)
    return Number.isFinite(v) ? v : 0
  }
  const n = Number(customAmount)
  return Number.isFinite(n) ? n : 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
