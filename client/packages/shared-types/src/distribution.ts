export interface TraderStats {
  totalOrders?: number
  totalAmount?: number
  totalCommission?: number
  subordinateCount?: number
  [key: string]: unknown
}

export interface SubordinateItem {
  id?: string | number
  userId?: string
  nickname?: string
  avatar?: string
  phone?: string
  orderCount?: number
  totalAmount?: number
  commission?: number
  createTime?: string
  [key: string]: unknown
}

export interface CommissionDetail {
  totalCommission?: number
  pendingCommission?: number
  withdrawnCommission?: number
  todayCommission?: number
  [key: string]: unknown
}

export interface FlowItem {
  id?: string | number
  orderId?: string
  amount?: number
  commission?: number
  status?: string
  type?: string
  createTime?: string
  [key: string]: unknown
}

export interface WithdrawalRequest {
  token?: string
  amount?: number
  nickname?: string
  openId?: string
}

export interface WithdrawalStatus {
  status?: string
  amount?: number
  createTime?: string
  approveTime?: string
  [key: string]: unknown
}

export interface AgentGroupItem {
  id?: string | number
  groupId?: string
  groupName?: string
  agentId?: string
  agentName?: string
  messageCount?: number
  lastMessage?: string
  lastMessageTime?: string
  [key: string]: unknown
}
