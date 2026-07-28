export { type PageData } from '@ihui/api-client'

export type { RefundStatus, EduRefund, OrderStatus, EduOrder } from '@ihui/types'
import type { EduOrder, EduRefund } from '@ihui/types'

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
