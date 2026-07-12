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
