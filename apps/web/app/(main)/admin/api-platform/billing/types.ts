// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface BillingRecord {
  id: string
  appName: string
  amount: number
  type: 'recharge' | 'consume' | 'refund'
  status: 'pending' | 'success' | 'failed'
  createdAt: string
}

export interface BillingSummary {
  totalRecharge: number
  totalConsume: number
  totalRefund: number
  balance: number
}

export const TYPE_LABEL_KEY: Record<BillingRecord['type'], string> = {
  recharge: 'typeRecharge',
  consume: 'typeConsume',
  refund: 'typeRefund',
}

export const STATUS_LABEL_KEY: Record<BillingRecord['status'], string> = {
  pending: 'statusPending',
  success: 'statusSuccess',
  failed: 'statusFailed',
}
