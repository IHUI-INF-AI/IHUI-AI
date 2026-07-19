export interface TicketReply {
  id: string
  ticketId: string
  userId: string
  userName?: string | null
  content: string
  isAdmin: boolean
  createdAt: string
}

export interface TicketReplyListData {
  list: TicketReply[]
  total: number
}
