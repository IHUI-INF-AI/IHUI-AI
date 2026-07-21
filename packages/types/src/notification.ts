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

/** AI 主动提问选项(跨端共享,与 web store 的 QuestionOption 结构一致) */
export interface QuestionOptionPayload {
  id: string
  label: string
}

/** AI 主动提问载荷(跨端共享,与 web store 的 PendingQuestion 结构一致)
 *  - 由 api /chat/questions 端点写入 chat_messages.metadata.pendingQuestion
 *  - 通过 WS ai_question 事件广播到多端
 *  - 前端收到后 setPendingQuestion 弹窗阻塞输入
 *  - 用户回答后通过 /chat/answer 续流,WS 广播 chat_question_answered 通知多端关闭弹窗 */
export interface PendingQuestionPayload {
  questionId: string
  prompt: string
  options: QuestionOptionPayload[]
  allowCustom: boolean
  allowMultiple: boolean
  /** 关联的 assistant 消息 ID(DB id),用于持久化 metadata 到该消息 */
  assistantMessageId?: string
}

/** AI 主动提问推送载荷(api /chat/questions → pushNotification → WS) */
export interface AIQuestionNotification {
  type: 'ai_question'
  conversationId: string
  question: PendingQuestionPayload
}

/** 类型守卫:WSNotification 是否为 AI 主动提问 */
export function isAIQuestion(
  n: WSNotification | null,
): n is WSNotification & { data: AIQuestionNotification } {
  return !!n && n.data?.type === 'ai_question' && !!n.data?.question
}

/** AI 提问已回答推送载荷(用户提交答案后 → WS 广播 → 多端关闭弹窗) */
export interface AIQuestionAnsweredNotification {
  type: 'chat_question_answered'
  conversationId: string
  questionId: string
}

/** 类型守卫:WSNotification 是否为 AI 提问已回答 */
export function isAIQuestionAnswered(
  n: WSNotification | null,
): n is WSNotification & { data: AIQuestionAnsweredNotification } {
  return !!n && n.data?.type === 'chat_question_answered' && !!n.data?.questionId
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
