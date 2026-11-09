// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 钱包流水 opType 展示元数据 — 全仓唯一一张表（web / RN / 小程序三腿共用）。
 *
 * 权威枚举以服务端写入点为准（不是从前端标签倒推）：
 * - 0 `rechargeToken`：充值/入账（增加）
 * - 1 `deductToken` / 提现：扣减（减少）
 * - 2 `expireToken`：过期清零（减少）
 * - 3 `refundTokenDeduct`：退款扣回（减少）
 * - 4 `relay-billing-service`：钱包转账至 API Key（减少）
 * - 5 管理员调整：`quantity` 自带符号（正=入账，负=出账）
 * - 6 API 订阅配额发放：非金额量（钱流水端点已排除），文案「配额类变动」
 *
 * 未知 opType 一律中性展示「其他变动」，不得静默当成充值或支出。
 */
export type WalletFlowSign = 'positive' | 'negative' | 'neutral'

export type WalletFlowKind =
  | 'recharge'
  | 'deduct'
  | 'expire'
  | 'refund'
  | 'relay'
  | 'adminAdjust'
  | 'quota'
  | 'other'

export interface WalletFlowMeta {
  /** i18n 键（裸键，web 用 wallet 命名空间，RN/小程序用 `wallet.` 前缀） */
  labelKey: string
  sign: WalletFlowSign
  kind: WalletFlowKind
  /** false 表示非金额量（如 opType 6 配额），不得显示 ¥/± */
  isMoney: boolean
  /** 仅 web 使用的 Tailwind 文本色；RN/小程序按 sign 取主题色 */
  colorClass: string
}

const POSITIVE_COLOR = 'text-emerald-600 dark:text-emerald-400'
const NEGATIVE_COLOR = 'text-red-600 dark:text-red-400'
const NEUTRAL_COLOR = 'text-muted-foreground'

export function resolveWalletFlowMeta(opType: number, quantity: number): WalletFlowMeta {
  switch (opType) {
    case 0:
      return {
        labelKey: 'flowRecharge',
        sign: 'positive',
        kind: 'recharge',
        isMoney: true,
        colorClass: POSITIVE_COLOR,
      }
    case 1:
      return {
        labelKey: 'flowDeduct',
        sign: 'negative',
        kind: 'deduct',
        isMoney: true,
        colorClass: NEGATIVE_COLOR,
      }
    case 2:
      return {
        labelKey: 'flowExpire',
        sign: 'negative',
        kind: 'expire',
        isMoney: true,
        colorClass: NEGATIVE_COLOR,
      }
    case 3:
      return {
        labelKey: 'flowRefund',
        sign: 'negative',
        kind: 'refund',
        isMoney: true,
        colorClass: NEGATIVE_COLOR,
      }
    case 4:
      return {
        labelKey: 'flowRelayRecharge',
        sign: 'negative',
        kind: 'relay',
        isMoney: true,
        colorClass: NEGATIVE_COLOR,
      }
    case 5:
      return quantity >= 0
        ? {
            labelKey: 'flowAdminAdjust',
            sign: 'positive',
            kind: 'adminAdjust',
            isMoney: true,
            colorClass: POSITIVE_COLOR,
          }
        : {
            labelKey: 'flowAdminAdjust',
            sign: 'negative',
            kind: 'adminAdjust',
            isMoney: true,
            colorClass: NEGATIVE_COLOR,
          }
    case 6:
      return {
        labelKey: 'flowQuota',
        sign: 'neutral',
        kind: 'quota',
        isMoney: false,
        colorClass: NEUTRAL_COLOR,
      }
    default:
      return {
        labelKey: 'flowOther',
        sign: 'neutral',
        kind: 'other',
        isMoney: true,
        colorClass: NEUTRAL_COLOR,
      }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
