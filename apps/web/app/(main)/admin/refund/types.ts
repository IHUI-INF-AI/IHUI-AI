// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
