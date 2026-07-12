export interface FundAccount {
  id: string
  user: string
  balance: number
  frozen: number
  totalRecharge: number
  totalConsume: number
  updatedAt: string
}

export interface FundFlow {
  id: string
  user: string
  amount: number
  direction: 'in' | 'out'
  type: 'recharge' | 'consume' | 'refund' | 'withdraw'
  balance: number
  remark: string | null
  createdAt: string
}
