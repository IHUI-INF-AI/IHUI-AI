export type TicketStatus = 'pending' | 'open' | 'resolved' | 'closed' | 'rejected'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Category {
  id: string
  name: string
  slug: string
}

export interface Ticket {
  id: string
  ticketNo: string
  categoryId: string | null
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  source: string
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Comment {
  id: string
  ticketId: string
  userId: string
  content: string
  isAdmin: boolean
  attachments: unknown[]
  createdAt: string
}

export interface Rating {
  id: string
  rating: number
  comment: string | null
}
