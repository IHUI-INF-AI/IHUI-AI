// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
