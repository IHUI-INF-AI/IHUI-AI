// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export type TicketStatus = 'open' | 'processing' | 'closed' | 'resolved'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Ticket {
  id: string
  ticketNo: string
  userId: string
  userName?: string | null
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assigneeId?: string | null
  assigneeName?: string | null
  createdAt: string
  updatedAt: string
}

export interface TicketListData {
  list: Ticket[]
  total: number
}

export interface TicketReplyBody {
  content: string
  isAdmin: boolean
}
