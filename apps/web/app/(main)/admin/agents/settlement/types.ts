// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Settlement {
  id: string
  agentId: string
  buyRecordId: string | null
  orderNo: string | null
  amount: number
  commissionRate: number
  commissionAmount: number
  status: string
  settledAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SettlementData {
  list: Settlement[]
  total: number
  page: number
  pageSize: number
}

export interface SettlementSummary {
  totalAmount: number
  settledAmount: number
  pendingAmount: number
}
