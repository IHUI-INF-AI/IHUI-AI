// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
/**
 * 钱包钱流水 opType 展示元数据。
 *
 * 权威枚举以服务端写入点为准（不是从前端标签倒推）：
 * - 0 `rechargeToken`：充值/入账（增加）
 * - 1 `deductToken` / 提现：扣减（减少）
 * - 2 `expireToken`：过期清零（减少）
 * - 3 `refundTokenDeduct`：退款扣回（减少）
 * - 4 `relay-billing-service`：钱包转账至 API Key（减少）
 * - 5 管理员调整：`quantity` 自带符号（正=入账，负=出账）
 * - 6 API 订阅配额发放：非金额量（钱流水端点已排除）
 *
 * 未知 opType 一律中性展示「其他变动」，不得静默当成充值。
 */
export type WalletFlowSign = 'positive' | 'negative' | 'neutral'

export interface WalletFlowMeta {
  /** i18n key（wallet 命名空间） */
  labelKey: string
  sign: WalletFlowSign
  colorClass: string
}

const POSITIVE_COLOR = 'text-emerald-600 dark:text-emerald-400'
const NEGATIVE_COLOR = 'text-red-600 dark:text-red-400'
const NEUTRAL_COLOR = 'text-muted-foreground'

export function resolveWalletFlowMeta(opType: number, quantity: number): WalletFlowMeta {
  switch (opType) {
    case 0:
      return { labelKey: 'flowRecharge', sign: 'positive', colorClass: POSITIVE_COLOR }
    case 1:
      return { labelKey: 'flowDeduct', sign: 'negative', colorClass: NEGATIVE_COLOR }
    case 2:
      return { labelKey: 'flowExpire', sign: 'negative', colorClass: NEGATIVE_COLOR }
    case 3:
      return { labelKey: 'flowRefund', sign: 'negative', colorClass: NEGATIVE_COLOR }
    case 4:
      return { labelKey: 'flowRelayRecharge', sign: 'negative', colorClass: NEGATIVE_COLOR }
    case 5:
      return quantity >= 0
        ? { labelKey: 'flowAdminAdjust', sign: 'positive', colorClass: POSITIVE_COLOR }
        : { labelKey: 'flowAdminAdjust', sign: 'negative', colorClass: NEGATIVE_COLOR }
    default:
      // 6=API 配额（非金额，正常不会出现在钱流水）；其他未知值同样中性兜底
      return { labelKey: 'flowOther', sign: 'neutral', colorClass: NEUTRAL_COLOR }
  }
}
