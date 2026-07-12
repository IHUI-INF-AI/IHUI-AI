export type RefundStatus =
  'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed'

export interface EduRefund {
  id: string
  orderId: string
  orderType: string
  orderNo: string
  userId: string
  reason?: string | null
  refundAmount: string
  refundType: string
  status: RefundStatus
  applyTime?: string | null
  processTime?: string | null
  completeTime?: string | null
  processMessage?: string | null
  handleMessage?: string | null
  createdAt: string
  updatedAt: string
}

export interface PageData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface RefundStats {
  byStatus: Record<string, { count: number; totalAmount: string }>
  totalCount: number
  totalAmount: string
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  completedCount: number
}

export interface ActionState {
  refund: EduRefund
  mode: 'audit' | 'reject'
}

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'

export interface EduOrder {
  id: string
  orderNo: string
  userId: string
  orderType: string
  targetTitle?: string | null
  payAmount: string
  payType?: string | null
  status: OrderStatus
  createdAt: string
}

export interface AuditRecord {
  id: string
  orderId: string
  refundId: string
  auditorId: string
  action: 'approve' | 'reject'
  reason?: string | null
  createdAt: string
}

export interface RefundDetail {
  refund: EduRefund
  order: EduOrder | null
  auditRecords: AuditRecord[]
}
