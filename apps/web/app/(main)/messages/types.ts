export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: string
  isMine: boolean
}

export interface Conversation {
  id: string
  peerId: string
  peerName: string
  peerAvatar: string | null
  lastMessage: string
  lastTime: string
  unread: number
  messages: ChatMessage[]
}

export interface ListData {
  list: Conversation[]
  total: number
  page: number
  pageSize: number
}

export interface SendResult {
  message: ChatMessage
}
