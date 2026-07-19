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
