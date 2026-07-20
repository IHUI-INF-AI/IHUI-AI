export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid'

export interface Withdrawal {
  id: string
  userId: string
  userName: string | null
  amount: number
  channel: string
  status: WithdrawalStatus
  remark: string | null
  createdAt: string
}

export interface WithdrawalListData {
  list: Withdrawal[]
  total: number
}
