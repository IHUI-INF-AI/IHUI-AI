/**
 * 通知与 WebSocket 消息类型(跨端共享唯一类型源)
 *
 * 涵盖:
 * - WebSocket 实时通知消息格式(WSNotification / AIResponseNotification)
 * - 通知业务类型(NotificationItem / MessageItem / UnreadCount)
 * - 客服会话(CustomerServiceSession / CustomerServiceMessage)
 *
 * 各端(api/web/desktop/extension/mobile-rn/miniapp-taro)统一从 @ihui/types 导入,
 * 禁止本地重复定义。
 */

// ===================== WebSocket 消息类型 =====================

/** WebSocket 通知推送消息(后端 /ws/notifications 推送格式) */
export interface WSNotification {
  type: 'notification'
  data: {
    /** 通知子类型:ai_response / chat_message / notification 等 */
    type: string
    [key: string]: unknown
  }
}

/** AI 回复推送载荷(ai_callback_worker → pushNotification → WS) */
export interface AIResponseNotification {
  type: 'ai_response'
  conversationId: string
  clientMessageId?: string
  message: {
    id: string
    role: string
    content: string
    createdAt?: string
  }
}

/** 类型守卫:WSNotification 是否为 AI 回复 */
export function isAIResponse(
  n: WSNotification | null,
): n is WSNotification & { data: AIResponseNotification } {
  return !!n && n.data?.type === 'ai_response' && !!n.data?.message
}

// ===================== 通知业务类型 =====================

/** 通知列表项 */
export interface NotificationItem {
  id: string
  type: string
  title: string
  content: string
  isRead: boolean
  createdAt: string
  link?: string
  extra?: Record<string, unknown>
  [key: string]: unknown
}

/** 消息列表项 */
export interface MessageItem {
  id: string
  fromUserId: string
  fromNickname: string
  fromAvatar?: string | null
  content: string
  isRead: boolean
  createdAt: string
  [key: string]: unknown
}

/** 未读统计 */
export interface UnreadCount {
  message: number
  notification: number
  customerService: number
  total: number
  [key: string]: number
}

// ===================== 客服类型 =====================

/** 客服会话 */
export interface CustomerServiceSession {
  id: string
  userId: string
  userNickname?: string
  userAvatar?: string
  agentId?: string
  agentName?: string
  status: 'pending' | 'active' | 'closed'
  lastMessage?: string
  lastMessageAt?: string
  createdAt: string
  [key: string]: unknown
}

/** 客服消息 */
export interface CustomerServiceMessage {
  id: string
  sessionId: string
  fromId: string
  fromType: 'user' | 'agent' | 'bot'
  content: string
  type?: 'text' | 'image' | 'file' | 'system'
  isRead: boolean
  createdAt: string
  [key: string]: unknown
}
