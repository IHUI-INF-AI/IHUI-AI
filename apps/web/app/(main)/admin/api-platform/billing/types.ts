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
