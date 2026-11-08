// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 提现壳页的纯映射(无 Taro/RN 依赖,供页面与单测共用)。

import type { WithdrawMethodOption, WithdrawScreenTexts } from '@ihui/types'

export type Tt = (key: string, fallback: string, params?: Record<string, string | number>) => string

const priceFmt = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 到账方式(小程序侧仅微信/支付宝;银行卡走 RN/web 的独立输入段) */
export function buildWithdrawMethods(tt: Tt): WithdrawMethodOption[] {
  return [
    { id: 'wechat', label: tt('distribution.withdraw.methodWechat', '微信'), icon: '微' },
    { id: 'alipay', label: tt('distribution.withdraw.methodAlipay', '支付宝'), icon: '支' },
  ]
}

/** 文案覆盖(共享屏未传时回落到既有 key) */
export function buildWithdrawTexts(tt: Tt): WithdrawScreenTexts {
  return {
    back: tt('common.back', '返回'),
    title: tt('distribution.withdraw.title', '提现'),
    availableBalance: tt('wallet.withdrawal.availableYuan', '可提现金额(元)'),
    amountLabel: tt('wallet.withdrawal.amountLabel', '提现金额'),
    amountPlaceholder: tt('distribution.withdraw.amountPlaceholder', '请输入提现金额'),
    methodLabel: tt('distribution.withdraw.method', '提现方式'),
    fillAll: tt('distribution.withdraw.all', '全部提现'),
    records: tt('wallet.withdrawal.records', '提现记录'),
    submit: tt('distribution.withdraw.submit', '提交申请'),
    submitting: tt('distribution.withdraw.submitting', '提交中…'),
  }
}

/** 可提现余额格式化(共享屏按数字渲染,壳内「全部提现」需要两位小数字符串) */
export function formatWithdrawAmount(amount: number): string {
  return priceFmt.format(amount)
}

/**
 * U-7:壳内「全部提现」写入的是带千分位的展示串(如 `1,234.56`),
 * 旧提交逻辑 `Number(amount)` 直接得 NaN ⇒ 被判「请输入有效金额」,用户提不出钱。
 * 提交前把千分位/空白剥掉再转数。
 */
export function parseWithdrawAmount(raw: string): number {
  return Number(String(raw ?? '').replace(/[,，\s]/g, ''))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
